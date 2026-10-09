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
from ml.feature_engineering import build_features, save_encoders, FEATURES, TARGET

router = APIRouter(prefix="/model", tags=["Atur Prediksi & Model"])

ML_DIR = Path(__file__).resolve().parents[2] / "ml"
TRAINED_MODELS = ML_DIR / "trained_models"
TRAINED_MODELS.mkdir(parents=True, exist_ok=True)

GENERAL_SCOPE = "ALL"


# MODEL_CLASSES = {
#     "random_forest": lambda: RandomForestRegressor(n_estimators=300, random_state=42, n_jobs=-1),
#     "extra_trees": lambda: ExtraTreesRegressor(n_estimators=300, random_state=42, n_jobs=-1),
#     "gradient_boosting": lambda: GradientBoostingRegressor(
#         n_estimators=300, learning_rate=0.05, max_depth=3, random_state=42
#     ),
# }
MODEL_CLASSES = {
    "Random Forest Regression": ("random_forest", lambda: RandomForestRegressor(
        n_estimators= 100, random_state=42, min_samples_split= 5, min_samples_leaf= 2, max_features= 'log2', max_depth= 10)),
    "Extra Trees Regression": ("extra_trees", lambda: ExtraTreesRegressor(
        n_estimators= 100, random_state=42,min_samples_split= 5, min_samples_leaf= 2, max_features= 'log2', max_depth= 10)),
    "Gradient Boosting Regression": ("gradient_boosting", lambda: GradientBoostingRegressor(
        subsample= 0.6, n_estimators= 300, random_state=42,min_samples_split= 10, min_samples_leaf= 1, max_depth= 2, learning_rate= 0.03)),
}
 
MIN_ROWS_PER_SCOPE = 50  # ambang minimal baris supaya scope dapat dilatih
 
 
def model_filename(algorithm_name: str, lob: str) -> str:
    return f"{algorithm_name}_{lob}.joblib"
 
 
def encoder_filename(lob: str) -> str:
    return f"encoders_{lob}.joblib"
 
 
def require_admin(current_user=Depends(get_current_user)):
    if current_user.role not in ("admin", "super_user"):
        raise HTTPException(status_code=403, detail="Hanya super user yang dapat melakukan aksi ini.")
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
        raise HTTPException(status_code=400, detail="Belum ada data penjualan di database untuk dilatih.")
 
    return pd.DataFrame([{
        "KODE_PRODUK": product.product_code,
        "LOB": product.lob,
        "LEAD_TIME": product.lead_time,
        "PERIOD_MO": sales.transaction_date,
        "SALES_QTY": sales.quantity_sold,
    } for sales, product in rows])
 
 
def train_one_scope(df_scope: pd.DataFrame, lob: str, user_id: int) -> list[Modelmetrics]:
    df_model, encoders = build_features(df_scope, fit=True, verbose=False)
    df_model = df_model.sort_values("PERIOD_MO").reset_index(drop=True)
 
    if len(df_model) < MIN_ROWS_PER_SCOPE:
        return []  # data scope ini terlalu sedikit, dilewati (bukan error fatal)
 
    unique_periods = sorted(df_model["PERIOD_MO"].unique())
    if len(unique_periods) < 2:
        return []
    cutoff_date = unique_periods[int(len(unique_periods) * 0.8)]
    train_df = df_model[df_model["PERIOD_MO"] < cutoff_date]
    test_df = df_model[df_model["PERIOD_MO"] >= cutoff_date]
    if len(train_df) == 0 or len(test_df) == 0:
        return []
 
    X_train, y_train = train_df[FEATURES], train_df[TARGET]
    X_test, y_test = test_df[FEATURES], test_df[TARGET]
 
    metrics_rows = []
    for algo_name, make_model in MODEL_CLASSES.items():
        start = time.time()
        model = make_model()
        model.fit(X_train, y_train)
        elapsed = time.time() - start
 
        y_pred = model.predict(X_test)
        mae = mean_absolute_error(y_test, y_pred)
        rmse = float(np.sqrt(mean_squared_error(y_test, y_pred)))
        mape_val = smape(y_test, y_pred)
        r2 = r2_score(y_test, y_pred)
 
        joblib.dump(model, TRAINED_MODELS / model_filename(algo_name, lob))
 
        metrics_rows.append(Modelmetrics(
            user_id=user_id,
            algorithm_name=algo_name,
            # lob=lob,
            mae=float(mae),
            rmse=rmse,
            mape=mape_val,
            r2_score=float(r2),
            processing_time=elapsed,
            # train_rows_count=len(train_df),
            is_active=False,
            trained_at=datetime.now(),
        ))
 
    save_encoders(encoders, TRAINED_MODELS / encoder_filename(lob))
    return metrics_rows
 
 
@router.post("/retrain", response_model=RetrainResponse)
def retrain_model(db: Session = Depends(get_db), current_user=Depends(require_admin)):
    df_all = load_all_sales_as_dataframe(db)
    daftar_lob = sorted(df_all["LOB"].dropna().unique())
 
    db.query(Modelmetrics).update({Modelmetrics.is_active: False})
 
    semua_hasil: list[Modelmetrics] = []
 
    # 1. Model UMUM (dilatih dari seluruh data, lintas LOB)
    semua_hasil += train_one_scope(df_all.copy(), lob=GENERAL_SCOPE, user_id=current_user.user_id)
 
    # 2. Model PER LOB
    for lob in daftar_lob:
        df_lob = df_all[df_all["LOB"] == lob].copy()
        hasil_lob = train_one_scope(df_lob, lob=lob, user_id=current_user.user_id)
        if not hasil_lob:
            # LOB ini datanya belum cukup untuk dilatih -- dilewati, tapi dicatat di log server, bukan meng-gagalkan seluruh retrain.
            print(f"[retrain] LOB '{lob}' dilewati: data tidak cukup.")
        semua_hasil += hasil_lob
 
    if not semua_hasil:
        db.rollback()
        raise HTTPException(status_code=400, detail="Tidak ada scope (umum maupun per LOB) yang berhasil dilatih.")
 
    for m in semua_hasil:
        db.add(m)
    db.commit()
    for m in semua_hasil:
        db.refresh(m)
 
    clear_encoder_cache()  # supaya encoder baru (termasuk produk baru) langsung terpakai
 
    return RetrainResponse(
        message=f"Retrain selesai: 1 model umum + {len(daftar_lob)} LOB x 3 algoritma "
                f"({len(semua_hasil)} baris metrik baru).",
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
            status_code=404,
            detail="Baris model_metrics tidak ditemukan."
        )

    # Nonaktifkan semua model yang sebelumnya aktif
    db.query(Modelmetrics).update({
        Modelmetrics.is_active: False
    })

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
    # Data untuk kartu MAE/RMSE/sMAPE/R2 & grafik di halaman Atur Prediksi.
    algorithms = (
        db.query(Modelmetrics.algorithm_name)
        .distinct()
        .all()
    )

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