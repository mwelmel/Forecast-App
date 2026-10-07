from sqlalchemy import Integer, DateTime, Float, Column, ForeignKey
from app.core.database import Base 

# table prediction
class Predictions(Base):
    __tablename__ = "predictions"
    prediction_id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.product_id"))
    metric_id = Column(Integer, ForeignKey("modelmetrics.metric_id"))
    prediction_period = Column(DateTime, nullable=False)
    predicted_quantity = Column(Float, nullable=False)
    actual_quantity = Column(Float, nullable=True)
    created_at = Column(DateTime, nullable=False)
