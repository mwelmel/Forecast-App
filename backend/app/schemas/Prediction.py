from pydantic import BaseModel, Field

class PredictionProduct(BaseModel):
    product_code: str
    product_name: str | None = None
    lob: str

    class Config:
        from_attributes = True


class PredictionRequest(BaseModel):
    product_code: str
    horizon: int = Field(default=6, ge=1, le=6)

class ForecastMonth(BaseModel):
    tahun: int
    bulan: int 
    predicted_quantity: float

class PredictionResponse(BaseModel):
    product_code: str
    algorithm_used: str
    forecast: list[ForecastMonth]