from pathlib import Path

import joblib 
import pandas as pd
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.ModelMetric import Modelmetrics
from app.models.Product import Products
from app.models.Sales import Sales_data
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
 
    return PredictionResponse(
        product_code=payload.product_code,
        algorithm_used=f"{active_model.algorithm_name} ({'model umum' if scope == GENERAL_SCOPE else f'LOB {scope}'})",
        forecast=forecast,
    )