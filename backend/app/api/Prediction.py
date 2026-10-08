from pathlib import Path

import joblib 
import pandas as pd
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import extract
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

ML_DIR = Path(__file__).resolve().parents[2] / "ml"
TRAINED_MODELS = ML_DIR / "trained_models"
GENERAL_SCOPE = "ALL"
MIN_HISTORY_MONTHS = 6 #jagaan minimal 6 bulan histori produknya

_encoder_cache: dict[str, dict] = {}

# fungsi buat dapetin data dari ML ituhh
def get_encoders_for_scope(scope: str) -> dict:
    if scope not in _encoder_cache:
        path = TRAINED_MODELS / f"encoders_{scope}.joblib"
        if not path.exists():
            raise HTTPException(status_code=503, detail=f"data training untuk scope '{scope}' belum tersedia. Retrain dahulu")
        _encoder_cache[scope] = joblib.load(path)
    return _encoder_cache[scope]

# fungsi biar encoder baru ketulis kebaca kalo engga misal ada produk baru ikut retrain dia dianggep ga dikenal
def clear_encoder_cache():
    _encoder_cache.clear()

def get_active_general_model(db: Session) -> Modelmetrics:
    active_general = (
        db.query(Modelmetrics)
        .filter(Modelmetrics.lob == GENERAL_SCOPE, Modelmetrics.is_active == True)
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
    scope = active_model.lob
    encoders = get_encoders_for_scope(scope)
 
    if payload.product_code not in encoders["produk"].classes_:
        raise HTTPException(
            status_code=422,
            detail=(
                f"Produk '{payload.product_code}' belum dikenali model scope '{scope}' "
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
 
    model_path = TRAINED_MODELS / f"{active_model.algorithm_name}_{scope}.joblib"
    model = joblib.load(model_path)
 
    history_values = df_hist["SALES_QTY"].tolist()
    last_period = df_hist["PERIOD_MO"].max()
 
    forecast = forecast_month(model, history_values, last_period, horizon=payload.horizon)
 
    for item in forecast:
        prediction_period = pd.Timestamp(year=item.tahun, month=item.bulan, day=1).to_pydatetime()
        prediction = Predictions(
            product_id=product.product_id,
            metric_id=active_model.metric_id,
            prediction_period=prediction_period,
            predicted_quantity=float(item.predicted_quantity),
            actual_quantity=None,
            created_at=datetime.now(),
        )

        db.add(prediction)
    db.commit()

    return PredictionResponse(
            product_code=product.product_code,
            algorithm_used=f"{active_model.algorithm_name} ({'model umum' if scope == GENERAL_SCOPE else f'LOB {scope}'})",
            forecast=forecast,
        )

# fungsi buat history forecast
@router.get("/history")
def get_prediction_history(
    year: int | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=10, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    query = (
        db.query(
            Predictions,
            Products.product_code,
        )
        .join(
            Products,
            Predictions.product_id == Products.product_id
        )
    )

    years = [
        int(result[0])
        for result in (
            db.query(extract("year", Predictions.prediction_period))
            .distinct()
            .order_by(extract("year", Predictions.prediction_period).desc())
            .all()
        )
        if result[0] is not None
    ]

    # Filter tahun jika diberikan
    if year is not None:
        query = query.filter(
            extract("year", Predictions.prediction_period) == year
        )

    # Urutkan dari periode terbaru
    query = query.order_by(
        Predictions.prediction_period.desc(),
        Products.product_code.asc(),
    )

    total = query.count()

    offset = (page - 1) * limit

    rows = (
        query
        .offset(offset)
        .limit(limit)
        .all()
    )

    data = []

    for prediction, product_code in rows:

        predicted = float(prediction.predicted_quantity)

        # actual_quantity bisa NULL
        actual = (
            float(prediction.actual_quantity)
            if prediction.actual_quantity is not None
            else None
        )

        # Kalau actual belum tersedia
        if actual is None:
            error = None
            status = "Pending"

        else:
            error = actual - predicted

            # Batas highly accurate = error <= 10%
            if actual == 0:
                if predicted == 0:
                    status = "Highly Accurate"
                else:
                    status = "Over-predicted"
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

    total_pages = (
        (total + limit - 1) // limit
        if total > 0
        else 0
    )

    return {
        "data": data,
        "total": total,
        "page": page,
        "limit": limit,
        "total_pages": total_pages,
        "years": years,
    }
