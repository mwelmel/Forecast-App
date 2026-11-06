import { useCallback, useEffect, useRef, useState } from 'react'
import { CheckCircle2, Loader2, X, XCircle } from 'lucide-react'
import { apiRequest } from '../utils/api'
import { RETRAIN_STARTED_EVENT, RETRAIN_STATUS_EVENT, formatDuration } from './retrainStatus'
import type { RetrainStatus } from './retrainStatus'
import './RetrainNotifier.css'

const ACK_KEY = 'retrain_ack_job_id'
const POLL_INTERVAL_MS = 3000

function isSuperUser() {
  const userData = localStorage.getItem('user') ?? sessionStorage.getItem('user')
  const token = localStorage.getItem('access_token') ?? sessionStorage.getItem('access_token')
  if (!userData || !token) return false
  try {
    return JSON.parse(userData)?.role === 'super_user'
  } catch {
    return false
  }
}

function RetrainNotifier() {
  const [status, setStatus] = useState<RetrainStatus | null>(null)
  const [visible, setVisible] = useState(false)
  // Waktu lokal saat status terakhir diterima, dipakai untuk menambah detik di antara polling
  const [receivedAt, setReceivedAt] = useState(0)
  const [now, setNow] = useState(() => Date.now())
  const timerRef = useRef<number | null>(null)

  const fetchStatus = useCallback(async () => {
    if (!isSuperUser()) return null
    try {
      const result = await apiRequest<RetrainStatus>('/model/retrain/status')
      setStatus(result)
      setReceivedAt(Date.now())
      window.dispatchEvent(new CustomEvent(RETRAIN_STATUS_EVENT, { detail: result }))

      if (result.status === 'running') {
        setVisible(true)
      } else if ((result.status === 'success' || result.status === 'failed') && result.job_id) {
        // Notifikasi hasil hanya ditampilkan sekali per job
        if (localStorage.getItem(ACK_KEY) !== result.job_id) {
          localStorage.setItem(ACK_KEY, result.job_id)
          setVisible(true)
        }
      }
      return result
    } catch {
      return null
    }
  }, [])

  // Cek status saat aplikasi dibuka (misal user pindah halaman / refresh saat retraining berjalan)
  useEffect(() => {
    let active = true
    queueMicrotask(() => {
      if (active) void fetchStatus()
    })
    return () => { active = false }
  }, [fetchStatus])

  // Polling berkala selama retraining masih berjalan
  useEffect(() => {
    if (status?.status !== 'running') return
    const id = window.setInterval(() => { void fetchStatus() }, POLL_INTERVAL_MS)
    return () => window.clearInterval(id)
  }, [status?.status, fetchStatus])

  // Dengar event dari halaman ModelSettings saat tombol retrain ditekan
  useEffect(() => {
    const handleStarted = (event: Event) => {
      const detail = (event as CustomEvent<RetrainStatus>).detail
      if (detail) {
        setStatus(detail)
        setReceivedAt(Date.now())
      }
      setVisible(true)
      void fetchStatus()
    }
    window.addEventListener(RETRAIN_STARTED_EVENT, handleStarted)
    return () => window.removeEventListener(RETRAIN_STARTED_EVENT, handleStarted)
  }, [fetchStatus])

  // Ticker 1 detik untuk menampilkan lama proses berjalan
  useEffect(() => {
    if (status?.status !== 'running') return
    timerRef.current = window.setInterval(() => setNow(Date.now()), 1000)
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current)
    }
  }, [status?.status])

  // Notifikasi berhasil/gagal tertutup otomatis setelah 15 detik
  useEffect(() => {
    if (!visible || !status || status.status === 'running') return
    const id = window.setTimeout(() => setVisible(false), 15000)
    return () => window.clearTimeout(id)
  }, [visible, status])

  if (!visible || !status || status.status === 'idle') return null

  // Lama berjalan = nilai terakhir dari backend + selisih sejak polling terakhir
  const runningElapsed = status.elapsed_seconds !== null
    ? status.elapsed_seconds + Math.max(0, (now - receivedAt) / 1000)
    : null

  const isRunning = status.status === 'running'
  const isSuccess = status.status === 'success'

  return (
    <div className={`retrain-toast ${status.status}`} role={isRunning ? 'status' : 'alert'} aria-live="polite">
      <span className="retrain-toast-icon">
        {isRunning ? <Loader2 className="spin" aria-hidden="true" /> : isSuccess ? <CheckCircle2 aria-hidden="true" /> : <XCircle aria-hidden="true" />}
      </span>
      <div className="retrain-toast-body">
        <strong>
          {isRunning ? 'Sedang melakukan proses retraining' : isSuccess ? 'Retraining berhasil' : 'Retraining gagal'}
        </strong>
        {isRunning ? (
          <p>
            Proses berjalan di belakang layar, Anda tetap bisa berpindah halaman.
            <br />Waktu berjalan: <b>{formatDuration(runningElapsed)}</b>
          </p>
        ) : isSuccess ? (
          <p>
            Proses retraining selesai dalam <b>{formatDuration(status.duration_seconds)}</b>.
            <br />{status.message}
          </p>
        ) : (
          <p>
            {status.message || 'Terjadi kesalahan saat retraining.'}
            <br />Proses berhenti setelah <b>{formatDuration(status.duration_seconds)}</b>.
          </p>
        )}
      </div>
      {!isRunning && (
        <button type="button" className="retrain-toast-close" aria-label="Tutup notifikasi" onClick={() => setVisible(false)}>
          <X aria-hidden="true" />
        </button>
      )}
    </div>
  )
}

export default RetrainNotifier
