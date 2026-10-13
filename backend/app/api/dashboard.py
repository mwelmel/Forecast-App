from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

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
    today = date.today()
    historical_start = _month_start(today, -5)
    forecast_start = _month_start(today, 1)
    forecast_end = _month_start(today, 7)

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
        actual_by_month[month] = actual_by_month.get(month, 0) + quantity

    active_model = (
        db.query(Modelmetrics).filter(Modelmetrics.is_active.is_(True)).first()
    )
    model_accuracy = (
        max(0.0, min(100.0, 100.0 - float(active_model.mape)))
        if active_model is not None
        else None
    )

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
                Predictions.prediction_period >= forecast_start,
                Predictions.prediction_period < forecast_end,
            )
            .order_by(Predictions.prediction_period.asc())
            .all()
        )
        for period, product_code, quantity in predictions:
            month = (period.year, period.month)
            predictions_by_month.setdefault(month, []).append(
                (product_code, float(quantity))
            )

    monthly_sales = []
    for offset in range(-5, 7):
        period = _month_start(today, offset)
        key = (period.year, period.month)
        predicted_values = predictions_by_month.get(key)
        monthly_sales.append(
            {
                "year": period.year,
                "month": period.month,
                "actual": actual_by_month.get(key),
                "predicted": (
                    sum(quantity for _, quantity in predicted_values)
                    if predicted_values is not None
                    else None
                ),
            }
        )

    first_forecast_month = next(
        (values for values in predictions_by_month.values() if values),
        [],
    )
    demand_by_product: dict[str, float] = {}
    for product_code, quantity in first_forecast_month:
        demand_by_product[product_code] = (
            demand_by_product.get(product_code, 0) + quantity
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

    return {
        "total_products": db.query(Products).count(),
        "model_accuracy": model_accuracy,
        "best_seller": top_demand[0]["product_code"] if top_demand else None,
        "monthly_sales": monthly_sales,
        "top_demand": top_demand,
    }
