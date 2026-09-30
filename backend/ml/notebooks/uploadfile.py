from pathlib import Path
import sys
import os

import pandas as pd
from sqlalchemy import create_engine, text
from dotenv import load_dotenv


# ============================================================
# 1. SETUP PATH
# ============================================================

# Lokasi folder ml/
ML_DIR = Path(__file__).resolve().parent.parent

# Lokasi file Excel
EXCEL_FILE = ML_DIR / "data" / "raw" / "datarofo.xlsx"

# Lokasi .env
BACKEND_DIR = ML_DIR.parent
load_dotenv(BACKEND_DIR / ".env")


# ============================================================
# 2. AMBIL DATABASE URL
# ============================================================

DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    raise Exception("DATABASE_URL tidak ditemukan di file .env")


# ============================================================
# 3. CEK FILE EXCEL
# ============================================================

if not EXCEL_FILE.exists():
    raise FileNotFoundError(
        f"File Excel tidak ditemukan:\n{EXCEL_FILE}"
    )

print("=" * 50)
print("IMPORT PRODUCT DATA")
print("=" * 50)
print(f"File Excel : {EXCEL_FILE}")


# ============================================================
# 4. BACA EXCEL
# ============================================================

df = pd.read_excel(EXCEL_FILE)

print("\nKolom Excel:")
print(df.columns.tolist())


# ============================================================
# 5. NORMALISASI NAMA KOLOM
# ============================================================

df.columns = (
    df.columns
    .astype(str)
    .str.strip()
    .str.lower()
)


# ============================================================
# 6. VALIDASI KOLOM
# ============================================================

required_columns = [
    "kode_produk",
    "lob",
    "lead_time"
]

missing_columns = [
    column
    for column in required_columns
    if column not in df.columns
]

if missing_columns:
    raise ValueError(
        f"Kolom berikut tidak ditemukan di Excel: {missing_columns}"
    )


# ============================================================
# 7. AMBIL DATA
# ============================================================

products = df[
    ["kode_produk", "lob", "lead_time"]
].copy()


# ============================================================
# 8. SESUAIKAN DENGAN DATABASE
# ============================================================

products = products.rename(
    columns={
        "kode_produk": "product_code",
        "lob": "LOB"
    }
)


# ============================================================
# 9. CLEANING
# ============================================================

products["product_code"] = (
    products["product_code"]
    .astype(str)
    .str.strip()
)

products["LOB"] = (
    products["LOB"]
    .astype(str)
    .str.strip()
)

products["lead_time"] = pd.to_numeric(
    products["lead_time"],
    errors="coerce"
)

# Buang data yang tidak lengkap
products = products.dropna(
    subset=[
        "product_code",
        "LOB",
        "lead_time"
    ]
)

# Buang product code kosong
products = products[
    products["product_code"] != ""
]

# Hilangkan duplikat product
products = products.drop_duplicates(
    subset=["product_code"]
)

print(f"\nJumlah produk valid: {len(products)}")


# ============================================================
# 8. CONNECT KE DATABASE
# ============================================================

engine = create_engine(DATABASE_URL)


# ============================================================
# 9. INSERT KE TABLE PRODUCTS
# ============================================================

inserted = 0
skipped = 0

with engine.begin() as connection:

    for _, row in products.iterrows():

        # Cek apakah product sudah ada
        existing = connection.execute(
            text("""
                SELECT product_id
                FROM products
                WHERE product_code = :product_code
            """),
            {
                "product_code": row["product_code"]
            }
        ).fetchone()

        # Kalau sudah ada → skip
        if existing:
            skipped += 1
            continue

        # Kalau belum ada → insert
        connection.execute(
            text("""
                INSERT INTO products (
                    product_code,
                    "LOB",
                    lead_time,
                    created_at
                )
                VALUES (
                    :product_code,
                    :LOB,
                    :lead_time,
                    CURRENT_TIMESTAMP
                )
            """),
            {
                "product_code": row["product_code"],
                "LOB": row["LOB"],
                "lead_time": int(row["lead_time"])
            }
        )

        inserted += 1


# ============================================================
# 10. HASIL
# ============================================================

print("\n" + "=" * 50)
print("IMPORT PRODUK SELESAI")
print("=" * 50)
print(f"Produk berhasil dimasukkan : {inserted}")
print(f"Produk sudah ada           : {skipped}")
print(f"Total produk diproses      : {len(products)}")
print("=" * 50)