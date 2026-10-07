from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.api.auth import router as auth_router
from app.api.users import router as users_router
from app.api.sales import router as sales_router
from app.api.product import router as product_router
from app.api.Prediction import router as prediction_router
from app.api.modelmanagement import router as model_router

app = FastAPI(
    title="Sales Forecasting API",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router) #authentication router
app.include_router(users_router) #edit data user router
app.include_router(sales_router) #upload excel router
app.include_router(product_router) # Data Product router
app.include_router(prediction_router) # Prediksi router
app.include_router(model_router) #model atur prediksi router

@app.get("/")
def root():
    return {
        "message": "Sales Forecasting API is running"
    }

# @app.get("/test-db")
# def test_database(db: Session = Depends(get_db)):
#     result = db.execute(text("SELECT 1"))
    
#     return {
#         "database": "connected",
#         "result": result.scalar()
#     }
