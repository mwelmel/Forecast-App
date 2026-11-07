from pydantic import BaseModel
from datetime import datetime

class ModelMetricOut(BaseModel):
    metric_id: int
    algorithm_name: str
    # lob: str
    mae: float
    rmse: float
    mape: float
    r2_score: float
    processing_time: float
    # train_rows_count: int
    is_active: bool
    trained_at: datetime

    class Config:
        from_attributes = True

class RetrainResponse(BaseModel):
    message: str
    hasil: list[ModelMetricOut]

class RetrainStatusResponse(BaseModel):
    job_id: str | None = None
    status: str  # idle | running | success | failed
    started_at: datetime | None = None
    finished_at: datetime | None = None
    duration_seconds: float | None = None  # durasi total (diisi saat selesai)
    elapsed_seconds: float | None = None   # lama berjalan (diukur di backend)
    message: str | None = None
    hasil: list[ModelMetricOut] = []

class PilihModelUtamaRequest(BaseModel):
     metric_id: int #buat aktifin model yang diaktifin

class PilihModelUtamaResponse(BaseModel):
    message: str
    model_aktif: ModelMetricOut

class ProductEvaluationOption(BaseModel):
    product_code: str
    product_name: str | None = None
    lob: str | None = None

class ProductMetricItem(BaseModel):
    algorithm_name: str
    mae: float
    rmse: float
    smape: float
    r2_score: float
    train_rows: int | None = None
    test_rows: int | None = None

class ProductEvaluationResponse(BaseModel):
    product_code: str
    product_name: str | None = None
    lob: str | None = None
    metrics: list[ProductMetricItem]

class ProductEvaluationOption(BaseModel):
    product_code: str
    product_name: str | None = None
    lob: str | None = None

class ProductMetricItem(BaseModel):
    algorithm_name: str
    mae: float
    rmse: float
    smape: float
    r2_score: float
    train_rows: int | None = None
    test_rows: int | None = None

class ProductEvaluationResponse(BaseModel):
    product_code: str
    product_name: str | None = None
    lob: str | None = None
    metrics: list[ProductMetricItem]
