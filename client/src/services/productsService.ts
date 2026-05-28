import { getStoredToken } from '../features/Auth'
import type { Product } from '../types'
import { API_URL } from '../config'

function authHeaders(): HeadersInit {
  const token = getStoredToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export async function fetchProducts(): Promise<Product[]> {
  const res = await fetch(`${API_URL}/api/v1/products/`)
  if (!res.ok) throw new Error('Failed to fetch products')
  return res.json() as Promise<Product[]>
}

export async function fetchProductsByIds(ids: number[]): Promise<Product[]> {
  const res = await fetch(`${API_URL}/api/v1/products/batch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids }),
  })
  if (!res.ok) throw new Error('Failed to fetch products')
  return res.json() as Promise<Product[]>
}

export async function fetchProduct(id: number): Promise<Product> {
  const res = await fetch(`${API_URL}/api/v1/products/${id}`)
  if (!res.ok) throw new Error('Product not found')
  return res.json() as Promise<Product>
}

export interface ProductPayload {
  name: string
  description: string | null
  price: number
}

export async function createProduct(payload: ProductPayload): Promise<Product> {
  const res = await fetch(`${API_URL}/api/v1/products/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error('Failed to create product')
  return res.json() as Promise<Product>
}

export async function updateProduct(id: number, payload: ProductPayload): Promise<Product> {
  const res = await fetch(`${API_URL}/api/v1/products/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error('Failed to update product')
  return res.json() as Promise<Product>
}

export async function deleteProduct(id: number): Promise<void> {
  const res = await fetch(`${API_URL}/api/v1/products/${id}`, {
    method: 'DELETE',
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error('Failed to delete product')
}

export async function uploadProductImage(id: number, file: File): Promise<Product> {
  const form = new FormData()
  form.append('file', file)
  const res = await fetch(`${API_URL}/api/v1/products/${id}/image`, {
    method: 'POST',
    headers: authHeaders(),
    body: form,
  })
  if (!res.ok) throw new Error('Failed to upload image')
  return res.json() as Promise<Product>
}

export function productImageUrl(image_url: string | null): string | null {
  return image_url ?? null
}
