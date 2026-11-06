export type RetrainStatus = {
  job_id: string | null
  status: 'idle' | 'running' | 'success' | 'failed'
  started_at: string | null
  finished_at: string | null
  duration_seconds: number | null
  elapsed_seconds: number | null
  message: string | null
  hasil: unknown[]
}

export const RETRAIN_STARTED_EVENT = 'retrain:started'
export const RETRAIN_STATUS_EVENT = 'retrain:status'

export function formatDuration(totalSeconds: number | null | undefined) {
  if (totalSeconds === null || totalSeconds === undefined || !Number.isFinite(totalSeconds)) return '—'
  const seconds = Math.max(0, totalSeconds)
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60
  const parts: string[] = []
  if (hours > 0) parts.push(`${hours} jam`)
  if (minutes > 0) parts.push(`${minutes} menit`)
  parts.push(hours > 0 || minutes > 0 ? `${Math.floor(secs)} detik` : `${secs.toFixed(1).replace('.', ',')} detik`)
  return parts.join(' ')
}
