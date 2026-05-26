import { useState, useEffect, useRef, useCallback, type FormEvent, type ReactNode } from 'react'
import { Navbar } from '../components/Navbar'
import {
  fetchProducts, createProduct, updateProduct,
  deleteProduct, uploadProductImage,
} from '../services/productsService'
import { embedProducts } from '../services/aiService'
import { fetchOrderAnalytics, type OrderAnalytics, type OrderPeriodStat } from '../services/ordersService'
import type { Product } from '../types'
import { API_URL } from '../config'
import { getStoredToken } from '../features/Auth'
import {
  AddProductForm, ProductsTable, EMPTY_FORM, toPayload, isValidForm, type ProductFormData,
} from '../components/Admin'

// ── Types ──────────────────────────────────────────────────────────────────────

type Section = 'products' | 'analytics' | 'health'

interface ServiceHealth { status: string; latency_ms?: number; error?: string }
interface HealthData {
  status: string; timestamp: string; uptime_seconds: number; environment: string
  services: { database: ServiceHealth; redis: ServiceHealth; storage: ServiceHealth }
}

// ── Sidebar ────────────────────────────────────────────────────────────────────

const NAV_ITEMS: { id: Section; label: string; icon: ReactNode }[] = [
  {
    id: 'products', label: 'Products',
    icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M20 7H4a1 1 0 00-1 1v10a1 1 0 001 1h16a1 1 0 001-1V8a1 1 0 00-1-1zM16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2" /></svg>,
  },
  {
    id: 'analytics', label: 'Analytics',
    icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 17h4v4H3v-4zm6-6h4v10H9V11zm6-6h4v16h-4V5z" /></svg>,
  },
  {
    id: 'health', label: 'Health',
    icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>,
  },
]

function Sidebar({ active, onSelect }: { active: Section; onSelect: (s: Section) => void }) {
  return (
    <aside className="w-52 shrink-0 border-r border-gray-100 min-h-[calc(100vh-65px)] pt-8 px-3">
      <p className="text-[10px] font-semibold tracking-widest uppercase text-gray-400 px-3 mb-3">Admin</p>
      <nav className="flex flex-col gap-0.5">
        {NAV_ITEMS.map(({ id, label, icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => onSelect(id)}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors w-full text-left ${
              active === id ? 'bg-[#1A1A1A] text-white' : 'text-gray-600 hover:bg-gray-50 hover:text-[#1A1A1A]'
            }`}
          >
            {icon}
            {label}
          </button>
        ))}
      </nav>
    </aside>
  )
}

// ── Health section ─────────────────────────────────────────────────────────────

function statusBadgeClass(s: string) {
  const m: Record<string, string> = {
    ok: 'bg-green-50 text-green-700 border-green-200',
    degraded: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    error: 'bg-red-50 text-red-700 border-red-200',
    down: 'bg-red-50 text-red-700 border-red-200',
  }
  return m[s] ?? 'bg-gray-50 text-gray-600 border-gray-200'
}

function dotClass(s: string) {
  const m: Record<string, string> = { ok: 'bg-green-500', degraded: 'bg-yellow-500', error: 'bg-red-500', down: 'bg-red-500' }
  return m[s] ?? 'bg-gray-400'
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest px-2.5 py-1 rounded-full border ${statusBadgeClass(status)}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dotClass(status)}`} />
      {status}
    </span>
  )
}

function formatUptime(s: number) {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60
  if (h > 0) return `${h}h ${m}m ${sec}s`
  if (m > 0) return `${m}m ${sec}s`
  return `${sec}s`
}

function HealthSection() {
  const [data, setData] = useState<HealthData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastChecked, setLastChecked] = useState<Date | null>(null)

  const fetchHealth = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const token = getStoredToken()
      const res = await fetch(`${API_URL}/api/v1/health`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setData(await res.json() as HealthData)
      setLastChecked(new Date())
    } catch (err) { setError((err as Error).message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { void fetchHealth() }, [fetchHealth])
  useEffect(() => {
    const id = setInterval(() => { void fetchHealth() }, 30_000)
    return () => clearInterval(id)
  }, [fetchHealth])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[#1A1A1A]">System Health</h2>
          {lastChecked && <p className="text-xs text-gray-400 mt-0.5">Last checked {lastChecked.toLocaleTimeString()} · auto-refreshes every 30s</p>}
        </div>
        <button
          type="button" onClick={() => { void fetchHealth() }} disabled={loading}
          className="text-xs tracking-widest uppercase border border-[#1A1A1A] text-[#1A1A1A] px-4 py-2 hover:bg-[#1A1A1A] hover:text-white transition-colors disabled:opacity-40"
        >
          {loading ? 'Checking…' : 'Refresh'}
        </button>
      </div>

      {error && <div className="bg-red-50 border border-red-200 rounded-lg px-5 py-4 text-sm text-red-700">Cannot reach health endpoint: {error}</div>}

      {data && (
        <>
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

          <div className="border border-gray-100 rounded-lg px-5 py-2">
            <p className="text-xs text-gray-400 uppercase tracking-widest pt-3 pb-2">Services</p>
            {Object.entries(data.services).map(([name, svc]) => (
              <div key={name} className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0">
                <span className="text-sm font-medium text-[#1A1A1A] capitalize">{name}</span>
                <div className="flex items-center gap-4">
                  {svc.latency_ms !== undefined && <span className="text-xs text-gray-400">{svc.latency_ms} ms</span>}
                  {svc.error && <span className="text-xs text-red-500 max-w-[200px] truncate" title={svc.error}>{svc.error}</span>}
                  <StatusBadge status={svc.status} />
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ── Analytics — custom bar chart (no external library) ─────────────────────────

type TimeRange = 'day' | 'month' | 'year'
type Metric = 'count' | 'revenue'

const RANGE_LABELS: Record<TimeRange, string> = { day: 'Last 30 Days', month: 'Last 12 Months', year: 'All Years' }

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-gray-100 rounded-lg p-5">
      <p className="text-xs text-gray-400 uppercase tracking-widest mb-1">{label}</p>
      <p className="text-2xl font-semibold text-[#1A1A1A]">{value}</p>
    </div>
  )
}

function BarChart({ data, metric, range }: { data: OrderPeriodStat[]; metric: Metric; range: TimeRange }) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)
  const max = Math.max(...data.map(d => metric === 'count' ? d.count : d.revenue), 1)

  const tickCount = 4
  const ticks = Array.from({ length: tickCount + 1 }, (_, i) =>
    metric === 'revenue'
      ? `$${Math.round((max / tickCount) * i)}`
      : String(Math.round((max / tickCount) * i))
  ).reverse()

  const labelStep = data.length <= 12 ? 1 : data.length <= 31 ? 3 : Math.ceil(data.length / 8)

  return (
    <div className="flex gap-3">
      {/* Y-axis */}
      <div className="flex flex-col justify-between items-end pb-6 shrink-0 w-10">
        {ticks.map(t => (
          <span key={t} className="text-[10px] text-gray-400 leading-none">{t}</span>
        ))}
      </div>

      {/* Bars + X-axis */}
      <div className="flex-1 min-w-0">
        {/* Chart area: relative + fixed height so absolute children resolve % correctly */}
        <div className="relative h-52 border-b border-gray-100">
          {/* Horizontal gridlines */}
          {[0.25, 0.5, 0.75].map(f => (
            <div key={f} className="absolute left-0 right-0 border-t border-gray-50" style={{ bottom: `${f * 100}%` }} />
          ))}

          {/* Bar columns */}
          <div className="absolute inset-0 flex items-end gap-0.5">
            {data.map((item, i) => {
              const val = metric === 'count' ? item.count : item.revenue
              const pct = max > 0 ? (val / max) * 100 : 0
              const isHovered = hoveredIdx === i
              const isCurrent = isCurrentPeriod(item.period, range)
              const color = isCurrent
                ? '#D4513A'
                : metric === 'count' ? '#1A1A1A' : '#D4513A'
              const hoverColor = isCurrent ? '#c04030' : metric === 'count' ? '#444' : '#c04030'

              return (
                <div
                  key={item.period}
                  className="flex-1 relative h-full"
                  onMouseEnter={() => setHoveredIdx(i)}
                  onMouseLeave={() => setHoveredIdx(null)}
                >
                  {isHovered && (
                    <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
                      <div className="bg-white border border-gray-200 rounded-lg shadow-md px-3 py-2 text-xs whitespace-nowrap">
                        <p className="font-semibold text-[#1A1A1A] mb-1">{item.period}</p>
                        <p className="text-gray-500">{item.count} order{item.count !== 1 ? 's' : ''}</p>
                        <p className="text-gray-500">${item.revenue.toFixed(2)} revenue</p>
                      </div>
                    </div>
                  )}
                  {/* Bar anchored to bottom; height % resolves against the h-52 container */}
                  <div
                    className="absolute bottom-0 left-0 right-0 rounded-t-sm transition-colors"
                    style={{
                      height: `${Math.max(pct, val > 0 ? 1 : 0)}%`,
                      backgroundColor: isHovered ? hoverColor : color,
                    }}
                  />
                </div>
              )
            })}
          </div>
        </div>

        {/* X-axis labels */}
        <div className="flex gap-0.5 mt-1.5">
          {data.map((item, i) => (
            <div key={item.period} className="flex-1 overflow-hidden">
              {i % labelStep === 0 && (
                <span className="block text-[9px] text-gray-400 truncate">
                  {item.period.length > 7 ? item.period.slice(5) : item.period}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function padDays(data: OrderPeriodStat[]): OrderPeriodStat[] {
  const map = new Map(data.map(d => [d.period, d]))
  const today = new Date()
  return Array.from({ length: 30 }, (_, i) => {
    const d = new Date(today)
    d.setDate(d.getDate() - (29 - i))
    const key = d.toISOString().slice(0, 10)
    return map.get(key) ?? { period: key, count: 0, revenue: 0 }
  })
}

function padMonths(data: OrderPeriodStat[]): OrderPeriodStat[] {
  const map = new Map(data.map(d => [d.period, d]))
  const today = new Date()
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(today.getFullYear(), today.getMonth() - (11 - i), 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    return map.get(key) ?? { period: key, count: 0, revenue: 0 }
  })
}

const TODAY = new Date().toISOString().slice(0, 10)
const THIS_MONTH = TODAY.slice(0, 7)
const THIS_YEAR = TODAY.slice(0, 4)

function isCurrentPeriod(period: string, range: TimeRange) {
  if (range === 'day')   return period === TODAY
  if (range === 'month') return period === THIS_MONTH
  return period === THIS_YEAR
}

function AnalyticsSection() {
  const [analytics, setAnalytics] = useState<OrderAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [range, setRange] = useState<TimeRange>('month')
  const [metric, setMetric] = useState<Metric>('count')

  useEffect(() => {
    setLoading(true)
    fetchOrderAnalytics()
      .then(setAnalytics)
      .catch(err => setError((err as Error).message))
      .finally(() => setLoading(false))
  }, [])

  const chartData = analytics
    ? (range === 'day' ? padDays(analytics.by_day) : range === 'month' ? padMonths(analytics.by_month) : analytics.by_year)
    : []

  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-lg font-semibold text-[#1A1A1A]">Orders Analytics</h2>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {loading && (
        <div className="flex justify-center py-16">
          <span className="flex gap-1.5">
            {[0, 150, 300].map(d => (
              <span key={d} className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />
            ))}
          </span>
        </div>
      )}

      {analytics && !loading && (
        <>
          <div className="grid grid-cols-2 gap-4">
            <StatCard label="Total Orders" value={analytics.total_orders.toString()} />
            <StatCard label="Total Revenue" value={`$${analytics.total_revenue.toFixed(2)}`} />
          </div>

          <div className="border border-gray-100 rounded-lg p-5">
            <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
              {/* Metric toggle */}
              <div className="flex items-center gap-1 border border-gray-200 rounded-md p-0.5">
                {(['count', 'revenue'] as Metric[]).map(m => (
                  <button
                    key={m} type="button" onClick={() => setMetric(m)}
                    className={`text-xs px-3 py-1.5 rounded transition-colors ${metric === m ? 'bg-[#1A1A1A] text-white' : 'text-gray-500 hover:text-[#1A1A1A]'}`}
                  >
                    {m === 'count' ? 'Orders' : 'Revenue'}
                  </button>
                ))}
              </div>

              {/* Time range toggle */}
              <div className="flex items-center gap-1 border border-gray-200 rounded-md p-0.5">
                {(Object.keys(RANGE_LABELS) as TimeRange[]).map(r => (
                  <button
                    key={r} type="button" onClick={() => setRange(r)}
                    className={`text-xs px-3 py-1.5 rounded transition-colors ${range === r ? 'bg-[#1A1A1A] text-white' : 'text-gray-500 hover:text-[#1A1A1A]'}`}
                  >
                    {RANGE_LABELS[r]}
                  </button>
                ))}
              </div>
            </div>

            {chartData.length > 0 ? (
              <BarChart data={chartData} metric={metric} range={range} />
            ) : (
              <div className="flex items-center justify-center h-40 text-gray-400 text-sm">
                No order data for this period
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

// ── Products section ───────────────────────────────────────────────────────────

function ProductsSection() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [pageError, setPageError] = useState<string | null>(null)
  const [addForm, setAddForm] = useState<ProductFormData>(EMPTY_FORM)
  const [addImageFile, setAddImageFile] = useState<File | null>(null)
  const [addError, setAddError] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState<ProductFormData>(EMPTY_FORM)
  const [editError, setEditError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [uploadingId, setUploadingId] = useState<number | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [indexing, setIndexing] = useState(false)
  const [indexResult, setIndexResult] = useState<string | null>(null)
  const [indexError, setIndexError] = useState<string | null>(null)
  const fileInputRefs = useRef<Record<number, HTMLInputElement | null>>({})

  async function load() {
    setLoading(true); setPageError(null)
    try { setProducts(await fetchProducts()) }
    catch { setPageError('Failed to load products.') }
    finally { setLoading(false) }
  }

  useEffect(() => { void load() }, [])

  async function handleAdd(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const err = isValidForm(addForm)
    if (err) { setAddError(err); return }
    if (addImageFile && addImageFile.size > 5 * 1024 * 1024) { setAddError('Image must be under 5 MB.'); return }
    setAdding(true); setAddError(null)
    try {
      let created = await createProduct(toPayload(addForm))
      if (addImageFile) created = await uploadProductImage(created.id, addImageFile)
      setProducts(prev => [...prev, created])
      setAddForm(EMPTY_FORM); setAddImageFile(null)
    } catch { setAddError('Failed to add product.') }
    finally { setAdding(false) }
  }

  async function handleSaveEdit(id: number) {
    const err = isValidForm(editForm)
    if (err) { setEditError(err); return }
    setSaving(true); setEditError(null)
    try {
      const updated = await updateProduct(id, toPayload(editForm))
      setProducts(prev => prev.map(p => (p.id === id ? updated : p)))
      setEditingId(null)
    } catch { setEditError('Failed to update product.') }
    finally { setSaving(false) }
  }

  async function handleDelete(id: number) {
    if (!window.confirm('Delete this product? This cannot be undone.')) return
    try { await deleteProduct(id); setProducts(prev => prev.filter(p => p.id !== id)) }
    catch { setPageError('Failed to delete product.') }
  }

  async function handleImageUpload(product: Product, file: File) {
    if (file.size > 5 * 1024 * 1024) {
      setUploadError('Image must be under 5 MB.')
      const input = fileInputRefs.current[product.id]; if (input) input.value = ''; return
    }
    setUploadingId(product.id); setUploadError(null)
    try {
      const updated = await uploadProductImage(product.id, file)
      setProducts(prev => prev.map(p => (p.id === product.id ? updated : p)))
    } catch { setUploadError('Failed to upload image.') }
    finally {
      setUploadingId(null)
      const input = fileInputRefs.current[product.id]; if (input) input.value = ''
    }
  }

  async function handleIndexProducts() {
    setIndexing(true); setIndexResult(null); setIndexError(null)
    try { setIndexResult((await embedProducts()).message) }
    catch { setIndexError('Indexing failed. Make sure products exist and try again.') }
    finally { setIndexing(false) }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-[#1A1A1A]">Products</h2>
        <div className="flex flex-col items-end gap-1">
          <button
            type="button" onClick={() => void handleIndexProducts()} disabled={indexing}
            className="px-4 py-2 text-xs font-semibold tracking-widest uppercase bg-[#1A1A1A] text-white hover:bg-[#333] disabled:opacity-50 transition-colors"
          >
            {indexing ? 'Indexing…' : 'Index for AI Search'}
          </button>
          {indexResult && <p className="text-xs text-green-600">{indexResult}</p>}
          {indexError && <p className="text-xs text-red-600">{indexError}</p>}
        </div>
      </div>

      <AddProductForm
        form={addForm} imageFile={addImageFile}
        onChange={setAddForm} onImageChange={setAddImageFile}
        onSubmit={e => void handleAdd(e)} error={addError} adding={adding}
      />

      <ProductsTable
        products={products} loading={loading} pageError={pageError}
        uploadError={uploadError} editingId={editingId} editForm={editForm}
        editError={editError} saving={saving} uploadingId={uploadingId}
        fileInputRefs={fileInputRefs} onEditChange={setEditForm}
        onStartEdit={p => { setEditingId(p.id); setEditForm({ name: p.name, description: p.description ?? '', price: String(p.price) }); setEditError(null); setUploadError(null) }}
        onCancelEdit={() => { setEditingId(null); setEditError(null); setUploadError(null) }}
        onSaveEdit={id => void handleSaveEdit(id)}
        onDelete={id => void handleDelete(id)}
        onImageUpload={(product, file) => void handleImageUpload(product, file)}
      />
    </div>
  )
}

// ── AdminPage ──────────────────────────────────────────────────────────────────

export function AdminPage() {
  const [section, setSection] = useState<Section>('products')

  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      <div className="max-w-6xl mx-auto w-full flex">
        <Sidebar active={section} onSelect={setSection} />
        <main className="flex-1 min-w-0 px-8 py-8">
          {section === 'products'  && <ProductsSection />}
          {section === 'analytics' && <AnalyticsSection />}
          {section === 'health'    && <HealthSection />}
        </main>
      </div>
    </div>
  )
}

export default AdminPage
