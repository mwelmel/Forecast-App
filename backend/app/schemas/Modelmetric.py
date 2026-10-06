from pydantic import BaseModel
from datetime import datetime

class ModelMetricOut(BaseModel):
    metric_id: int
    algorithm_name: str
    lob: str
    mae: float
    rmse: float
    mape: float
    r2_score: float
    processing_time: float
    train_rows_count: int
    is_active: bool
    trained_at: datetime

    class Config:
        from_attributes = True

class RetrainResponse(BaseModel):
    message: str
    hasil: list[ModelMetricOut]

class PilihModelUtamaRequest(BaseModel):
     metric_id: int #buat aktifin model yang diaktifin

class PilihModelUtamaResponse(BaseModel):
    message: str
    model_aktif: ModelMetricOut