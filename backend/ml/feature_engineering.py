import pandas as pd
import numpy as np 
import joblib
from pathlib import Path
from sklearn.preprocessing import LabelEncoder

TARGET = "SALES_QTY"

FEATURES = [
    "Tahun", "Bulan",
    "Sales_t-1", "Sales_t-2", "Sales_t-3",
    "Ma_3", "Ma_6",
]

# fungsi baca dataset mentah
def load_raw_data(path) -> pd.DataFrame:
    """Membaca dataset mentah dari data/raw/."""
    return pd.read_excel(path)

# fungsi buat nanganin nilai sales minus karena retur 
def handle_negative_sales(df: pd.DataFrame, verbose: bool = True) -> pd.DataFrame:
    df = df.copy()
    n_negative = (df[TARGET] < 0).sum()
    if verbose and n_negative > 0:
         print(f"Notes: {n_negative} baris sales_qty negatif karena retur telah di ubah menjadi 0")
        #  disini issuenya wktu itu makanya ngebug di model
    df["SALES_QTY"] = df["SALES_QTY"].clip(lower=0)
    return df

# fungsi buat agregatte yang satu bulan ada 2 qtynya 
def aggregate_monthly(df: pd.DataFrame, verbose: bool = True) -> pd.DataFrame:
    n_before = len(df)
    df_agg = (
        df.groupby(["KODE_PRODUK","Tahun","Bulan"], as_index=False)
        .agg(
            LOB=("LOB","first"),
            LEAD_TIME=("LEAD_TIME","first"),
            SALES_QTY=("SALES_QTY","first"),
        )
    )
    df_agg["PERIOD_MO"]=pd.to_datetime(
        df_agg["Tahun"].astype(str) + "-" + df_agg["Bulan"].astype(str) + "-01"
    )
    if verbose:
        print(f"Catatan: {n_before} baris transaksi  mentah digabung (sum) menjadi"
              f"{len(df_agg)} baris bulanan (1 baris = 1 produk per bulan).")
    return df_agg

# isi bulan kosong dengan nilai 0 buat lengkapin gap 
def fill_monthly_gaps(df: pd.DataFrame, verbose: bool = True) -> pd.DataFrame:
    hasil = []
    for produk, g in df.groupby("KODE_PRODUK"):
        g = g.sort_values("PERIOD_MO")
        full_range = pd.date_range(g["PERIOD_MO"].min(), g["PERIOD_MO"].max(), freq="MS")
        g_full = g.set_index("PERIOD_MO").reindex(full_range)
        g_full["KODE_PRODUK"] = produk
        g_full["LOB"] = g_full["LOB"].ffill().bfill()
        g_full["LEAD_TIME"] = g_full["LEAD_TIME"].ffill().bfill()
        g_full["SALES_QTY"] = g_full["SALES_QTY"].fillna(0)
        g_full = g_full.reset_index().rename(columns={"index": "PERIOD_MO"})
        hasil.append(g_full)

    df_full = pd.concat(hasil, ignore_index=True)
    df_full["Tahun"] = df_full["PERIOD_MO"].dt.year
    df_full["Bulan"] = df_full["PERIOD_MO"].dt.month
    if verbose:
        print(f"Catatan: {len(df_full) - len(df)} baris bulan kosong ditambahkan")
    return df_full

# ubah sesuain period mo dari dataset
# def fix_period_bug(df: pd.DataFrame) -> pd.DataFrame:
#     df = df.copy()
#     df["Tahun"] = df["PERIOD_MO"].dt.year
#     df["Bulan"] = df["PERIOD_MO"].dt.day
#     df["PERIOD_MO"] = pd.to_datetime(
#         df["Tahun"].astype(str) + "-" + df["Bulan"].astype(str) + "-01"
#     )
#     return df
def fix_period_bug(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()

    df["PERIOD_MO"] = pd.to_datetime(
        df["PERIOD_MO"],
        errors="coerce"
    )

    df["Tahun"] = df["PERIOD_MO"].dt.year
    df["Bulan"] = df["PERIOD_MO"].dt.month

    df["PERIOD_MO"] = pd.to_datetime(
        df["Tahun"].astype(str) + "-" +
        df["Bulan"].astype(str) + "-01"
    )

    return df


# fungsi buat kode produk tetep di encode tapi ga sebagai fitur 
def fit_product_encoder(df: pd.DataFrame, encoders: dict | None = None, fit: bool = True):
    # kalo fit true buat encode baru, klo no berarti udh ada encodernya berarti produk lama itu
    if fit:
        le_produk = LabelEncoder()
        le_produk.fit(df["KODE_PRODUK"])
        encoders = {"produk": le_produk}
    return encoders

# fitur lag buat penjualan 1,2,3 bulan sebelumnya sama rata-rata penjualan 3 dan 6 
def add_lag_and_moving_average(df: pd.DataFrame) -> pd.DataFrame:
    df = df.sort_values(["KODE_PRODUK", "PERIOD_MO"]).reset_index(drop=True)
    grp = df.groupby("KODE_PRODUK")["SALES_QTY"]
    df["Sales_t-1"] = grp.shift(1)
    df["Sales_t-2"] = grp.shift(2)
    df["Sales_t-3"] = grp.shift(3)
    df["Ma_3"] = grp.transform(lambda s: s.shift(1).rolling(window=3).mean())
    df["Ma_6"] = grp.transform(lambda s: s.shift(1).rolling(window=6).mean())
    return df

# buang baris yang belum cukup historisnya
def handle_missing_values(df: pd.DataFrame, verbose: bool = True) -> pd.DataFrame:
    cols = ["Sales_t-1", "Sales_t-2", "Sales_t-3", "Ma_3", "Ma_6"]
    n_before = len(df)
    if verbose:
        print("Jumlah missing value akibat fitur lag & moving average:")
        print(df[cols].isnull().sum())
    df_clean = df.dropna(subset=cols).reset_index(drop=True)
    if verbose:
        print(f"Baris sebelum: {n_before} -> sesudah dropna: {len(df_clean)} "
              f"(dibuang: {n_before - len(df_clean)})")
    return df_clean

# pipeline okeh
def build_features(df: pd.DataFrame, encoders: dict | None = None, fit: bool = True, verbose: bool = True):
    df = handle_negative_sales(df, verbose=verbose)
    df = fix_period_bug(df)
    df = aggregate_monthly(df, verbose=verbose)
    df = fill_monthly_gaps(df, verbose=verbose)
    encoders= fit_product_encoder(df, encoders=encoders, fit=fit)
    df = add_lag_and_moving_average(df)
    df = handle_missing_values(df, verbose=verbose)
    return df, encoders

def save_encoders(encoders: dict, path: Path):
    joblib.dump(encoders, path)

def load_encoders(path: Path) -> dict:
    return joblib.load(path)

def forecast_month(model, history_values: list, last_period: pd.Timestamp, horizon: int = 6):
    history = list(history_values)  
    hasil = []
 
    for step in range(1, horizon + 1):
        target_period = last_period + pd.DateOffset(months=step)
 
        sales_t1 = history[-1]
        sales_t2 = history[-2] if len(history) >= 2 else np.nan
        sales_t3 = history[-3] if len(history) >= 3 else np.nan
        ma_3 = np.mean(history[-3:]) if len(history) >= 3 else np.nan
        ma_6 = np.mean(history[-6:]) if len(history) >= 6 else np.nan
 
        row = pd.DataFrame([{
            "Tahun": target_period.year,
            "Bulan": target_period.month,
            "Sales_t-1": sales_t1,
            "Sales_t-2": sales_t2,
            "Sales_t-3": sales_t3,
            "Ma_3": ma_3,
            "Ma_6": ma_6,
        }])[FEATURES]
 
        pred = float(model.predict(row)[0])
        pred = max(pred, 0.0)  # penjualan tidak mungkin negatif
 
        hasil.append({
            "tahun": target_period.year,
            "bulan": target_period.month,
            "predicted_quantity": round(pred, 2),
        })
 
        history.append(pred)  # hasil prediksi dipakai lagi buat prediksi bulan depan
 
    return hasil

def save_processed_data(df: pd.DataFrame, path: str):
    """Menyimpan dataset yang sudah diproses ke data/processed/."""
    df.to_csv(path, index=False)
    print('Dataset yang sudah diproses disimpan di:', path)