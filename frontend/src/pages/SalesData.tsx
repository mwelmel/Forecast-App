import { useRef, useState } from 'react'
import { Sidebar } from './Dashboard'
import './SalesData.css'

const uploadIcon = 'https://www.figma.com/api/mcp/asset/b662af16-bf6e-4099-b5a6-c371547808ea.svg'
const successIcon = 'https://www.figma.com/api/mcp/asset/dbe94bfd-38eb-439a-bbe3-306160c6fd68.svg'
const failureIcon = 'https://www.figma.com/api/mcp/asset/67df9ced-ec05-44bf-934f-bf7f4119b8ab.svg'

const uploadHistory = [
  { date: '24 Okt 2024, 14:30', file: 'sales_data_q3_2024.xlsx', rows: '12,450', status: 'Sukses' },
  { date: '23 Okt 2024, 09:15', file: 'historical_2023_full.xlsx', rows: '45,200', status: 'Sukses' },
  { date: '20 Okt 2024, 16:45', file: 'corrupted_data_test.xlsx', rows: '-', status: 'Gagal' },
]

function UploadDropzone() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState('')
  const [isDragging, setIsDragging] = useState(false)

  const acceptFile = (file?: File) => {
    if (file?.name.toLowerCase().endsWith('.xlsx')) setFileName(file.name)
  }

  return (
    <label className={`upload-dropzone${isDragging ? ' dragging' : ''}`} onDragOver={(event) => { event.preventDefault(); setIsDragging(true) }} onDragLeave={() => setIsDragging(false)} onDrop={(event) => { event.preventDefault(); setIsDragging(false); acceptFile(event.dataTransfer.files[0]) }}>
      <input ref={inputRef} type="file" accept=".xlsx" onChange={(event) => acceptFile(event.target.files?.[0])} />
      <span className="upload-icon"><img src={uploadIcon} alt="" /></span>
      <strong>{fileName || 'Tarik file data historis penjualan ke sini'}</strong>
      <span className="browse-copy">atau <b>Klik untuk Browse</b></span>
      <small>Format yang didukung: .xlsx</small>
    </label>
  )
}

function StatusBadge({ status }: { status: string }) {
  const success = status === 'Sukses'
  return <span className={`upload-status ${success ? 'success' : 'failure'}`}><img src={success ? successIcon : failureIcon} alt="" />{status}</span>
}

function UploadHistory() {
  return (
    <section className="upload-history">
      <div className="history-heading"><h2>Riwayat Unggahan</h2></div>
      <div className="history-scroll"><table><thead><tr><th>Tanggal Upload</th><th>Nama File</th><th>Jumlah Baris</th><th>Status</th></tr></thead><tbody>{uploadHistory.map((item) => <tr key={item.file}><td>{item.date}</td><th scope="row">{item.file}</th><td>{item.rows}</td><td><StatusBadge status={item.status} /></td></tr>)}</tbody></table></div>
    </section>
  )
}

function SalesData() {
  return <div className="sales-data-shell"><Sidebar activeLabel="Inventory" activeSubLabel="Data Penjualan" /><div className="sales-data-main"><header className="sales-data-topbar" /><main className="sales-data-content"><header className="sales-heading"><h2>Kelola Data Penjualan</h2><p>Unggah data historis untuk memperbarui model prediksi</p></header><UploadDropzone /><UploadHistory /></main></div></div>
}

export default SalesData