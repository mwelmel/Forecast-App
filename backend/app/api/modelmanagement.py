import time
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

from app.core.database import get_db
from app.dependencies.authorization import get_current_user

from app.models.ModelMetric import Modelmetrics
from app.models.Product import Products
from app.models.Sales import Sales_data
from app.api.Prediction import clear_encoder_cache, generate_forecasts_for_all_products
from app.schemas.Modelmetric import (
    ModelMetricOut,
    PilihModelUtamaRequest,
    PilihModelUtamaResponse,
    RetrainResponse,
)
from ml.feature_engineering import build_features, FEATURES, TARGET

router = APIRouter(prefix="/model", tags=["Atur Prediksi & Model"])

# ML_DIR = Path(__file__).resolve().parents[2] / "ml"
NOTEBOOKS_DIR = Path(__file__).resolve().parents[2] /"ml"/ "notebooks"
TRAINED_MODELS = NOTEBOOKS_DIR / "trained_models"
TRAINED_MODELS.mkdir(parents=True, exist_ok=True)

GENERAL_SCOPE = "ALL"
MIN_ROWS_PER_SCOPE = 50  # ambang minimal baris supaya scope dapat dilatih
MIN_ROWS_PER_PRODUK = 10 # ambang minimal baris supaya produk  dapat dilatih 


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

    return pd.DataFrame(
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

@router.post("/retrain", response_model=RetrainResponse)
def retrain_model(db: Session = Depends(get_db), current_user=Depends(require_admin)):
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

            bundle_algo["products"][kode_produk] = {"model": m_prod, "encoders": s_prod["encoders"]}

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
                user_id=current_user.user_id,
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
