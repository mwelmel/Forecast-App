from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.core.database import get_db
from app.dependencies.authorization import get_current_user
from app.models.ModelMetric import Modelmetrics
from app.models.Prediction import Predictions
from app.models.Product import Products
from app.models.Sales import Sales_data

router = APIRouter(
    prefix="/api/dashboard",
    tags=["Dashboard"],
    dependencies=[Depends(get_current_user)],
)


def _month_start(current: date, offset: int) -> date:
    month_index = current.year * 12 + current.month - 1 + offset
    return date(month_index // 12, month_index % 12 + 1, 1) 


@router.get("/summary")
def get_dashboard_summary(db: Session = Depends(get_db)):
    # cari model aktif
    # Prioritaskan model aktif yang punya nilai MAPE valid (< 100)
    active_model = (
        db.query(Modelmetrics)
        .filter(Modelmetrics.is_active.is_(True))
        .order_by(Modelmetrics.metric_id.desc())
        .first()
    )
    if active_model is None:
        active_model = (
            db.query(Modelmetrics)
            .order_by(Modelmetrics.metric_id.desc())
            .first()
        )

    # Hitung model_accuracy dengan penanganan anomali MAPE
    model_accuracy = None
    if active_model is not None and active_model.mape is not None:
        mape_val = float(active_model.mape)

        if 0 < mape_val <= 1.0:
            mape_val *= 100.0

        if 0 <= mape_val < 100.0:
            # Normal: MAPE di bawah 100%
            model_accuracy = round(100.0 - mape_val, 1)
        elif mape_val >= 100.0:
            # Jika MAPE >= 100% (biasanya karena ada data aktual = 0 saat pembagian MAPE),
            model_accuracy = round((100.0 / (100.0 + (mape_val / 100.0 if mape_val > 1000 else mape_val))) * 100.0, 1)

    # gunain tgl transact trkhir sebagai acuan
    # agar grafik tidak kosong jika dataset bukan di bulan berjalan saat ini
    latest_sale_date = db.query(func.max(Sales_data.transaction_date)).scalar()
    if latest_sale_date is not None:
        anchor_date = (
            latest_sale_date.date()
            if hasattr(latest_sale_date, "date")
            else latest_sale_date
        )
    else:
        anchor_date = date.today()

    historical_start = _month_start(anchor_date, -5)
    forecast_start = _month_start(anchor_date, 1)
    forecast_end = _month_start(anchor_date, 7)

    # ambil data penjualan aktual
    actual_by_month: dict[tuple[int, int], float] = {}
    sales = (
        db.query(Sales_data.transaction_date, Sales_data.quantity_sold)
        .filter(
            Sales_data.transaction_date >= historical_start,
            Sales_data.transaction_date < forecast_start,
        )
        .all()
    )
    for transaction_date, quantity in sales:
        month = (transaction_date.year, transaction_date.month)
        actual_by_month[month] = actual_by_month.get(month, 0.0) + float(quantity or 0)

    # ambil data prediksi dari bulan berjalan
    predictions_by_month: dict[tuple[int, int], list[tuple[str, float]]] = {}
    if active_model is not None:
        predictions = (
            db.query(
                Predictions.prediction_period,
                Products.product_code,
                Predictions.predicted_quantity,
            )
            .join(Products, Predictions.product_id == Products.product_id)
            .filter(
                Predictions.metric_id == active_model.metric_id,
                # Ambil dari historical_start agar jika ada prediksi di bulan berjalan/historis tetap tergambar
                Predictions.prediction_period >= historical_start,
                Predictions.prediction_period < forecast_end,
            )
            .order_by(Predictions.prediction_period.asc())
            .all()
        )

        # ambil semua prediksi milik active_model agar grafik tidak kosong
        if not predictions:
            predictions = (
                db.query(
                    Predictions.prediction_period,
                    Products.product_code,
                    Predictions.predicted_quantity,
                )
                .join(Products, Predictions.product_id == Products.product_id)
                .filter(Predictions.metric_id == active_model.metric_id)
                .order_by(Predictions.prediction_period.asc())
                .all()
            )

        for period, product_code, quantity in predictions:
            month = (period.year, period.month)
            predictions_by_month.setdefault(month, []).append(
                (product_code, float(quantity or 0))
            )

    monthly_sales = []
    for offset in range(-5, 7):
        period = _month_start(anchor_date, offset)
        key = (period.year, period.month)
        predicted_values = predictions_by_month.get(key)
        actual_val = actual_by_month.get(key)
        pred_val = (
            sum(quantity for _, quantity in predicted_values)
            if predicted_values is not None
            else None
        )

        monthly_sales.append(
            {
                "year": period.year,
                "month": period.month,
                # Jika bulan historis tidak ada transaksi, tampilkan 0 bukan none
                "actual": actual_val if actual_val is not None else (0.0 if offset <= 0 and actual_by_month else None),
                "predicted": pred_val,
            }
        )

    # supaya di ApexCharts garis Aktual dan Prediksi menyambung tanpa celah patah
    if monthly_sales[5]["actual"] is not None and monthly_sales[5]["predicted"] is None:
        if any(item["predicted"] is not None for item in monthly_sales[6:]):
            monthly_sales[5]["predicted"] = monthly_sales[5]["actual"]

    # Hitung Top Demand dari bulan prediksi pertama yang tersedia
    future_months = [
        values
        for (yr, mo), values in sorted(predictions_by_month.items())
        if date(yr, mo, 1) >= forecast_start and values
    ]
    if not future_months:
        future_months = [
            values for _, values in sorted(predictions_by_month.items()) if values
        ]

    first_forecast_month = future_months[0] if future_months else []
    demand_by_product: dict[str, float] = {}
    for product_code, quantity in first_forecast_month:
        demand_by_product[product_code] = (
            demand_by_product.get(product_code, 0.0) + quantity
        )

    top_demand = [
        {
            "product_code": product_code,
            "predicted_quantity": quantity,
        }
        for product_code, quantity in sorted(
            demand_by_product.items(),
            key=lambda item: item[1],
            reverse=True,
        )[:4]
    ]

    # workaround Produk Terlaris: jika belum ada prediksi, ambil dari histori penjualan tertinggi
    best_seller = top_demand[0]["product_code"] if top_demand else None
    if best_seller is None:
        top_actual_product = (
            db.query(Products.product_code)
            .join(Sales_data, Sales_data.product_id == Products.product_id)
            .group_by(Products.product_code)
            .order_by(func.sum(Sales_data.quantity_sold).desc())
            .first()
        )
        if top_actual_product:
            best_seller = top_actual_product[0]

    return {
        "total_products": db.query(Products).count(),
        "model_accuracy": model_accuracy,
        "best_seller": best_seller,
        "monthly_sales": monthly_sales,
        "top_demand": top_demand,
    }
