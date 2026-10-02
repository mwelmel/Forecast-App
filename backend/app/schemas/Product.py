from pydantic import BaseModel
from datetime import datetime

class ProductCreate(BaseModel):
    product_code: str
    product_name: str | None = None 
    lob: str
    lead_time: int

class ProductUpdate(BaseModel):
    product_code: str | None = None 
    product_name: str | None = None 
    lob: str | None = None 
    lead_time: int | None = None 

class ProductResponse(BaseModel):
    product_id: int 
    product_code: str
    product_name: str | None = None
    lob: str | None = None 
    lead_time: int | None = None
    created_at: datetime

    class Config:
        from_attributes = True 