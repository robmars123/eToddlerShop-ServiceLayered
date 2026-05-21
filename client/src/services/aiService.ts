import { API_URL } from '../config'
import { getStoredToken } from '../features/Auth/AuthContext'

export interface RecommendFilters {
  category: string
  age: number | null
  price_exact: number | null
  price_min: number | null
  price_max: number | null
  price_above: number | null
  price_below: number | null
  tags: string[]
}

export interface RecommendResult {
  ranked_product_ids: number[]
  query: string
  filters: RecommendFilters
}

export interface EmbedResult {
  indexed: number
  message: string
}

export async function embedProducts(): Promise<EmbedResult> {
  const res = await fetch(`${API_URL}/api/v1/ai/embed-products`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${getStoredToken()}` },
  })
  if (!res.ok) throw new Error('Indexing failed')
  return res.json() as Promise<EmbedResult>
}

export async function recommendProducts(message: string): Promise<RecommendResult> {
  const res = await fetch(`${API_URL}/api/v1/ai/recommend`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
  })
  if (!res.ok) throw new Error('Recommendation failed')
  return res.json() as Promise<RecommendResult>
}
