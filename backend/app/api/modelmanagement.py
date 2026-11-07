import threading
import time
import uuid
from pathlib import Path
from datetime import datetime

import joblib
import numpy as np
import pandas as pd
from fastapi import APIRouter, Depends, HTTPException, Query
from sklearn.ensemble import (
    ExtraTreesRegressor,
    GradientBoostingRegressor,
    RandomForestRegressor,
)
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sqlalchemy.orm import Session

from app.core.database import SessionLocal, get_db
from app.dependencies.authorization import get_current_user

from app.models.ModelMetric import Modelmetrics
from app.models.Product import Products
from app.models.Sales import Sales_data
from app.api.Prediction import clear_encoder_cache, generate_forecasts_for_all_products
from app.schemas.Modelmetric import (
    ModelMetricOut,
    PilihModelUtamaRequest,
    PilihModelUtamaResponse,
    ProductEvaluationOption,
    ProductEvaluationResponse,
    ProductMetricItem,
    RetrainResponse,
    RetrainStatusResponse,
)
from ml.feature_engineering import build_features, FEATURES, TARGET

router = APIRouter(prefix="/model", tags=["Atur Prediksi & Model"])

# ML_DIR = Path(__file__).resolve().parents[2] / "ml"
ML_DIR = Path(__file__).resolve().parents[2] / "ml"
NOTEBOOKS_DIR = ML_DIR / "notebooks"
TRAINED_MODELS = NOTEBOOKS_DIR / "trained_models"
TRAINED_MODELS.mkdir(parents=True, exist_ok=True)
EVALUATION_CSV_PATH = ML_DIR / "data" / "processed" / "hasil_evaluasi_semua_level.csv"

GENERAL_SCOPE = "ALL"
MIN_ROWS_PER_SCOPE = 50  # ambang minimal baris supaya scope dapat dilatih
MIN_ROWS_PER_PRODUK = 10 # ambang minimal baris supaya produk  dapat dilatih 

ALGORITHM_ORDER = [
    "Random Forest Regression",
    "Extra Trees Regression",
    "Gradient Boosting Regression",
]


# MODEL_CLASSES = {
#     "random_forest": lambda: RandomForestRegressor(n_estimators=300, random_state=42, n_jobs=-1),
#     "extra_trees": lambda: ExtraTreesRegressor(n_estimators=300, random_state=42, n_jobs=-1),
#     "gradient_boosting": lambda: GradientBoostingRegressor(
#         n_estimators=300, learning_rate=0.05, max_depth=3, random_state=42
#     ),
# }
MODEL_CLASSES = {
    "Random Forest Regression": (
        "random_forest",
        lambda: RandomForestRegressor(
            n_estimators=100,
            random_state=42,
            min_samples_split=5,
            min_samples_leaf=2,
            max_features="log2",
            max_depth=10,
        ),
    ),
    "Extra Trees Regression": (
        "extra_trees",
        lambda: ExtraTreesRegressor(
            n_estimators=100,
            random_state=42,
            min_samples_split=5,
            min_samples_leaf=2,
            max_features="log2",
            max_depth=10,
        ),
    ),
    "Gradient Boosting Regression": (
        "gradient_boosting",
        lambda: GradientBoostingRegressor(
            subsample=0.6,
            n_estimators=300,
            random_state=42,
            min_samples_split=10,
            min_samples_leaf=1,
            max_depth=2,
            learning_rate=0.03,
        ),
    ),
}

# def model_filename(algorithm_name: str, lob: str) -> str:
#     return f"{algorithm_name}_{lob}.joblib"


# def encoder_filename(lob: str) -> str:
#     return f"encoders_{lob}.joblib"

def router_filename(algorithm_key: str) -> str:
    return f"{algorithm_key}_router.joblib"


def require_admin(current_user=Depends(get_current_user)):
    if current_user.role not in ("admin", "super_user"):
        raise HTTPException(
            status_code=403, detail="Hanya super user yang dapat melakukan aksi ini."
        )
    return current_user


# Cache di memori untuk hasil evaluasi per produk dari file hasil_evaluasi_semua_level.csv
# agar pembacaan 1.313 produk cepat dan tidak membebani server di setiap request.
_product_eval_lock = threading.Lock()
_product_eval_cache: dict[str, list[ProductMetricItem]] | None = None
_product_eval_mtime: float | None = None


def _get_product_evaluation_map() -> dict[str, list[ProductMetricItem]]:
    global _product_eval_cache, _product_eval_mtime

    with _product_eval_lock:
        if not EVALUATION_CSV_PATH.exists():
            return {}

        current_mtime = EVALUATION_CSV_PATH.stat().st_mtime
        if _product_eval_cache is not None and _product_eval_mtime == current_mtime:
            return _product_eval_cache

        df_eval = pd.read_csv(EVALUATION_CSV_PATH)
        df_prod = df_eval[df_eval["Level"] == "PRODUK"].copy()

        order_map = {name: idx for idx, name in enumerate(ALGORITHM_ORDER)}
        eval_map: dict[str, list[ProductMetricItem]] = {}

        for scope, group in df_prod.groupby("Scope", sort=False):
            code = str(scope).strip().upper()
            items: list[ProductMetricItem] = []
            for _, row in group.iterrows():
                algo_name = str(row["Model"]).strip()
                train_rows = (
                    int(row["Jumlah Data Latih"])
                    if "Jumlah Data Latih" in row and pd.notna(row["Jumlah Data Latih"])
                    else None
                )
                test_rows = (
                    int(row["Jumlah Data Uji"])
                    if "Jumlah Data Uji" in row and pd.notna(row["Jumlah Data Uji"])
                    else None
                )
                items.append(
                    ProductMetricItem(
                        algorithm_name=algo_name,
                        mae=float(row["MAE"]),
                        rmse=float(row["RMSE"]),
                        smape=float(row["sMAPE (%)"]),
                        r2_score=float(row["R2 Score"]),
                        train_rows=train_rows,
                        test_rows=test_rows,
                    )
                )
            items.sort(key=lambda item: order_map.get(item.algorithm_name, 99))
            eval_map[code] = items

        _product_eval_cache = eval_map
        _product_eval_mtime = current_mtime
        return eval_map


def smape(y_true, y_pred, eps=1e-9):
    y_true, y_pred = np.asarray(y_true, dtype=float), np.asarray(y_pred, dtype=float)
    denom = (np.abs(y_true) + np.abs(y_pred)) / 2
    denom = np.where(denom == 0, eps, denom)
    return float(np.mean(np.abs(y_true - y_pred) / denom) * 100)


def load_all_sales_as_dataframe(db: Session) -> pd.DataFrame:
    # ambil seluruh data sales dari DB buat dibentuk sama kek data raw
    rows = (
        db.query(Sales_data, Products)
        .join(Products, Sales_data.product_id == Products.product_id)
        .all()
    )
    if not rows:
        raise HTTPException(
            status_code=400,
            detail="Belum ada data penjualan di database untuk dilatih.",
        )

    df = pd.DataFrame(
        [
            {
                "KODE_PRODUK": product.product_code,
                "LOB": product.lob,
                "LEAD_TIME": product.lead_time,
                "PERIOD_MO": sales.transaction_date,
                "SALES_QTY": sales.quantity_sold,
            }
            for sales, product in rows
        ]
    )
    # tanggal dari DB berupa objek date (dtype object); feature engineering butuh datetime64
    df["PERIOD_MO"] = pd.to_datetime(df["PERIOD_MO"])
    return df

# Helper untuk membuat fitur dan membagi data train/test 80:20 berdasarkan periode
def prepare_scope_split(df_scope: pd.DataFrame, min_rows: int):
    df_model, encoders = build_features(df_scope, fit=True, verbose=False)
    df_model = df_model.sort_values("PERIOD_MO").reset_index(drop=True)

    if len(df_model) < min_rows:
        return None

    unique_periods = sorted(df_model["PERIOD_MO"].unique())
    if len(unique_periods) < 2:
        return None

    cutoff_date = unique_periods[int(len(unique_periods) * 0.8)]
    train_df = df_model[df_model["PERIOD_MO"] < cutoff_date]
    test_df = df_model[df_model["PERIOD_MO"] >= cutoff_date]

    if len(train_df) == 0 or len(test_df) == 0:
        return None

    return {
        "X_train": train_df[FEATURES],
        "y_train": train_df[TARGET],
        "X_test": test_df[FEATURES],
        "y_test": test_df[TARGET],
        "encoders": encoders,
    }

# Status job retraining yang berjalan di background (disimpan di memori server).
# Dipakai supaya retraining tetap jalan walaupun user pindah halaman / request ditutup.
_retrain_lock = threading.Lock()
_retrain_state: dict = {
    "job_id": None,
    "status": "idle",  # idle | running | success | failed
    "started_at": None,
    "finished_at": None,
    "duration_seconds": None,
    "message": None,
    "hasil": [],
    "_perf_start": None,  # waktu mulai versi perf_counter (internal, buat hitung durasi)
}


def _retrain_snapshot() -> dict:
    # Salinan status untuk dikirim ke frontend
    with _retrain_lock:
        state = dict(_retrain_state)
    perf_start = state.pop("_perf_start", None)
    elapsed = None
    if state["status"] == "running" and perf_start is not None:
        # Lama proses yang sudah berjalan, diukur langsung di backend
        elapsed = round(time.perf_counter() - perf_start, 2)
    elif state["duration_seconds"] is not None:
        elapsed = state["duration_seconds"]
    state["elapsed_seconds"] = elapsed
    return state


def _run_retrain_job(job_id: str, user_id: int):
    # Jalan di thread terpisah dengan session DB sendiri (bukan session milik request)
    db = SessionLocal()
    try:
        hasil = _retrain_core(db, user_id)
        perf_end = time.perf_counter()
        with _retrain_lock:
            if _retrain_state["job_id"] == job_id:
                _retrain_state.update(
                    status="success",
                    finished_at=datetime.now(),
                    duration_seconds=round(perf_end - _retrain_state["_perf_start"], 2),
                    message=hasil.message,
                    hasil=[m.model_dump(mode="json") for m in hasil.hasil],
                )
        print(f"[Retrain] Job {job_id} selesai.")
    except Exception as e:
        db.rollback()
        perf_end = time.perf_counter()
        detail = e.detail if isinstance(e, HTTPException) else repr(e)
        with _retrain_lock:
            if _retrain_state["job_id"] == job_id:
                _retrain_state.update(
                    status="failed",
                    finished_at=datetime.now(),
                    duration_seconds=round(perf_end - _retrain_state["_perf_start"], 2),
                    message=str(detail),
                    hasil=[],
                )
        print(f"[Retrain] Job {job_id} gagal: {detail}")
    finally:
        db.close()


@router.post("/retrain", response_model=RetrainStatusResponse)
def retrain_model(current_user=Depends(require_admin)):
    # Mulai retraining di background lalu langsung balas status "running"
    job_id = None
    with _retrain_lock:
        if _retrain_state["status"] != "running":
            job_id = uuid.uuid4().hex
            _retrain_state.update(
                job_id=job_id,
                status="running",
                started_at=datetime.now(),
                finished_at=None,
                duration_seconds=None,
                message="Sedang melakukan proses retraining",
                hasil=[],
                _perf_start=time.perf_counter(),
            )

    # Kalau sudah ada retraining yang jalan, jangan mulai lagi (hindari ganggu training)
    if job_id is not None:
        threading.Thread(
            target=_run_retrain_job,
            args=(job_id, current_user.user_id),
            daemon=True,
        ).start()

    return _retrain_snapshot()


@router.get("/retrain/status", response_model=RetrainStatusResponse)
def get_retrain_status(current_user=Depends(require_admin)):
    # Dipanggil berkala oleh frontend untuk cek progres retraining
    return _retrain_snapshot()


def _retrain_core(db: Session, user_id: int) -> RetrainResponse:
    # (fungsi inti retraining, dipanggil dari thread background)
    df_all = load_all_sales_as_dataframe(db)
    daftar_lob = sorted(df_all["LOB"].dropna().unique())
    daftar_produk = sorted(df_all["KODE_PRODUK"].dropna().unique())

    # Siapkan split data untuk ALL, LOB, dan Per-Produk terlebih dahulu (cukup sekali)
    split_all = prepare_scope_split(df_all.copy(), min_rows=MIN_ROWS_PER_SCOPE)
    
    splits_lob = {}
    for lob in daftar_lob:
        s_lob = prepare_scope_split(df_all[df_all["LOB"] == lob].copy(), min_rows=MIN_ROWS_PER_SCOPE)
        if s_lob is not None:
            splits_lob[lob] = s_lob

    splits_produk = {}
    for kode_produk in daftar_produk:
        s_prod = prepare_scope_split(df_all[df_all["KODE_PRODUK"] == kode_produk].copy(), min_rows=MIN_ROWS_PER_PRODUK)
        if s_prod is not None:
            splits_produk[kode_produk] = s_prod

    if not splits_produk and split_all is None:
        raise HTTPException(
            status_code=400,
            detail="Data tidak cukup untuk melatih model (baik per-produk maupun global).",
        )

    # Nonaktifkan semua model lama di database
    db.query(Modelmetrics).update({Modelmetrics.is_active: False})
    semua_hasil: list[Modelmetrics] = []

    # Latih masing-masing dari 3 Algoritma dan bungkus ke dalam file _router.joblib
    for algo_name, (algo_key, make_model) in MODEL_CLASSES.items():
        start_time = time.time()

        bundle_algo = {
            "algorithm_label": algo_name,
            "features": FEATURES,
            "fallback_all": None,
            "fallback_lob": {},
            "products": {},
        }

        # Latih Model Fallback ALL
        if split_all is not None:
            m_all = make_model()
            m_all.fit(split_all["X_train"], split_all["y_train"])
            bundle_algo["fallback_all"] = {"model": m_all, "encoders": split_all["encoders"]}

        # Latih Model Fallback Per-LOB
        for lob, s_lob in splits_lob.items():
            m_lob = make_model()
            m_lob.fit(s_lob["X_train"], s_lob["y_train"])
            bundle_algo["fallback_lob"][lob] = {"model": m_lob, "encoders": s_lob["encoders"]}

        # Latih Model Utama Per-Produk & Kumpulkan Prediksi untuk Evaluasi Agregat
        all_y_true = []
        all_y_pred = []

        for kode_produk, s_prod in splits_produk.items():
            m_prod = make_model()
            m_prod.fit(s_prod["X_train"], s_prod["y_train"])
            
            y_pred_prod = np.maximum(0, m_prod.predict(s_prod["X_test"]))
            all_y_true.extend(s_prod["y_test"].tolist())
            all_y_pred.extend(y_pred_prod.tolist())

            bundle_algo["products"][kode_produk] = {"model": m_prod, "encoders": s_prod["encoders"], "smape": smape(s_prod["y_test"], y_pred_prod), "r2_score": float(r2_score(s_prod["y_test"], y_pred_prod)) if len(s_prod["y_test"]) > 1 else 0.0}

        elapsed = time.time() - start_time

        # Jika ada model produk yang berhasil dilatih, hitung metrik agregat dari seluruh prediksi produk
        if all_y_true:
            y_true_arr = np.asarray(all_y_true, dtype=float)
            y_pred_arr = np.asarray(all_y_pred, dtype=float)
        else:
            # Fallback jika hanya model ALL yang berhasil dilatih
            y_true_arr = np.asarray(split_all["y_test"], dtype=float)
            y_pred_arr = np.maximum(0, bundle_algo["fallback_all"]["model"].predict(split_all["X_test"]))

        mae = float(mean_absolute_error(y_true_arr, y_pred_arr))
        rmse = float(np.sqrt(mean_squared_error(y_true_arr, y_pred_arr)))
        mape_val = smape(y_true_arr, y_pred_arr)
        r2 = float(r2_score(y_true_arr, y_pred_arr))

        # Simpan bundle router (.joblib) ke folder ml/trained_models
        joblib.dump(bundle_algo, TRAINED_MODELS / router_filename(algo_key), compress=3)

        # Simpan 1 baris metrik utama per algoritma ke tabel Modelmetrics untuk UI
        semua_hasil.append(
            Modelmetrics(
                user_id=user_id,
                algorithm_name=algo_name,
                mae=mae,
                rmse=rmse,
                mape=mape_val,
                r2_score=r2,
                processing_time=elapsed,
                is_active=False,
                trained_at=datetime.now(),
            )
        )

    for m in semua_hasil:
        db.add(m)
    db.commit()
    for m in semua_hasil:
        db.refresh(m)

    clear_encoder_cache()

    return RetrainResponse(
        message=f"Retrain selesai: {len(splits_produk)} model per-produk (+ fallback {len(splits_lob)} LOB & ALL) berhasil dilatih untuk 3 algoritma.",
        hasil=[ModelMetricOut.model_validate(m) for m in semua_hasil],
    )


@router.post("/pilih-utama", response_model=PilihModelUtamaResponse)
def pilih_model_utama(
    payload: PilihModelUtamaRequest,
    db: Session = Depends(get_db),
):
    target = (
        db.query(Modelmetrics)
        .filter(Modelmetrics.metric_id == payload.metric_id)
        .first()
    )

    if target is None:
        raise HTTPException(
            status_code=404, detail="Baris model_metrics tidak ditemukan."
        )

    # Nonaktifkan semua model yang sebelumnya aktif
    db.query(Modelmetrics).update({Modelmetrics.is_active: False})

    # Aktifkan model yang dipilih
    target.is_active = True

    db.commit()
    db.refresh(target)

    # Generate forecast otomatis setelah model utama dipilih.
    try:
        forecast_result = generate_forecasts_for_all_products(
            db=db,
            active_model=target,
            horizon=6,
        )
    except Exception:
        db.rollback()
        raise

    return PilihModelUtamaResponse(
        message=f"Model '{target.algorithm_name}' sekarang aktif.",
        model_aktif=ModelMetricOut.model_validate(target),
    )


@router.get("/metrics", response_model=list[ModelMetricOut])
def get_latest_metrics(db: Session = Depends(get_db)):
    # Data untuk kartu MAE/RMSE/sMAPE/R2 & grafik di halaman Atur Prediksi
    algorithms = db.query(Modelmetrics.algorithm_name).distinct().all()

    hasil = []

    for (algo_name,) in algorithms:
        latest = (
            db.query(Modelmetrics)
            .filter(Modelmetrics.algorithm_name == algo_name)
            .order_by(Modelmetrics.trained_at.desc())
            .first()
        )

        if latest:
            hasil.append(latest)

    return [ModelMetricOut.model_validate(m) for m in hasil]


@router.get("/evaluation/products", response_model=list[ProductEvaluationOption])
def get_evaluated_products(
    db: Session = Depends(get_db),
    current_user=Depends(require_admin),
):
    """Daftar produk yang memiliki hasil evaluasi model per produk (khusus super_user)."""
    eval_map = _get_product_evaluation_map()
    db_products = db.query(Products).order_by(Products.product_code.asc()).all()
    db_lookup = {
        str(p.product_code).strip().upper(): p
        for p in db_products
        if p.product_code
    }

    # Gabungkan kode produk dari evaluasi dan database supaya seluruh 1.313 produk dapat dipilih
    all_codes = sorted(set(eval_map.keys()) | set(db_lookup.keys()))

    options: list[ProductEvaluationOption] = []
    for code in all_codes:
        prod = db_lookup.get(code)
        options.append(
            ProductEvaluationOption(
                product_code=code,
                product_name=getattr(prod, "product_name", None) if prod else None,
                lob=prod.lob if prod else None,
            )
        )
    return options


@router.get("/evaluation/product/{product_code}", response_model=ProductEvaluationResponse)
def get_product_evaluation(
    product_code: str,
    db: Session = Depends(get_db),
    current_user=Depends(require_admin),
):
    """Ambil hasil evaluasi 3 algoritma (MAE, RMSE, sMAPE, R2 Score) untuk 1 produk terpilih."""
    normalized_code = product_code.strip().upper()
    eval_map = _get_product_evaluation_map()
    metrics = eval_map.get(normalized_code, [])

    prod = (
        db.query(Products)
        .filter(Products.product_code == normalized_code)
        .first()
    )

    return ProductEvaluationResponse(
        product_code=normalized_code,
        product_name=getattr(prod, "product_name", None) if prod else None,
        lob=prod.lob if prod else None,
        metrics=metrics,
    )
