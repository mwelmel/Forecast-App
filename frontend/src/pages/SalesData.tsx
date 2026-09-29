import { useEffect, useRef, useState } from 'react'
import { Sidebar } from './Dashboard'
import './SalesData.css'
import { CheckCircle2, Upload, XCircle } from 'lucide-react'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

type UploadResult = {
  message: string
  filename: string
  total_rows: number
}

type UploadRecord = {
  date: string
  status: string
}

type UploadHistoryResponse = {
  uploaded_at: string
  status: string
}

async function fetchUploadHistory(signal?: AbortSignal): Promise<UploadHistoryResponse[]> {
  const token = localStorage.getItem('access_token') ?? sessionStorage.getItem('access_token')
  const response = await fetch(`${API_URL}/api/sales/history`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    signal,
  })
  const result = await response.json().catch(() => null) as UploadHistoryResponse[] | { detail?: string } | null

  if (!response.ok || !Array.isArray(result)) {
    throw new Error(result && !Array.isArray(result) && result.detail ? result.detail : 'Riwayat unggahan gagal dimuat.')
  }

  return result
}

function mapUploadHistory(history: UploadHistoryResponse[]): UploadRecord[] {
  return history.map((item) => ({
    date: new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(item.uploaded_at)),
    status: item.status,
  }))
}

function UploadDropzone({
  file,
  isUploading,
  errorMessage,
  successMessage,
  onFileSelected,
  onUpload,
}: {
  file: File | null
  isUploading: boolean
  errorMessage: string
  successMessage: string
  onFileSelected: (file: File | null) => void
  onUpload: (event: React.FormEvent<HTMLFormElement>) => void
}) {
  const [isDragging, setIsDragging] = useState(false)

  return (
    <form className="sales-upload-form" onSubmit={onUpload}>
      <label
        className={`upload-dropzone${isDragging ? ' dragging' : ''}`}
        onDragOver={(event) => { event.preventDefault(); setIsDragging(true) }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(event) => {
          event.preventDefault()
          setIsDragging(false)
          onFileSelected(event.dataTransfer.files[0] ?? null)
        }}
      >
        <input
          key={file?.name ?? 'empty'}
          type="file"
          accept=".xlsx,.xls"
          onChange={(event) => onFileSelected(event.target.files?.[0] ?? null)}
          disabled={isUploading}
        />
        <span className="upload-icon"><Upload aria-hidden="true" /></span>
        <strong>{file?.name || 'Tarik file data historis penjualan ke sini'}</strong>
        <span className="browse-copy">atau <b>Klik untuk Browse</b></span>
        <small>Format yang didukung: .xlsx, .xls</small>
      </label>
      <div className="upload-actions">
        <button type="submit" className="upload-submit" disabled={!file || isUploading}>
          <Upload aria-hidden="true" />
          {isUploading ? 'Mengunggah...' : 'Unggah Data'}
        </button>
        {errorMessage && <p className="upload-feedback error" role="alert">{errorMessage}</p>}
        {successMessage && <p className="upload-feedback success" role="status">{successMessage}</p>}
      </div>
    </form>
  )
}

function StatusBadge({ status }: { status: string }) {
  const success = status === 'Sukses'
  return <span className={`upload-status ${success ? 'success' : 'failure'}`}>{success ? <CheckCircle2 aria-hidden="true" /> : <XCircle aria-hidden="true" />}{status}</span>
}

function UploadHistory({ records, errorMessage }: { records: UploadRecord[]; errorMessage: string }) {
  return (
    <section className="upload-history">
      <div className="history-heading"><h2>Riwayat Unggahan</h2></div>
      {errorMessage && <p className="upload-feedback error history-error" role="alert">{errorMessage}</p>}
      <div className="history-scroll"><table><thead><tr><th>Tanggal Upload</th><th>Status</th></tr></thead><tbody>{records.length ? records.map((item, index) => <tr key={`${item.date}-${index}`}><td>{item.date}</td><td><StatusBadge status={item.status === 'Berhasil' ? 'Sukses' : item.status} /></td></tr>) : <tr><td className="empty-history" colSpan={2}>Belum ada riwayat unggahan.</td></tr>}</tbody></table></div>
    </section>
  )
}

function SalesData() {
  const [file, setFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [records, setRecords] = useState<UploadRecord[]>([])
  const [historyError, setHistoryError] = useState('')
  const historyRequestId = useRef(0)

  useEffect(() => {
    const controller = new AbortController()
    const requestId = ++historyRequestId.current

    void fetchUploadHistory(controller.signal)
      .then((history) => {
        if (requestId === historyRequestId.current) {
          setRecords(mapUploadHistory(history))
          setHistoryError('')
        }
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted && requestId === historyRequestId.current) {
          setHistoryError(error instanceof Error ? error.message : 'Riwayat unggahan gagal dimuat.')
        }
      })

    return () => controller.abort()
  }, [])

  const handleFileSelected = (selectedFile: File | null) => {
    setErrorMessage('')
    setSuccessMessage('')

    if (selectedFile && !/\.xlsx?$/i.test(selectedFile.name)) {
      setFile(null)
      setErrorMessage('Pilih file Excel dengan format .xlsx atau .xls.')
      return
    }

    setFile(selectedFile)
  }

  const handleUpload = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!file) return

    setIsUploading(true)
    setErrorMessage('')
    setSuccessMessage('')
    const formData = new FormData()
    formData.append('file', file)

    try {
      const token = localStorage.getItem('access_token') ?? sessionStorage.getItem('access_token')
      const response = await fetch(`${API_URL}/api/sales/upload`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: formData,
      })
      const result = await response.json().catch(() => null) as UploadResult | { detail?: string } | null

      if (!response.ok) {
        throw new Error(result && 'detail' in result && result.detail ? result.detail : 'Unggahan gagal diproses.')
      }

      const uploadResult = result as UploadResult
      const date = new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date())
      setRecords((previous) => [{ date, status: 'Sukses' }, ...previous])
      setSuccessMessage(`${uploadResult.message}: ${uploadResult.filename} (${uploadResult.total_rows.toLocaleString('id-ID')} baris).`)
      setFile(null)

      const requestId = ++historyRequestId.current
      try {
        const history = await fetchUploadHistory()
        if (requestId === historyRequestId.current && history.length > 0) {
          setRecords(mapUploadHistory(history))
        }
      } catch {
        if (requestId === historyRequestId.current) {
          setHistoryError('Unggahan berhasil, tetapi riwayat terbaru gagal dimuat.')
        }
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Terjadi kesalahan saat mengunggah file.')
    } finally {
      setIsUploading(false)
    }
  }

  return <div className="sales-data-shell"><Sidebar activeLabel="Inventory" activeSubLabel="Data Penjualan" /><div className="sales-data-main"><header className="sales-data-topbar" /><main className="sales-data-content"><header className="sales-heading"><h2>Kelola Data Penjualan</h2><p>Unggah data historis untuk memperbarui model prediksi</p></header><UploadDropzone file={file} isUploading={isUploading} errorMessage={errorMessage} successMessage={successMessage} onFileSelected={handleFileSelected} onUpload={handleUpload} /><UploadHistory records={records} errorMessage={historyError} /></main></div></div>
}

export default SalesData