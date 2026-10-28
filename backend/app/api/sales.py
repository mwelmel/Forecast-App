from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from fastapi.responses import StreamingResponse
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


def _normalize_to_dataset_date(d: date) -> date:
    # normalisasi data agar selaras dengan feature engineering dan training model
    if d.month != 1 and d.day == 1:
        return date(d.year, 1, d.month)
    return d


def _parse_period_mo(value) -> date:
    # Sudah datetime / Timestamp
    if isinstance(value, (datetime, pd.Timestamp)):
        return _normalize_to_dataset_date(value.date())
    if isinstance(value, date):
        return _normalize_to_dataset_date(value)

    # Numerik format YYYYMM (misal 202301)
    if isinstance(value, (int, float)):
        s = str(int(value))
        if len(s) == 6:  # YYYYMM
            return date(int(s[:4]), 1, int(s[4:6]))
        # mungkin YYYYMMDD
        if len(s) == 8:
            return _normalize_to_dataset_date(date(int(s[:4]), int(s[4:6]), int(s[6:8])))

    # String - coba beberapa format umum
    s = str(value).strip()
    for fmt in ("%Y-%m-%d", "%Y-%m", "%Y%m", "%d/%m/%Y", "%m/%Y",
                "%b-%Y", "%B-%Y", "%b %Y", "%B %Y", "%Y/%m/%d"):
        try:
            return _normalize_to_dataset_date(datetime.strptime(s, fmt).date())
        except ValueError:
            continue

    # Fallback: pandas parser
    try:
        return _normalize_to_dataset_date(pd.to_datetime(s).date())
    except Exception:
        raise ValueError(f"Format PERIOD_MO tidak dikenali: '{value}'")


@router.get("/template")
def download_sales_template():
    sample_df = pd.DataFrame([
        {
            "KODE_PRODUK": "PRD0001",
            "LOB": "2LPCM",
            "LEAD_TIME": 97,
            "PERIOD_MO": "2025-01-01",
            "SALES_QTY": 804,
        },
        {
            "KODE_PRODUK": "PRD0002",
            "LOB": "2VIOS",
            "LEAD_TIME": 60,
            "PERIOD_MO": "2025-01-01",
            "SALES_QTY": 24924,
        },
        {
            "KODE_PRODUK": "PRD0003",
            "LOB": "2HBLE",
            "LEAD_TIME": 120,
            "PERIOD_MO": "2025-01-02",
            "SALES_QTY": 15288,
        },
    ])

    guide_df = pd.DataFrame([
        {
            "Nama Kolom": "KODE_PRODUK",
            "Wajib": "Ya",
            "Contoh": "PRD0001",
            "Keterangan": "Kode produk yang sudah terdaftar pada menu Data Produk.",
        },
        {
            "Nama Kolom": "LOB",
            "Wajib": "Opsional",
            "Contoh": "2LPCM",
            "Keterangan": "Unit bisnis (Line of Business) produk.",
        },
        {
            "Nama Kolom": "LEAD_TIME",
            "Wajib": "Opsional",
            "Contoh": "97",
            "Keterangan": "Waktu tunggu produk dalam hari (angka bulat).",
        },
        {
            "Nama Kolom": "PERIOD_MO",
            "Wajib": "Ya",
            "Contoh": "2025-01-01 atau 2025-01",
            "Keterangan": "Periode bulan penjualan (format YYYY-01-MM sesuai dataset atau YYYY-MM).",
        },
        {
            "Nama Kolom": "SALES_QTY",
            "Wajib": "Ya",
            "Contoh": "804",
            "Keterangan": "Jumlah unit terjual pada periode tersebut (angka).",
        },
    ])

    buffer = BytesIO()
    with pd.ExcelWriter(buffer, engine="openpyxl") as writer:
        sample_df.to_excel(writer, index=False, sheet_name="Data Penjualan")
        guide_df.to_excel(writer, index=False, sheet_name="Petunjuk Pengisian")

        for sheet_name in writer.sheets:
            ws = writer.sheets[sheet_name]
            for col_cells in ws.columns:
                max_len = max(len(str(cell.value or "")) for cell in col_cells)
                ws.column_dimensions[col_cells[0].column_letter].width = max(max_len + 4, 14)

    buffer.seek(0)
    return StreamingResponse(
        buffer,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": 'attachment; filename="template_data_penjualan.xlsx"'
        },
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