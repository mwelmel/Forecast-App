from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.api.Prediction import get_router_bundle
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


def _normalize_sales_date(raw_date) -> date:
    d = raw_date.date() if hasattr(raw_date, "date") else raw_date
    if d.month == 1 and 1 <= d.day <= 12:
        return date(d.year, d.day, 1)
    return date(d.year, d.month, 1)


def _compute_accuracy(mape_val: float | None, r2_val: float | None = None) -> float | None:
    candidates: list[float] = []

    if mape_val is not None:
        try:
            m_val = float(mape_val)
            if 0 < m_val <= 1.0:
                m_val *= 100.0
            if 0 <= m_val < 100.0:
                candidates.append(100.0 - m_val)
        except (TypeError, ValueError):
            pass

    if r2_val is not None:
        try:
            r2 = float(r2_val)
            if 0.0 < r2 <= 1.0:
                candidates.append(r2 * 100.0)
        except (TypeError, ValueError):
            pass

    if candidates:
        return round(min(100.0, max(candidates)), 1)

    if mape_val is not None:
        try:
            m_val = float(mape_val)
            if 0 < m_val <= 1.0:
                m_val *= 100.0
            if m_val >= 100.0:
                norm = m_val / 100.0 if m_val > 1000 else m_val
                return round((100.0 / (100.0 + norm)) * 100.0, 1)
        except (TypeError, ValueError):
            pass

    return None


def _get_product_accuracy_map(algorithm_name: str | None) -> dict[str, float]:
    if not algorithm_name:
        return {}

    try:
        bundle = get_router_bundle(algorithm_name)
    except Exception:
        return {}

    result: dict[str, float] = {}
    products_dict = bundle.get("products", {})
    if isinstance(products_dict, dict):
        for code, info in products_dict.items():
            if isinstance(info, dict):
                acc = _compute_accuracy(info.get("smape"), info.get("r2_score"))
                if acc is not None:
                    result[code] = acc

    return result


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
        model_accuracy = _compute_accuracy(active_model.mape, active_model.r2_score)

    # Ambil seluruh data penjualan aktual dan normalisasi tanggal sesuai konvensi dataset (YYYY-01-MM -> YYYY-MM-01)
    actual_by_month: dict[tuple[int, int], float] = {}
    all_sales = (
        db.query(Sales_data.transaction_date, Sales_data.quantity_sold)
        .filter(Sales_data.transaction_date.isnot(None))
        .all()
    )
    for transaction_date, quantity in all_sales:
        norm_date = _normalize_sales_date(transaction_date)
        month = (norm_date.year, norm_date.month)
        actual_by_month[month] = actual_by_month.get(month, 0.0) + float(quantity or 0)

    if actual_by_month:
        max_yr, max_mo = max(actual_by_month.keys())
        anchor_date = date(max_yr, max_mo, 1)
    else:
        anchor_date = date.today().replace(day=1)

    historical_start = _month_start(anchor_date, -5)
    forecast_start = _month_start(anchor_date, 1)

    # ambil data prediksi milik model aktif
    predictions_by_month: dict[tuple[int, int], list[tuple[str, float]]] = {}
    if active_model is not None:
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

    # 6 bulan aktual terakhir
    hist_months = [
        (_month_start(anchor_date, offset).year, _month_start(anchor_date, offset).month)
        for offset in range(-5, 1)
    ]

    # 6 bulan prediksi ke depan (setelah anchor_date, atau 6 bulan prediksi masa depan yang tersedia)
    future_pred_keys = sorted(
        k for k in predictions_by_month.keys() if date(k[0], k[1], 1) > anchor_date
    )[:6]
    if not future_pred_keys:
        future_pred_keys = [
            (_month_start(anchor_date, offset).year, _month_start(anchor_date, offset).month)
            for offset in range(1, 7)
        ]

    monthly_sales = []
    for yr, mo in hist_months:
        key = (yr, mo)
        actual_val = actual_by_month.get(key)
        predicted_values = predictions_by_month.get(key)
        pred_val = (
            sum(quantity for _, quantity in predicted_values)
            if predicted_values is not None
            else None
        )
        monthly_sales.append(
            {
                "year": yr,
                "month": mo,
                "actual": actual_val if actual_val is not None else (0.0 if actual_by_month else None),
                "predicted": pred_val,
            }
        )

    for yr, mo in future_pred_keys:
        if (yr, mo) in hist_months:
            continue
        predicted_values = predictions_by_month.get((yr, mo))
        pred_val = (
            sum(quantity for _, quantity in predicted_values)
            if predicted_values is not None
            else None
        )
        monthly_sales.append(
            {
                "year": yr,
                "month": mo,
                "actual": None,
                "predicted": pred_val,
            }
        )

    # supaya di ApexCharts garis Aktual dan Prediksi menyambung tanpa celah patah
    if len(monthly_sales) >= 6 and monthly_sales[5]["actual"] is not None and monthly_sales[5]["predicted"] is None:
        if any(item["predicted"] is not None for item in monthly_sales[6:]):
            monthly_sales[5]["predicted"] = monthly_sales[5]["actual"]

    # Hitung proyeksi per produk dari bulan prediksi masa depan pertama yang tersedia
    future_months = [
        predictions_by_month[k]
        for k in future_pred_keys
        if k in predictions_by_month and predictions_by_month[k]
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

    # Produk Terlaris tetap diambil dari volume tertinggi
    highest_volume_products = sorted(
        demand_by_product.items(),
        key=lambda item: item[1],
        reverse=True,
    )
    best_seller = highest_volume_products[0][0] if highest_volume_products and highest_volume_products[0][1] > 0 else None
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

    # Ambil akurasi model per produk langsung dari bundle router (_router.joblib)
    product_accuracy_map = _get_product_accuracy_map(
        active_model.algorithm_name if active_model is not None else None
    )

    candidate_items: dict[str, float] = {
        code: qty for code, qty in demand_by_product.items() if qty > 0
    }
    if not candidate_items and future_months:
        # Jika di bulan pertama 0, cek rata-rata volume positif di horizon prediksi
        horizon_totals: dict[str, list[float]] = {}
        for month_vals in future_months:
            for code, qty in month_vals:
                if qty > 0:
                    horizon_totals.setdefault(code, []).append(qty)
        candidate_items = {
            code: round(sum(vals) / len(vals), 2)
            for code, vals in horizon_totals.items()
        }
    if not candidate_items:
        candidate_items = dict(demand_by_product)

    # Fallback jika tabel predictions masih kosong: gunakan produk di DB beserta akurasi modelnya dari router
    if not candidate_items and product_accuracy_map:
        recent_sales = (
            db.query(Products.product_code, func.sum(Sales_data.quantity_sold))
            .join(Sales_data, Sales_data.product_id == Products.product_id)
            .group_by(Products.product_code)
            .all()
        )
        for code, qty in recent_sales:
            if float(qty or 0) > 0:
                candidate_items[code] = float(qty or 0)

    scored_items = [
        {
            "product_code": product_code,
            "predicted_quantity": quantity,
            "model_accuracy": product_accuracy_map.get(product_code, model_accuracy),
        }
        for product_code, quantity in candidate_items.items()
    ]

    # Urutkan berdasarkan akurasi model tertinggi, lalu volume prediksi tertinggi
    scored_items.sort(
        key=lambda item: (
            item["model_accuracy"] if item["model_accuracy"] is not None else -1.0,
            item["predicted_quantity"],
        ),
        reverse=True,
    )

    top_demand = scored_items[:4]
    top_accuracy_item = top_demand[0] if top_demand else None

    return {
        "total_products": db.query(Products).count(),
        "model_accuracy": model_accuracy,
        "best_seller": best_seller,
        "top_accuracy_item": top_accuracy_item,
        "monthly_sales": monthly_sales,
        "top_demand": top_demand,
    }
