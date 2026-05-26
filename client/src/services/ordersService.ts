import { getStoredToken } from '../features/Auth'
import { API_URL } from '../config'

export interface OrderItemPayload {
  product_id: number
  quantity: number
  unit_price: number
}

export interface OrderPayload {
  user_id: number
  items: OrderItemPayload[]
}

export interface OrderResponse {
  id: number
  user_id: number
  status: string
  items: { id: number; product_id: number; quantity: number; unit_price: number }[]
  created_at: string
}

function authHeaders(): HeadersInit {
  const token = getStoredToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export async function createOrder(payload: OrderPayload): Promise<OrderResponse> {
  const res = await fetch(`${API_URL}/api/v1/orders/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(payload),
  })
  if (res.status === 401) throw new Error('Please sign in to place an order')
  if (!res.ok) throw new Error('Failed to place order. Please try again.')
  return res.json() as Promise<OrderResponse>
}

export async function cancelOrder(orderId: number): Promise<OrderResponse> {
  const res = await fetch(`${API_URL}/api/v1/orders/${orderId}/cancel`, {
    method: 'POST',
    headers: { ...authHeaders() },
  })
  if (res.status === 401) throw new Error('Please sign in to manage orders')
  if (res.status === 409) {
    const body = await res.json() as { detail?: string }
    throw new Error(body.detail ?? 'Order cannot be cancelled')
  }
  if (!res.ok) throw new Error('Failed to cancel order. Please try again.')
  return res.json() as Promise<OrderResponse>
}

export interface OrderPeriodStat {
  period: string
  count: number
  revenue: number
}

export interface OrderAnalytics {
  by_day: OrderPeriodStat[]
  by_month: OrderPeriodStat[]
  by_year: OrderPeriodStat[]
  total_orders: number
  total_revenue: number
}

export async function fetchOrderAnalytics(): Promise<OrderAnalytics> {
  const res = await fetch(`${API_URL}/api/v1/orders/analytics`, {
    headers: { ...authHeaders() },
  })
  if (!res.ok) throw new Error('Failed to load analytics')
  return res.json() as Promise<OrderAnalytics>
}

export async function fetchMyOrders(): Promise<OrderResponse[]> {
  const res = await fetch(`${API_URL}/api/v1/orders/my`, {
    headers: { ...authHeaders() },
  })
  if (res.status === 401) throw new Error('Please sign in to view your orders')
  if (!res.ok) throw new Error('Failed to load orders. Please try again.')
  return res.json() as Promise<OrderResponse[]>
}
