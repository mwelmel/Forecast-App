import pandas as pd
from sklearn.preprocessing import LabelEncoder

TARGET = "SALES_QTY"

FEATURES = [
    "Kode_produk_enc", "LOB", "Lead Time",
    "Tahun", "Bulan",
    "Sales_t-1", "Sales_t-2", "Sales_t-3",
    "Ma_3", "Ma_6",
]


def load_raw_data(path) -> pd.DataFrame:
    """Membaca dataset mentah dari data/raw/."""
    return pd.read_excel(path)

def fix_period_bug(df: pd.DataFrame) -> pd.DataFrame:
    """Memperbaiki bug PERIOD_MO: komponen 'bulan' pada tanggal sumber selalu
    bernilai 01, sedangkan bulan sebenarnya (1-12) tersimpan di komponen 'hari'."""
    df = df.copy()
    df["Tahun"] = df["PERIOD_MO"].dt.year
    df["Bulan"] = df["PERIOD_MO"].dt.day
    df["PERIOD_MO"] = pd.to_datetime(
        df["Tahun"].astype(str) + "-" + df["Bulan"].astype(str) + "-01"
    )
    return df


def encode_categorical(df: pd.DataFrame):
    """Encode KODE_PRODUK -> Kode_produk_enc dan LOB -> LOB (numerik)"""
    df = df.copy()
    le_produk = LabelEncoder()
    le_lob = LabelEncoder()
    df["Kode_produk_enc"] = le_produk.fit_transform(df["KODE_PRODUK"])
    df["LOB"] = le_lob.fit_transform(df["LOB"])
    df = df.rename(columns={"LEAD_TIME": "Lead Time"})
    encoders = {"produk": le_produk, "lob": le_lob}
    return df, encoders


def add_lag_and_moving_average(df: pd.DataFrame) -> pd.DataFrame:
    """Menambahkan fitur lag (Sales_t-1,t-2,t-3) dan moving average (Ma_3, Ma_6),
    dihitung per produk dan terurut berdasarkan waktu."""
    df = df.sort_values(["KODE_PRODUK", "PERIOD_MO"]).reset_index(drop=True)
    grp = df.groupby("KODE_PRODUK")["SALES_QTY"]
    df["Sales_t-1"] = grp.shift(1)
    df["Sales_t-2"] = grp.shift(2)
    df["Sales_t-3"] = grp.shift(3)
    df["Ma_3"] = grp.transform(lambda s: s.shift(1).rolling(window=3).mean())
    df["Ma_6"] = grp.transform(lambda s: s.shift(1).rolling(window=6).mean())
    return df


def handle_missing_values(df: pd.DataFrame, verbose: bool = True) -> pd.DataFrame:
    """Membuang baris yang belum punya cukup histori untuk lag/MA."""
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


def build_features(df: pd.DataFrame, verbose: bool = True):
    """Pipeline lengkap: dari data mentah -> dataset siap dilatih.
    Return: (df_siap_pakai, encoders_di_memori)
    """
    df = fix_period_bug(df)
    df, encoders = encode_categorical(df)
    df = add_lag_and_moving_average(df)
    df = handle_missing_values(df, verbose=verbose)
    return df, encoders

def save_processed_data(df: pd.DataFrame, path: str):
    """Menyimpan dataset yang sudah diproses ke data/processed/."""
    df.to_csv(path, index=False)
    print('Dataset yang sudah diproses disimpan di:', path)