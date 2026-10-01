import pandas as pd
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
    df["TARGET"] = df["TARGET"].clip(lower=0)
    return df

# ubah sesuain period mo dari dataset
def fix_period_bug(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df["Tahun"] = df["PERIOD_MO"].dt.year
    df["Bulan"] = df["PERIOD_MO"].dt.day
    df["PERIOD_MO"] = pd.to_datetime(
        df["Tahun"].astype(str) + "-" + df["Bulan"].astype(str) + "-01"
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
    encoders= fit_product_encoder(df, encoders=encoders, fit=fit)
    df = add_lag_and_moving_average(df)
    df = handle_missing_values(df, verbose=verbose)
    return df, encoders

def save_encoders(encoders: dict, path: Path):
    joblib.dump(encoders, path)

def load_encoders(path: Path) -> dict:
    return joblib.load(path)

def save_processed_data(df: pd.DataFrame, path: str):
    """Menyimpan dataset yang sudah diproses ke data/processed/."""
    df.to_csv(path, index=False)
    print('Dataset yang sudah diproses disimpan di:', path)