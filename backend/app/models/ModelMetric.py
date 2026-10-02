from sqlalchemy import Integer, String, Float, Boolean, DateTime, Column, ForeignKey
from app.core.database import Base

# table model metric
class Modelmetrics(Base):
    __tablename__ = "modelmetrics"
    metric_id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.user_id"))
    algorithm_name = Column(String, nullable=False)
    mae = Column(Float, nullable=False)
    rmse = Column(Float, nullable=False)
    mape = Column(Float, nullable=False)
    r2_score = Column(Float, nullable=False)
    processing_time = Column(Float, nullable=False)
    is_active = Column(Boolean, nullable=False)
    trained_at = Column(DateTime, nullable=False)