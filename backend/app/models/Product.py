from sqlalchemy import Integer,String,DateTime, Column
from app.core.database import Base 

# table product
class Products(Base):
    __tablename__ = "products"
    product_id = Column(Integer, primary_key=True, index=True)
    product_code = Column(String(100), nullable=False)
    product_name = Column(String(100), nullable=True)
    lob = Column("LOB", String(50), nullable=False)
    lead_time = Column(Integer, nullable=False)
    created_at = Column(DateTime, nullable=False)
