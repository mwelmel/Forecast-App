from pydantic import BaseModel, Field

class PredictionRequest(BaseModel):
    product_code: str
    horizon : int = Field(default=6, ge=1, le=6) #buat rolling 6 bulan kedepan

class ForecastMonth(BaseModel):
    tahun: int
    bulan: int 
    predicted_quantity: float

class PredictionResponse(BaseModel):
    product_code: str
    algorithm_used: str
    forecast: list[ForecastMonth]