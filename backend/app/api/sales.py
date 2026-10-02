from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from sqlalchemy.orm import Session
from datetime import datetime, timezone, date
from io import BytesIO
import pandas as pd 

from app.core.database import get_db
from app.models.Sales import Sales_data
from app.models.Product import Products

router = APIRouter(
    prefix="/api/sales",
    tags=['Sales']
)


def _parse_period_mo(value) -> date:
    # Sudah datetime / Timestamp
    if isinstance(value, (datetime, pd.Timestamp)):
        return value.date()
    if isinstance(value, date):
        return value

    # Numerik format YYYYMM (misal 202301)
    if isinstance(value, (int, float)):
        s = str(int(value))
        if len(s) == 6:  # YYYYMM
            return date(int(s[:4]), int(s[4:6]), 1)
        # mungkin YYYYMMDD
        if len(s) == 8:
            return date(int(s[:4]), int(s[4:6]), int(s[6:8]))

    # String - coba beberapa format umum
    s = str(value).strip()
    for fmt in ("%Y-%m-%d", "%Y-%m", "%Y%m", "%d/%m/%Y", "%m/%Y",
                "%b-%Y", "%B-%Y", "%b %Y", "%B %Y", "%Y/%m/%d"):
        try:
            return datetime.strptime(s, fmt).date()
        except ValueError:
            continue

    # Fallback: pandas parser
    try:
        return pd.to_datetime(s).date()
    except Exception:
        raise ValueError(f"Format PERIOD_MO tidak dikenali: '{value}'")


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
            detail=f"Kolom tidak ditemukan: {missing_columns}"
        )

    # pastikan qty numerik
    df["SALES_QTY"] = pd.to_numeric(
        df['SALES_QTY'],
        errors="coerce"
    )

    df = df.dropna(subset=['SALES_QTY'])

    if df.empty:
        raise HTTPException(
            status_code=400,
            detail="Tidak ada baris data valid (SALES_QTY semua kosong/tidak numerik)."
        )

    # Ambil mapping product_code -> product_id dari DB
    unique_codes = df["KODE_PRODUK"].astype(str).unique().tolist()
    products_in_db = (
        db.query(Products.product_id, Products.product_code)
        .filter(Products.product_code.in_(unique_codes))
        .all()
    )
    code_to_id = {p.product_code: p.product_id for p in products_in_db}

    # Cek kode produk yang tidak ditemukan di DB
    unknown_codes = [c for c in unique_codes if c not in code_to_id]
    if unknown_codes:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Kode produk berikut tidak ditemukan di database: {unknown_codes}. "
                "Pastikan produk sudah ditambahkan di halaman Master Produk terlebih dahulu."
            )
        )

    #masukkin ke db 
    records = []
    parse_errors = []

    for idx, row in df.iterrows():
        # Parse tanggal
        try:
            parsed_date = _parse_period_mo(row["PERIOD_MO"])
        except ValueError as e:
            parse_errors.append(f"Baris {idx + 2}: {e}")
            continue

        # Resolve product_id dari KODE_PRODUK
        product_code_str = str(row["KODE_PRODUK"])
        product_id = code_to_id[product_code_str]

        sales = Sales_data(
            product_id=product_id,
            transaction_date=parsed_date,
            quantity_sold=int(row['SALES_QTY']),
            uploaded_at=upload_time
        )

        records.append(sales)

    if parse_errors:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Gagal mem-parse tanggal pada {len(parse_errors)} baris: "
                + "; ".join(parse_errors[:10])
                + ("..." if len(parse_errors) > 10 else "")
            )
        )

    if not records:
        raise HTTPException(
            status_code=400,
            detail="Tidak ada data valid untuk diupload setelah validasi."
        )

    try:
        db.add_all(records)
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Gagal menyimpan data ke database: {str(e)}"
        )

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