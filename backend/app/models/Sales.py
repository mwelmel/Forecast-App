from sqlalchemy import Integer,String,Date,DateTime, Column, ForeignKey
from app.core.database import Base 

# table sales data tempat nerima data mapping excel
class Sales_data(Base):
    __tablename__ = "sales_data"
    sales_id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.product_id"))
    transaction_date = Column(Date, nullable=False)
    quantity_sold = Column(Integer, nullable=False)
    uploaded_at = Column(DateTime, nullable=False)
