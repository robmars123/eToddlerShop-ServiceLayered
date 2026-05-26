import { useEffect, useState, useCallback } from 'react'
import { Navbar } from '../components/Navbar/Navbar'
import { API_URL } from '../config'

interface ServiceHealth {
  status: 'ok' | 'error'
  latency_ms?: number
  error?: string
}

interface HealthResponse {
  status: 'ok' | 'degraded' | 'down'
  timestamp: string
  uptime_seconds: number
  environment: string
  services: {
    database: ServiceHealth
    redis: ServiceHealth
    storage: ServiceHealth
  }
}

function formatUptime(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}h ${m}m ${s}s`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    ok:       'bg-green-50 text-green-700 border-green-200',
    degraded: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    error:    'bg-red-50 text-red-700 border-red-200',
    down:     'bg-red-50 text-red-700 border-red-200',
  }
  const dots: Record<string, string> = {
    ok:       'bg-green-500',
    degraded: 'bg-yellow-500',
    error:    'bg-red-500',
    down:     'bg-red-500',
  }
  return (
    <span className={`inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest px-2.5 py-1 rounded-full border ${styles[status] ?? 'bg-gray-50 text-gray-600 border-gray-200'}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dots[status] ?? 'bg-gray-400'}`} />
      {status}
    </span>
  )
}

function ServiceRow({ name, svc }: { name: string; svc: ServiceHealth }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0">
      <span className="text-sm font-medium text-[#1A1A1A] capitalize">{name}</span>
      <div className="flex items-center gap-4">
        {svc.latency_ms !== undefined && (
          <span className="text-xs text-gray-400">{svc.latency_ms} ms</span>
        )}
        {svc.error && (
          <span className="text-xs text-red-500 max-w-[240px] truncate" title={svc.error}>{svc.error}</span>
        )}
        <StatusBadge status={svc.status} />
      </div>
    </div>
  )
}

export function HealthPage() {
  const [data, setData] = useState<HealthResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastChecked, setLastChecked] = useState<Date | null>(null)

  const fetchHealth = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API_URL}/api/v1/health`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setData(await res.json() as HealthResponse)
      setLastChecked(new Date())
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void fetchHealth() }, [fetchHealth])

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const id = setInterval(() => { void fetchHealth() }, 30_000)
    return () => clearInterval(id)
  }, [fetchHealth])

  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      <div className="max-w-2xl mx-auto px-6 py-10">

        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold text-[#1A1A1A] tracking-tight">System Health</h1>
            {lastChecked && (
              <p className="text-xs text-gray-400 mt-1">
                Last checked {lastChecked.toLocaleTimeString()} · auto-refreshes every 30s
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => { void fetchHealth() }}
            disabled={loading}
            className="text-xs tracking-widest uppercase border border-[#1A1A1A] text-[#1A1A1A] px-4 py-2 hover:bg-[#1A1A1A] hover:text-white transition-colors disabled:opacity-40"
          >
            {loading ? 'Checking…' : 'Refresh'}
          </button>
        </div>

        {error && !data && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-5 py-4 text-sm text-red-700">
            Cannot reach health endpoint: {error}
          </div>
        )}

        {data && (
          <div className="flex flex-col gap-6">
            {/* Overall status */}
            <div className="border border-gray-100 rounded-lg p-5 flex items-center justify-between">
              <div className="flex flex-col gap-1">
                <span className="text-xs text-gray-400 uppercase tracking-widest">Overall</span>
                <StatusBadge status={data.status} />
              </div>
              <div className="flex flex-col items-end gap-1 text-xs text-gray-500">
                <span>Uptime: <span className="font-medium text-[#1A1A1A]">{formatUptime(data.uptime_seconds)}</span></span>
                <span>Env: <span className="font-medium text-[#1A1A1A]">{data.environment}</span></span>
              </div>
            </div>

            {/* Services */}
            <div className="border border-gray-100 rounded-lg px-5 py-2">
              <p className="text-xs text-gray-400 uppercase tracking-widest pt-3 pb-2">Services</p>
              {Object.entries(data.services).map(([name, svc]) => (
                <ServiceRow key={name} name={name} svc={svc} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default HealthPage
