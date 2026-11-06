import { useEffect, useMemo, useRef, useState } from "react";
import Chart from "react-apexcharts";
import type { ApexOptions } from "apexcharts";
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Package,
  Search,
} from "lucide-react";
import { Sidebar } from "./Dashboard";
import { apiRequest } from "../utils/api";
import "./PredictionHistory.css";
import "./PredictionHistoryStates.css";

type PredictionHistoryItem = {
  prediction_id: number;
  prediction_period: string;
  product_code: string;
  predicted_quantity: number;
  actual_quantity: number | null;
  error: number | null;
  status: "Pending" | "Under-predicted" | "Over-predicted" | "Highly Accurate";
};

type HistoryChartPoint = {
  prediction_period: string;
  year: number;
  month: number;
  predicted_quantity: number;
  actual_quantity: number | null;
};

type ProductOption = {
  product_code: string;
  product_name?: string | null;
  lob?: string;
};

type PredictionHistoryResponse = {
  data: PredictionHistoryItem[];
  chart_data?: HistoryChartPoint[];
  products?: ProductOption[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
  years: number[];
  backfill_running?: boolean;
};

const PAGE_SIZE = 100;

const integerFormat = new Intl.NumberFormat("id-ID", {
  maximumFractionDigits: 0,
});

const periodLabelFormat = new Intl.DateTimeFormat("id-ID", {
  month: "short",
  year: "numeric",
});

function formatInteger(value: number) {
  return integerFormat.format(Math.round(value));
}

function formatPeriod(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return periodLabelFormat.format(date);
}

function ProductPicker({
  products,
  selectedProduct,
  onSelectProduct,
}: {
  products: ProductOption[];
  selectedProduct: string;
  onSelectProduct: (productCode: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) =>
        p.product_code.toLowerCase().includes(q) ||
        (p.product_name && p.product_name.toLowerCase().includes(q)) ||
        (p.lob && p.lob.toLowerCase().includes(q)),
    );
  }, [products, searchQuery]);

  const selectedObj = products.find((p) => p.product_code === selectedProduct);
  const selectedLabel = selectedObj
    ? `${selectedObj.product_code}${selectedObj.lob ? ` (${selectedObj.lob})` : ""}`
    : selectedProduct || "Semua Produk";

  return (
    <div className="period-picker product-picker" ref={containerRef}>
      <label>Kode Produk</label>
      <button
        type="button"
        className="period-trigger"
        aria-expanded={open}
        aria-label="Pilih kode produk"
        onClick={() => setOpen((value) => !value)}
      >
        <span className="picker-trigger-label">
          <Package className="picker-inline-icon" aria-hidden="true" />
          <span>{selectedLabel}</span>
        </span>
        <ChevronDown className="select-chevron" aria-hidden="true" />
      </button>
      {open && (
        <div
          className="period-menu product-menu"
          role="listbox"
          aria-label="Daftar kode produk"
        >
          <div className="product-menu-search">
            <input
              type="text"
              placeholder="Cari kode produk (mis. PRD0001)..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              autoFocus
            />
          </div>
          <div className="product-menu-list">
            <button
              className={selectedProduct === "" ? "selected" : ""}
              type="button"
              role="option"
              aria-selected={selectedProduct === ""}
              onClick={() => {
                onSelectProduct("");
                setOpen(false);
                setSearchQuery("");
              }}
            >
              <span>Semua Produk (Agregat)</span>
              {selectedProduct === "" && <Check aria-hidden="true" />}
            </button>
            {filteredProducts.map((product) => {
              const isSelected = product.product_code === selectedProduct;
              return (
                <button
                  className={isSelected ? "selected" : ""}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  key={product.product_code}
                  onClick={() => {
                    onSelectProduct(product.product_code);
                    setOpen(false);
                    setSearchQuery("");
                  }}
                >
                  <span>
                    {product.product_code}
                    {product.product_name ? ` - ${product.product_name}` : ""}
                    {product.lob ? ` (${product.lob})` : ""}
                  </span>
                  {isSelected && <Check aria-hidden="true" />}
                </button>
              );
            })}
            {filteredProducts.length === 0 && (
              <div className="product-menu-empty">
                Kode produk tidak ditemukan.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function PeriodPicker({
  years,
  selectedYear,
  onSelectYear,
}: {
  years: number[];
  selectedYear: number | null;
  onSelectYear: (year: number | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const options: { year: number | null; label: string }[] = [
    { year: null, label: "Semua Tahun" },
    ...years.map((year) => ({ year, label: `Tahun ${year}` })),
  ];
  const selectedLabel =
    options.find((option) => option.year === selectedYear)?.label ??
    "Semua Tahun";

  return (
    <div className="period-picker" ref={containerRef}>
      <label>Periode Waktu</label>
      <button
        type="button"
        className="period-trigger"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span>{selectedLabel}</span>
        <ChevronDown className="select-chevron" aria-hidden="true" />
      </button>
      {open && (
        <div className="period-menu" role="listbox" aria-label="Pilih tahun">
          {options.map((option) => (
            <button
              className={option.year === selectedYear ? "selected" : ""}
              type="button"
              role="option"
              aria-selected={option.year === selectedYear}
              key={option.year ?? "all"}
              onClick={() => {
                onSelectYear(option.year);
                setOpen(false);
              }}
            >
              {option.label}
              {option.year === selectedYear && <Check aria-hidden="true" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function getHistoryChartOptions(categories: string[]): ApexOptions {
  return {
    chart: {
      type: "area",
      toolbar: { show: false },
      zoom: { enabled: false },
      fontFamily: "'Plus Jakarta Sans', sans-serif",
      animations: { enabled: true, speed: 450 },
    },
    colors: ["#9290a6", "#433f93"],
    stroke: { curve: "smooth", width: [2.5, 3], dashArray: [0, 0] },
    fill: {
      type: "gradient",
      gradient: {
        shadeIntensity: 1,
        opacityFrom: 0.32,
        opacityTo: 0.03,
        stops: [0, 95, 100],
      },
    },
    markers: { size: 5, hover: { size: 7 } },
    dataLabels: { enabled: false },
    legend: {
      show: true,
      position: "top",
      horizontalAlign: "right",
      fontFamily: "'Plus Jakarta Sans', sans-serif",
      fontSize: "12px",
      fontWeight: 600,
      labels: { colors: "#474551" },
      markers: { size: 6, shape: "circle" },
      itemMargin: { horizontal: 12, vertical: 4 },
    },
    grid: {
      borderColor: "#ecebf2",
      strokeDashArray: 4,
      xaxis: { lines: { show: false } },
      padding: { left: 12, right: 12, bottom: 8 },
    },
    xaxis: {
      categories,
      title: {
        text: "Periode Waktu (Bulan/Tahun)",
        offsetY: -2,
        style: {
          color: "#474551",
          fontSize: "12px",
          fontFamily: "'Plus Jakarta Sans', sans-serif",
          fontWeight: 600,
        },
      },
      axisBorder: { show: false },
      axisTicks: { show: false },
      labels: {
        style: { colors: "#474551", fontSize: "11px", fontWeight: 700 },
      },
      tooltip: { enabled: false },
    },
    yaxis: {
      min: 0,
      forceNiceScale: true,
      tickAmount: 5,
      title: {
        text: "Jumlah Penjualan / Prediksi Produk (Unit)",
        style: {
          color: "#474551",
          fontSize: "12px",
          fontFamily: "'Plus Jakarta Sans', sans-serif",
          fontWeight: 600,
        },
      },
      labels: {
        formatter: (value) =>
          value === null || value === undefined || Number.isNaN(value)
            ? "0"
            : formatInteger(value),
        style: { colors: "#808080", fontSize: "11px" },
      },
    },
    tooltip: {
      shared: true,
      intersect: false,
      y: {
        formatter: (value) =>
          value === null || value === undefined || Number.isNaN(value)
            ? "—"
            : `${formatInteger(value)} unit`,
      },
    },
  };
}

function HistoryChart({
  chartData,
  rows,
  selectedProduct,
  selectedYear,
  isLoading,
}: {
  chartData: HistoryChartPoint[];
  rows: PredictionHistoryItem[];
  selectedProduct: string;
  selectedYear: number | null;
  isLoading: boolean;
}) {
  // Susun titik grafik dan pastikan diurutkan secara kronologis (Tahun ASC, Bulan ASC)
  const sortedPoints = useMemo<HistoryChartPoint[]>(() => {
    if (chartData && chartData.length > 0) {
      return [...chartData].sort(
        (a, b) => a.year - b.year || a.month - b.month,
      );
    }

    // Fallback agregasi dari rows jika chart_data belum tersedia
    const mapByPeriod = new Map<
      string,
      {
        year: number;
        month: number;
        predicted: number;
        actual: number;
        hasActual: boolean;
      }
    >();

    for (const row of rows) {
      const d = new Date(row.prediction_period);
      if (Number.isNaN(d.getTime())) continue;
      const year = d.getFullYear();
      const month = d.getMonth() + 1;
      const key = `${year}-${String(month).padStart(2, "0")}`;
      const existing = mapByPeriod.get(key) ?? {
        year,
        month,
        predicted: 0,
        actual: 0,
        hasActual: false,
      };
      existing.predicted += Number(row.predicted_quantity || 0);
      if (row.actual_quantity !== null && row.actual_quantity !== undefined) {
        existing.actual += Number(row.actual_quantity);
        existing.hasActual = true;
      }
      mapByPeriod.set(key, existing);
    }

    return Array.from(mapByPeriod.values())
      .sort((a, b) => a.year - b.year || a.month - b.month)
      .map((item) => ({
        prediction_period: `${item.year}-${String(item.month).padStart(2, "0")}-01`,
        year: item.year,
        month: item.month,
        predicted_quantity: item.predicted,
        actual_quantity: item.hasActual ? item.actual : null,
      }));
  }, [chartData, rows]);

  const categories = sortedPoints.map(({ year, month }) =>
    periodLabelFormat
      .format(new Date(year, month - 1, 1))
      .toLocaleUpperCase("id-ID"),
  );

  const actualSeries = sortedPoints.map((point) =>
    point.actual_quantity !== null && point.actual_quantity !== undefined
      ? Math.round(Number(point.actual_quantity))
      : null,
  );

  const predictedSeries = sortedPoints.map((point) =>
    point.predicted_quantity !== null && point.predicted_quantity !== undefined
      ? Math.round(Number(point.predicted_quantity))
      : null,
  );

  const hasActual = actualSeries.some((val) => val !== null);
  const series = hasActual
    ? [
        { name: "Penjualan Aktual (Unit)", data: actualSeries },
        { name: "Hasil Prediksi (Unit)", data: predictedSeries },
      ]
    : [{ name: "Hasil Prediksi (Unit)", data: predictedSeries }];

  const scopeTitle = selectedProduct
    ? `Produk ${selectedProduct}`
    : "Semua Produk (Agregat)";
  const yearSubtitle = selectedYear ? ` • Tahun ${selectedYear}` : "";

  return (
    <section
      className="history-panel history-chart-panel"
      aria-label="Grafik riwayat prediksi penjualan"
    >
      <div className="history-chart-header">
        <div>
          <h2>Grafik Historis Forecasting — {scopeTitle}</h2>
          <p>
            Perbandingan penjualan aktual dan hasil prediksi secara kronologis
            dalam satuan unit{yearSubtitle}
          </p>
        </div>
        <div className="history-chart-legend">
          {hasActual && (
            <span>
              <i className="history-legend-dot actual" />
              Penjualan Aktual
            </span>
          )}
          <span>
            <i className="history-legend-dot prediction" />
            Hasil Prediksi
          </span>
        </div>
      </div>
      <div className="history-chart-body">
        {isLoading ? (
          <p className="history-empty-chart">
            Memuat grafik riwayat forecasting...
          </p>
        ) : categories.length > 0 ? (
          <Chart
            options={getHistoryChartOptions(categories)}
            series={series}
            type="area"
            height={340}
          />
        ) : (
          <p className="history-empty-chart">
            Belum ada data riwayat prediksi untuk filter produk/periode ini.
          </p>
        )}
      </div>
    </section>
  );
}

function getStatusTone(status: PredictionHistoryItem["status"]) {
  if (status === "Under-predicted") return "under";
  if (status === "Over-predicted") return "over";
  if (status === "Highly Accurate") return "accurate";
  return "pending";
}

function HistoryTable({
  rows,
  total,
  page,
  totalPages,
  isLoading,
  errorMessage,
  onPageChange,
}: {
  rows: PredictionHistoryItem[];
  total: number;
  page: number;
  totalPages: number;
  isLoading: boolean;
  errorMessage: string;
  onPageChange: (page: number) => void;
}) {
  const firstEntry = total > 0 ? (page - 1) * PAGE_SIZE + 1 : 0;
  const lastEntry = Math.min(page * PAGE_SIZE, total);
  const firstPage = Math.max(1, Math.min(page - 2, totalPages - 4));
  const pageNumbers = Array.from(
    { length: Math.max(0, Math.min(totalPages, 5)) },
    (_, index) => firstPage + index,
  );

  return (
    <section className="history-panel" aria-label="Tabel rincian riwayat prediksi">
      <div className="history-table-top">
        <strong className="history-table-title">
          Rincian Data Historis Prediksi
        </strong>
        <span>Total Data: {total}</span>
      </div>
      {errorMessage && (
        <p className="history-feedback" role="alert">
          {errorMessage}
        </p>
      )}
      <div className="prediction-table-scroll">
        <table className="prediction-table">
          <thead>
            <tr>
              <th scope="col">BULAN/TAHUN</th>
              <th scope="col">KODE PRODUK</th>
              <th scope="col">ANGKA PREDIKSI (UNIT)</th>
              <th scope="col">ANGKA AKTUAL (UNIT)</th>
              <th scope="col">SELISIH/ERROR</th>
              <th scope="col">STATUS</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td className="history-empty" colSpan={6}>
                  Memuat riwayat prediksi...
                </td>
              </tr>
            ) : rows.length > 0 ? (
              rows.map((row) => {
                const roundedPredicted = Math.round(row.predicted_quantity);
                const roundedActual =
                  row.actual_quantity === null
                    ? null
                    : Math.round(row.actual_quantity);
                const roundedError =
                  roundedActual !== null
                    ? roundedActual - roundedPredicted
                    : row.error === null
                      ? null
                      : Math.round(row.error) || 0;

                return (
                  <tr key={row.prediction_id}>
                    <td>{formatPeriod(row.prediction_period)}</td>
                    <td>{row.product_code}</td>
                    <td>{integerFormat.format(roundedPredicted)}</td>
                    <td>
                      {roundedActual === null
                        ? "—"
                        : integerFormat.format(roundedActual)}
                    </td>
                    <td
                      className={
                        roundedError === null || roundedError === 0
                          ? ""
                          : roundedError < 0
                            ? "negative"
                            : "positive"
                      }
                    >
                      {roundedError === null
                        ? "—"
                        : integerFormat.format(roundedError)}
                    </td>
                    <td>
                      <span
                        className={`prediction-status ${getStatusTone(row.status)}`}
                      >
                        {row.status}
                      </span>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td className="history-empty" colSpan={6}>
                  Belum ada riwayat prediksi untuk produk dan periode ini.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <footer className="history-pagination">
        <span>
          {isLoading
            ? "Memuat data..."
            : `Menampilkan ${firstEntry}–${lastEntry} dari ${total} data`}
        </span>
        <div>
          <button
            type="button"
            disabled={page <= 1 || isLoading}
            onClick={() => onPageChange(Math.max(1, page - 1))}
            aria-label="Halaman sebelumnya"
          >
            <ChevronLeft />
          </button>
          {pageNumbers.map((pageNumber) => (
            <button
              className={pageNumber === page ? "current" : ""}
              type="button"
              aria-current={pageNumber === page ? "page" : undefined}
              key={pageNumber}
              onClick={() => onPageChange(pageNumber)}
              disabled={isLoading}
            >
              {pageNumber}
            </button>
          ))}
          <button
            type="button"
            disabled={page >= totalPages || isLoading}
            onClick={() => onPageChange(Math.min(totalPages, page + 1))}
            aria-label="Halaman berikutnya"
          >
            <ChevronRight />
          </button>
        </div>
      </footer>
    </section>
  );
}

function PredictionHistory() {
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<string>("");
  const [years, setYears] = useState<number[]>([]);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [history, setHistory] = useState<PredictionHistoryResponse | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  // Muat daftar produk sebagai cadangan jika belum ada di respons history
  useEffect(() => {
    const controller = new AbortController();
    apiRequest<ProductOption[]>("/predict/products", {
      signal: controller.signal,
    })
      .then((result) => {
        if (Array.isArray(result) && result.length > 0) {
          setProducts((prev) => (prev.length > 0 ? prev : result));
        }
      })
      .catch(() => {
        // Diabaikan jika daftar produk sudah dimuat dari /predict/history
      });
    return () => controller.abort();
  }, []);

  // Otomatis muat ulang grafik dan data setiap kali produk, tahun, atau halaman berubah
  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({
      page: String(page),
      limit: String(PAGE_SIZE),
    });
    if (selectedYear !== null) params.set("year", String(selectedYear));
    if (selectedProduct) params.set("product_code", selectedProduct);

    const loadHistory = async () => {
      setIsLoading(true);
      setErrorMessage("");
      try {
        const result = await apiRequest<PredictionHistoryResponse>(
          `/predict/history?${params.toString()}`,
          { signal: controller.signal },
        );

        setHistory(result);
        setYears(result.years);
        if (Array.isArray(result.products) && result.products.length > 0) {
          setProducts(result.products);
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Riwayat prediksi gagal dimuat.",
          );
        }
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    };

    void loadHistory();
    return () => controller.abort();
  }, [selectedProduct, selectedYear, page]);

  const handleProductSelect = (productCode: string) => {
    setPage(1);
    setSelectedProduct(productCode);
  };

  const handleYearSelect = (year: number | null) => {
    setPage(1);
    setSelectedYear(year);
  };

  const handleSearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPage(1);
  };

  return (
    <div className="prediction-history-shell">
      <Sidebar activeLabel="History" />
      <div className="prediction-history-main">
        <header className="prediction-history-topbar" />
        <main className="prediction-history-content">
          <header className="history-heading">
            <h1>Historis Prediksi</h1>
            <p>
              Tinjau kembali grafik perbandingan penjualan aktual dan hasil
              prediksi dari periode sebelumnya berdasarkan produk.
            </p>
          </header>
          <form className="history-filter" onSubmit={handleSearch}>
            <ProductPicker
              products={products}
              selectedProduct={selectedProduct}
              onSelectProduct={handleProductSelect}
            />
            <PeriodPicker
              years={years}
              selectedYear={selectedYear}
              onSelectYear={handleYearSelect}
            />
            <button
              className="history-search"
              type="submit"
              disabled={isLoading}
            >
              <Search className="search-icon" aria-hidden="true" />
              Cari
            </button>
          </form>
          <HistoryChart
            chartData={history?.chart_data ?? []}
            rows={history?.data ?? []}
            selectedProduct={selectedProduct}
            selectedYear={selectedYear}
            isLoading={isLoading}
          />
          <HistoryTable
            rows={history?.data ?? []}
            total={history?.total ?? 0}
            page={page}
            totalPages={history?.total_pages ?? 0}
            isLoading={isLoading}
            errorMessage={errorMessage}
            onPageChange={setPage}
          />
        </main>
      </div>
    </div>
  );
}

export default PredictionHistory;
