from datetime import datetime

from fastapi import HTTPException, APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.Product import Products
from app.schemas.Product import (ProductCreate, ProductUpdate, ProductResponse)
from app.dependencies.authorization import require_superuser

router = APIRouter(
    prefix="/api/products",
    tags=['Products'],
    dependencies=[Depends(require_superuser)]
)

# dapetin data semua produk
@router.get("", response_model=list[ProductResponse])
def get_products(
    db: Session = Depends(get_db)
):
    return(
        db.query(Products)
        .order_by(Products.product_id.asc())
        .all()
    )

# filter per produk id 
@router.get("/{product_id}", response_model=ProductResponse)
def get_product(
    product_id: int,
    db: Session = Depends(get_db)
):
    product = (
        db.query(Products)
        .filter(Products.product_id == product_id)
        .first()
    )

    if not product:
        raise HTTPException(
            status_code=404,
            detail="Product not found"
        )

    return product

# tambahin product baru
@router.post(
    "",
    response_model=ProductResponse,
    status_code=201
)
def create_product(
    product_data: ProductCreate,
    db: Session = Depends(get_db)
):
    existing_product = (
        db.query(Products)
        .filter(Products.product_code == product_data.product_code)
        .first()
    )

    if existing_product:
        raise HTTPException(
            status_code=400,
            detail="Product code already exists"
        )

    product = Products(
        product_code=product_data.product_code,
        product_name=product_data.product_name,
        lob=product_data.lob,
        lead_time=product_data.lead_time,
        created_at=datetime.now()
    )

    db.add(product)
    db.commit()
    db.refresh(product)

    return product

# update data produk
@router.put(
    "/{product_id}",
    response_model=ProductResponse
)
def update_product(
    product_id: int,
    product_data: ProductUpdate,
    db: Session = Depends(get_db)
):
    product = (
        db.query(Products)
        .filter(Products.product_id == product_id)
        .first()
    )

    if not product:
        raise HTTPException(
            status_code=404,
            detail="Kode produk tidak ditemukan"
        )

    if product_data.product_code is not None:
        existing_product = (
            db.query(Products)
            .filter(
                Products.product_code == product_data.product_code,
                Products.product_id != product_id
            )
            .first()
        )

        if existing_product:
            raise HTTPException(
                status_code=400,
                detail="Kode Produk sudah tersedia"
            )

        product.product_code = product_data.product_code

    if product_data.product_name is not None:
        product.product_name = product_data.product_name

    if product_data.lob is not None:
        product.lob = product_data.lob

    if product_data.lead_time is not None:
        product.lead_time = product_data.lead_time

    db.commit()
    db.refresh(product)

    return product

# buat hapus product 
@router.delete("/{product_id}")
def delete_product(
    product_id: int,
    db: Session = Depends(get_db)
):
    product = (
        db.query(Products)
        .filter(Products.product_id == product_id)
        .first()
    )

    if not product:
        raise HTTPException(
            status_code=404,
            detail="Kode Produk tidak ditemukan"
        )

    db.delete(product)
    db.commit()

    return {
        "message": "Product berhasil dihapus"
    }