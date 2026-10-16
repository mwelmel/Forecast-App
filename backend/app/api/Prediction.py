from pathlib import Path

import joblib 
import pandas as pd
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import and_, extract, func
from sqlalchemy.orm import Session
from datetime import datetime

from app.core.database import get_db
from app.models.ModelMetric import Modelmetrics
from app.models.Product import Products
from app.models.Sales import Sales_data
from app.models.Prediction import Predictions 
from app.schemas.Prediction import PredictionProduct, PredictionRequest, PredictionResponse
from app.dependencies.authorization import get_current_user

from ml.feature_engineering import (
    handle_negative_sales,
    fix_period_bug,
    aggregate_monthly,
    fill_monthly_gaps,
    forecast_month,
)

router = APIRouter(prefix="/predict", tags=["Prediksi"])

NOTEBOOKS_DIR = Path(__file__).resolve().parents[2] / "ml"/ "notebooks"
TRAINED_MODELS = NOTEBOOKS_DIR / "trained_models"
GENERAL_SCOPE = "ALL"
MIN_HISTORY_MONTHS = 6 #jagaan minimal 6 bulan histori produknya

ALGO_NAME_TO_KEY = {
    "Random Forest Regression": "random_forest",
    "Extra Trees Regression": "extra_trees",
    "Gradient Boosting Regression": "gradient_boosting",
    "random_forest": "random_forest",
    "extra_trees": "extra_trees",
    "gradient_boosting": "gradient_boosting",
}

_router_cache: dict[str, dict] = {}

# fungsi buat dapetin nama algonya
def get_algo_key(algorithm_name: str) -> str:
    if algorithm_name in ALGO_NAME_TO_KEY:
        return ALGO_NAME_TO_KEY[algorithm_name]
    return algorithm_name.lower().replace(" regression", "").replace(" ", "_")

# fungsi dapetin modelnya yang udh kelatih
def get_router_bundle(algorithm_name: str) -> dict:
    algo_key = get_algo_key(algorithm_name)
    if algo_key not in _router_cache:
        path = TRAINED_MODELS / f"{algo_key}_router.joblib"
        if not path.exists():
            raise HTTPException(
                status_code=503,
                detail=f"File model router '{path.name}' belum tersedia di {TRAINED_MODELS}. Silakan retrain terlebih dahulu.",
            )
        _router_cache[algo_key] = joblib.load(path)
    return _router_cache[algo_key]

# fungsi biar encoder baru ketulis kebaca kalo engga misal ada produk baru ikut retrain dia dianggep ga dikenal
def clear_encoder_cache():
    _router_cache.clear()

# fungsi buat cek apakah produk udh pernah ikut train
def is_product_known(bundle: dict, product_code: str) -> bool:
    if product_code in bundle.get("products", {}):
        return True
    fallback_all = bundle.get("fallback_all")
    if fallback_all and "encoders" in fallback_all:
        enc = fallback_all["encoders"]
        if isinstance(enc, dict) and "produk" in enc and hasattr(enc["produk"], "classes_"):
            return product_code in enc["produk"].classes_
    return True

# fungsi buat modelnya nentuin nih tpi dibelakang layar 
def resolve_model_for_product(bundle: dict, product: Products):
    products_dict = bundle.get("products", {})
    lob_dict = bundle.get("fallback_lob", {})
    fallback_all = bundle.get("fallback_all")

    if product.product_code in products_dict:
        return products_dict[product.product_code]["model"], f"Per-Produk ({product.product_code})"
    elif product.lob in lob_dict:
        return lob_dict[product.lob]["model"], f"Fallback LOB ({product.lob})"
    elif fallback_all is not None:
        return fallback_all["model"], "Fallback ALL (Model Umum)"

    raise HTTPException(
        status_code=503,
        detail=f"Tidak ditemukan model (Per-Produk, LOB, maupun ALL) untuk produk '{product.product_code}'.",
    )

def get_active_general_model(db: Session) -> Modelmetrics:
    active_general = (
        db.query(Modelmetrics)
        .filter(Modelmetrics.is_active == True)
        .first()
    )
    if active_general:
        return active_general

    raise HTTPException(
        status_code=503,
        detail="Belum ada model yang aktif. silakan retrain & pilih model utama terlebih dahulu",
    )

def get_sales_history(db: Session, product_code: str) -> tuple[pd.DataFrame, Products]:
    product = db.query(Products).filter(Products.product_code == product_code).first()
    if product is None:
        raise HTTPException(status_code=404, detail=f"Produk '{product_code}' tidak ditemukan")
    rows = (
        db.query(Sales_data)
        .filter(Sales_data.product_id == product.product_id)
        .order_by(Sales_data.transaction_date)
        .all()
    )

    if not rows:
        raise HTTPException(status_code=404, detail=f"Produk '{product_code}' belum memiliki data penjualan")

    df = pd.DataFrame([{
        "KODE_PRODUK": product.product_code,
        "LOB": product.lob,
        "LEAD_TIME": product.lead_time,
        "PERIOD_MO": r.transaction_date,
        "SALES_QTY": r.quantity_sold,
    } for r in rows])
    return df, product

def generate_forecasts_for_all_products(
    db: Session,
    active_model: Modelmetrics,
    horizon: int = 6,
):
    print(f"\n[Forecast] Memulai generate forecast {horizon} bulan untuk model: {active_model.algorithm_name}...")
    bundle = get_router_bundle(active_model.algorithm_name)

    # 1. Ambil semua produk & seluruh sales_data sekaligus (Hanya 2 Query SQL, bukan ribuan!)
    products = db.query(Products).order_by(Products.product_code.asc()).all()
    all_sales = (
        db.query(Sales_data.product_id, Sales_data.transaction_date, Sales_data.quantity_sold)
        .order_by(Sales_data.transaction_date.asc())
        .all()
    )

    # Kelompokkan sales berdasarkan product_id di memori
    sales_by_product: dict[int, list] = {}
    for prod_id, trans_date, qty in all_sales:
        sales_by_product.setdefault(prod_id, []).append((trans_date, qty))

    # 2. Ambil semua prediksi existing (yang actual_quantity masih None) sekaligus
    existing_preds = (
        db.query(Predictions)
        .filter(Predictions.actual_quantity.is_(None))
        .all()
    )
    existing_map = {
        (p.product_id, p.prediction_period): p for p in existing_preds
    }

    generated = 0
    skipped = []
    now = datetime.now()

    for idx, product in enumerate(products, start=1):
        if not is_product_known(bundle, product.product_code):
            skipped.append(product.product_code)
            continue

        prod_sales = sales_by_product.get(product.product_id)
        if not prod_sales:
            skipped.append(product.product_code)
            continue

        df_hist = pd.DataFrame([
            {
                "KODE_PRODUK": product.product_code,
                "LOB": product.lob,
                "LEAD_TIME": product.lead_time,
                "PERIOD_MO": trans_date,
                "SALES_QTY": qty,
            }
            for trans_date, qty in prod_sales
        ])

        df_hist = handle_negative_sales(df_hist, verbose=False)
        df_hist = fix_period_bug(df_hist)
        df_hist = aggregate_monthly(df_hist, verbose=False)
        df_hist = fill_monthly_gaps(df_hist, verbose=False)
        df_hist = df_hist.sort_values("PERIOD_MO").reset_index(drop=True)

        if len(df_hist) < MIN_HISTORY_MONTHS:
            skipped.append(product.product_code)
            continue

        model_produk, _ = resolve_model_for_product(bundle, product)

        # set n jobs = 1
        if hasattr(model_produk, "n_jobs"):
            model_produk.n_jobs = 1

        history_values = df_hist["SALES_QTY"].tolist()
        # last_period = pd.to_datetime(df_hist["PERIOD_MO"]).max()
        # Paksa titik awal forecast dihitung dari bulan saat ini (Oktober 2026) 
        last_period = pd.Timestamp(year=datetime.now().year, month=datetime.now().month, day=1) - pd.DateOffset(months=1)

        try:
            forecast = forecast_month(
                model_produk,
                history_values,
                last_period,
                horizon=horizon,
            )
        except Exception as e:
            print(f"[ERROR Forecast] Gagal pada produk {product.product_code}: {repr(e)}")
            raise

        for item in forecast:
            prediction_period = pd.Timestamp(
                year=int(item["tahun"]),
                month=int(item["bulan"]),
                day=1,
            ).to_pydatetime()

            key = (product.product_id, prediction_period)
            if key in existing_map:
                existing_obj = existing_map[key]
                existing_obj.metric_id = active_model.metric_id
                existing_obj.predicted_quantity = float(item["predicted_quantity"])
                existing_obj.created_at = now
            else:
                new_pred = Predictions(
                    product_id=product.product_id,
                    metric_id=active_model.metric_id,
                    prediction_period=prediction_period,
                    predicted_quantity=float(item["predicted_quantity"]),
                    actual_quantity=None,
                    created_at=now,
                )
                db.add(new_pred)
                existing_map[key] = new_pred

        generated += 1

        # Commit bertahap dan tampilkan log progres setiap 200 produk
        if idx % 200 == 0 or idx == len(products):
            db.commit()
            print(f"  -> [Forecast] Progres: {idx}/{len(products)} produk ({generated} berhasil dibuat)...")

    db.commit()
    print(f"[Forecast] Selesai! Total {generated} produk berhasil diprediksi, {len(skipped)} dilewati.\n")

    return {
        "products_forecasted": generated,
        "products_skipped": skipped,
    }

@router.get("/products", response_model=list[PredictionProduct])
def get_prediction_products(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    return db.query(Products).order_by(Products.product_code.asc()).all()


@router.post("", response_model=PredictionResponse)
def predict_sales(
    payload: PredictionRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    df_hist, product = get_sales_history(db, payload.product_code)
    active_model = get_active_general_model(db)

    # Load bundle router milik algoritma yang sedang aktif
    bundle = get_router_bundle(active_model.algorithm_name)
 
    if not is_product_known(bundle, payload.product_code):
        raise HTTPException(
            status_code=422,
            detail=(
                f"Produk '{payload.product_code}' belum dikenali oleh sistem model "
                f"(produk baru / belum ikut proses retrain terakhir)."
            ),
        )
 
    df_hist = handle_negative_sales(df_hist, verbose=False)
    df_hist = fix_period_bug(df_hist)
    df_hist = aggregate_monthly(df_hist, verbose=False)
    df_hist = fill_monthly_gaps(df_hist, verbose=False)
    df_hist = df_hist.sort_values("PERIOD_MO").reset_index(drop=True)
 
    if len(df_hist) < MIN_HISTORY_MONTHS:
        raise HTTPException(
            status_code=422,
            detail=(
                f"Histori penjualan produk '{payload.product_code}' belum cukup "
                f"(minimal {MIN_HISTORY_MONTHS} bulan kalender, baru ada {len(df_hist)})."
            ),
        )
 
    # Auto-routing ke model spesifik milik produk ini (atau fallback jika < 10 baris)
    model_produk, scope_label = resolve_model_for_product(bundle, product)
 
    history_values = df_hist["SALES_QTY"].tolist()
    # last_period = df_hist["PERIOD_MO"].max()
    # Paksa titik awal forecast dihitung dari bulan saat ini (Oktober 2026) 
    last_period = pd.Timestamp(year=datetime.now().year, month=datetime.now().month, day=1) - pd.DateOffset(months=1)

    forecast = forecast_month(
        model_produk,
        history_values,
        last_period,
        horizon=payload.horizon,
    )

    now = datetime.now()
    for item in forecast:
        prediction_period = pd.Timestamp(
            year=int(item["tahun"]),
            month=int(item["bulan"]),
            day=1,
        ).to_pydatetime()

        # Update prediksi yang sudah ada untuk produk + periode ini (belum punya aktual),
        # supaya halaman forecasting yang dibuka berkali-kali tidak bikin data dobel
        existing = (
            db.query(Predictions)
            .filter(
                Predictions.product_id == product.product_id,
                Predictions.prediction_period == prediction_period,
                Predictions.actual_quantity.is_(None),
            )
            .order_by(Predictions.prediction_id.desc())
            .first()
        )

        if existing:
            existing.metric_id = active_model.metric_id
            existing.predicted_quantity = float(item["predicted_quantity"])
            existing.created_at = now
        else:
            db.add(Predictions(
                product_id=product.product_id,
                metric_id=active_model.metric_id,
                prediction_period=prediction_period,
                predicted_quantity=float(item["predicted_quantity"]),
                actual_quantity=None,
                created_at=now,
            ))

    db.commit()

    return PredictionResponse(
        product_code=product.product_code,
        algorithm_used=f"{active_model.algorithm_name} ({scope_label})",
        forecast=forecast,
    )

# fungsi buat history forecast
# Hanya menampilkan prediksi yang SUDAH punya nilai aktual di sales_data.
@router.get("/history")
def get_prediction_history(
    year: int | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=10, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    # Konvensi tanggal di sales_data: YYYY-DD-MM (bulan tersimpan di bagian "day"),
    # sama seperti asumsi perhitungan aktual sebelumnya.
    sales_year = extract("year", Sales_data.transaction_date)
    sales_month = extract("day", Sales_data.transaction_date)

    # Total penjualan aktual per produk per bulan
    actual_subq = (
        db.query(
            Sales_data.product_id.label("product_id"),
            sales_year.label("yr"),
            sales_month.label("mo"),
            func.sum(Sales_data.quantity_sold).label("actual_qty"),
        )
        .filter(
            Sales_data.transaction_date.isnot(None),
            Sales_data.quantity_sold.isnot(None),
        )
        .group_by(Sales_data.product_id, sales_year, sales_month)
        .subquery()
    )

    # Ambil hanya prediksi terbaru per produk + periode (hindari baris dobel)
    latest_pred_ids = (
        db.query(func.max(Predictions.prediction_id))
        .group_by(Predictions.product_id, Predictions.prediction_period)
    )

    pred_year = extract("year", Predictions.prediction_period)
    pred_month = extract("month", Predictions.prediction_period)

    # INNER JOIN ke actual_subq  prediksi tanpa nilai aktual otomatis tidak ikut
    base_query = (
        db.query(
            Predictions,
            Products.product_code,
            actual_subq.c.actual_qty,
        )
        .join(Products, Predictions.product_id == Products.product_id)
        .join(
            actual_subq,
            and_(
                actual_subq.c.product_id == Predictions.product_id,
                actual_subq.c.yr == pred_year,
                actual_subq.c.mo == pred_month,
            ),
        )
        .filter(Predictions.prediction_id.in_(latest_pred_ids))
    )

    # Daftar tahun hanya dari prediksi yang sudah punya aktual
    years = [
        int(result[0])
        for result in (
            base_query.with_entities(pred_year)
            .distinct()
            .order_by(pred_year.desc())
            .all()
        )
        if result[0] is not None
    ]

    query = base_query
    if year is not None:
        query = query.filter(pred_year == year)

    total = query.count()

    rows = (
        query.order_by(
            Predictions.prediction_period.desc(),
            Products.product_code.asc(),
        )
        .offset((page - 1) * limit)
        .limit(limit)
        .all()
    )

    data = []
    for prediction, product_code, actual_qty in rows:
        predicted = float(prediction.predicted_quantity)
        actual = float(actual_qty)
        error = actual - predicted

        if actual == 0:
            status = "Highly Accurate" if predicted == 0 else "Over-predicted"
        else:
            error_percentage = abs(error) / abs(actual) * 100
            if error_percentage <= 10:
                status = "Highly Accurate"
            elif predicted < actual:
                status = "Under-predicted"
            else:
                status = "Over-predicted"

        data.append({
            "prediction_id": prediction.prediction_id,
            "prediction_period": prediction.prediction_period,
            "product_code": product_code,
            "predicted_quantity": predicted,
            "actual_quantity": actual,
            "error": error,
            "status": status,
        })

    total_pages = (total + limit - 1) // limit if total > 0 else 0

    return {
        "data": data,
        "total": total,
        "page": page,
        "limit": limit,
        "total_pages": total_pages,
        "years": years,
    }
