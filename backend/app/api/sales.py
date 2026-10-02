from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from sqlalchemy.orm import Session
from datetime import datetime, timezone
import pandas as pd 

from app.core.database import get_db
from app.models.Sales import Sales_data

router = APIRouter(
    prefix="/api/sales",
    tags=['Sales']
)

@router.post("/upload")
async def upload_sales_excel(
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    upload_time = datetime.now(timezone.utc)

    #validate filenya excel 
    if not file.filename.endswith((".xlsx",".xls")):
        raise HTTPException(
            status_code=400,
            detail="File harus berupa file excel"
        )

    try:
        # baca file excelnya buat validasi udh sesuai apa engga
        contents = await file.read()

        from io import BytesIO
        df = pd.read_excel(BytesIO(contents))

    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"gagal membaca file excel: {str(e)}"
        )

    #validasi kolom yang harus ada 
    required_columns = [
        "KODE_PRODUK",
        # "LOB",
        # "LEAD_TIME",
        "PERIOD_MO",
        "SALES_QTY"
    ]

    missing_columns = [
        col for col in required_columns
        if col not in df.columns
    ]

    if missing_columns:
        raise HTTPException(
            status_code=400,
            detail=f"Kolom tidak ditemukan:{missing_columns}"
        )

    # pastikan qty numerik
    df["SALES_QTY"] = pd.to_numeric(
        df['SALES_QTY'],
        errors="coerce"
    )

    df = df.dropna(subset=['SALES_QTY'])

    #masukkin ke db 
    records = []

    for _, row in df.iterrows():
        sales = Sales_data(
            product_id=int(row['KODE_PRODUK']),
            transaction_date=row["PERIOD_MO"],
            quantity_sold=int(row['SALES_QTY']),
            uploaded_at=upload_time
        )

        records.append(sales)

    db.add_all(records)
    db.commit()

    return {
        "message": "File Excel berhasil diupload",
        "filename": file.filename,
        "total_rows": len(records)
    }

@router.get("/history")
def get_upload_history(
    db: Session = Depends(get_db)
):
    upload_times = (
        db.query(Sales_data.uploaded_at)
        .distinct()
        .order_by(Sales_data.uploaded_at.desc())
        .all()
    )

    return [
        {
            "uploaded_at": upload_time[0],
            "status": "Berhasil"
        }
        for upload_time in upload_times
    ]