import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Navbar } from '../components/Navbar/Navbar'
import { fetchMyOrders, cancelOrder, type OrderResponse } from '../services/ordersService'

const STATUS_STYLES: Record<string, string> = {
  pending:    'bg-yellow-50 text-yellow-700 border-yellow-200',
  confirmed:  'bg-blue-50 text-blue-700 border-blue-200',
  shipped:    'bg-purple-50 text-purple-700 border-purple-200',
  delivered:  'bg-green-50 text-green-700 border-green-200',
  cancelled:  'bg-red-50 text-red-700 border-red-200',
}

function statusStyle(status: string) {
  return STATUS_STYLES[status.toLowerCase()] ?? 'bg-gray-50 text-gray-700 border-gray-200'
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

function OrderCard({ order, onCancelled }: { order: OrderResponse; onCancelled: (updated: OrderResponse) => void }) {
  const total = order.items.reduce((sum, i) => sum + i.unit_price * i.quantity, 0)
  const [cancelling, setCancelling] = useState(false)
  const [cancelError, setCancelError] = useState<string | null>(null)
  const canCancel = order.status === 'pending'

  async function handleCancel() {
    if (!window.confirm(`Cancel Order #${order.id}? This cannot be undone.`)) return
    setCancelling(true)
    setCancelError(null)
    try {
      const updated = await cancelOrder(order.id)
      onCancelled(updated)
    } catch (err) {
      setCancelError((err as Error).message)
    } finally {
      setCancelling(false)
    }
  }

  return (
    <div className="border border-gray-100 rounded-lg overflow-hidden">
      {/* Order header */}
      <div className="flex items-center justify-between px-5 py-3 bg-[#F5F5F0] border-b border-gray-100 flex-wrap gap-2">
        <div className="flex items-center gap-4 text-xs text-gray-500">
          <span className="font-medium text-[#1A1A1A]">Order #{order.id}</span>
          <span>{formatDate(order.created_at)}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-[#1A1A1A]">${total.toFixed(2)}</span>
          <span className={`text-[10px] font-semibold uppercase tracking-widest px-2.5 py-1 rounded-full border ${statusStyle(order.status)}`}>
            {order.status}
          </span>
          {canCancel && (
            <button
              type="button"
              onClick={() => { void handleCancel() }}
              disabled={cancelling}
              className="text-[10px] font-semibold uppercase tracking-widest px-2.5 py-1 rounded-full border border-red-200 text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
            >
              {cancelling ? 'Cancelling…' : 'Cancel'}
            </button>
          )}
        </div>
      </div>

      {cancelError && (
        <p role="alert" className="px-5 py-2 text-xs text-red-600 bg-red-50">{cancelError}</p>
      )}

      {/* Items */}
      <ul className="divide-y divide-gray-50">
        {order.items.map(item => (
          <li key={item.id} className="flex items-center justify-between px-5 py-3 text-sm">
            <Link
              to={`/products/${item.product_id}`}
              className="text-[#1A1A1A] hover:text-[#D4513A] underline underline-offset-2 transition-colors"
            >
              Product #{item.product_id}
            </Link>
            <div className="flex items-center gap-6 text-gray-500 text-xs">
              <span>Qty: {item.quantity}</span>
              <span>${item.unit_price.toFixed(2)} each</span>
              <span className="font-medium text-[#1A1A1A]">${(item.unit_price * item.quantity).toFixed(2)}</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function OrdersPage() {
  const [orders, setOrders] = useState<OrderResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    fetchMyOrders()
      .then(data => setOrders(data.sort((a, b) => b.id - a.id)))
      .catch(err => setError((err as Error).message))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      <div className="max-w-3xl mx-auto px-6 py-10">
        <h1 className="text-2xl font-semibold text-[#1A1A1A] tracking-tight mb-8">My Orders</h1>

        {loading && (
          <div className="flex justify-center py-20">
            <span className="flex gap-1.5">
              <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce [animation-delay:0ms]" />
              <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce [animation-delay:150ms]" />
              <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce [animation-delay:300ms]" />
            </span>
          </div>
        )}

        {error && !loading && (
          <div className="text-center py-20">
            <p role="alert" className="text-sm text-red-600 mb-4">{error}</p>
            <button
              onClick={() => { setError(null); setLoading(true); fetchMyOrders().then(data => setOrders(data.sort((a, b) => b.id - a.id))).catch(err => setError((err as Error).message)).finally(() => setLoading(false)) }}
              className="text-xs tracking-widest uppercase border border-[#1A1A1A] text-[#1A1A1A] px-4 py-2 hover:bg-[#1A1A1A] hover:text-white transition-colors"
            >
              Try Again
            </button>
          </div>
        )}

        {!loading && !error && orders.length === 0 && (
          <div className="text-center py-20 text-gray-400">
            <p className="text-sm mb-3">You haven't placed any orders yet.</p>
            <Link to="/" className="text-xs tracking-widest uppercase border border-[#1A1A1A] text-[#1A1A1A] px-4 py-2 hover:bg-[#1A1A1A] hover:text-white transition-colors">
              Start Shopping
            </Link>
          </div>
        )}

        {!loading && !error && orders.length > 0 && (
          <div className="flex flex-col gap-5">
            {orders.map(order => (
              <OrderCard
                key={order.id}
                order={order}
                onCancelled={updated => setOrders(prev => prev.map(o => o.id === updated.id ? updated : o))}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default OrdersPage
