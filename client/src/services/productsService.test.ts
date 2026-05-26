/**
 * Unit tests for productsService.
 *
 * Strategy: mock global fetch + getStoredToken so tests run in isolation
 * with no network or auth dependency.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Hoisted — must appear before the service import so the mock is in place
// when productsService.ts executes its own import of getStoredToken.
vi.mock('../features/Auth', () => ({
  getStoredToken: vi.fn(),
}))

import { getStoredToken } from '../features/Auth'
import {
  createProduct,
  deleteProduct,
  fetchProduct,
  fetchProducts,
  updateProduct,
} from './productsService'

const mockGetToken = vi.mocked(getStoredToken)

// Replace the global fetch with a controllable spy for every test.
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

beforeEach(() => {
  mockFetch.mockReset()
  mockGetToken.mockReturnValue(null)
})

afterEach(() => vi.clearAllMocks())

// ── fetchProducts ─────────────────────────────────────────────────────────────

describe('fetchProducts', () => {
  it('returns the parsed product array on success', async () => {
    const products = [{ id: 1, name: 'Rattle', price: 5.99, description: null, image_url: null }]
    mockFetch.mockResolvedValue(jsonResponse(products))

    const result = await fetchProducts()

    expect(result).toEqual(products)
    expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/products/'))
  })

  it('throws when the response is not ok', async () => {
    mockFetch.mockResolvedValue(new Response('', { status: 500 }))

    await expect(fetchProducts()).rejects.toThrow('Failed to fetch products')
  })
})

// ── fetchProduct ──────────────────────────────────────────────────────────────

describe('fetchProduct', () => {
  it('fetches a single product by id', async () => {
    const product = { id: 7, name: 'Block', price: 12, description: null, image_url: null }
    mockFetch.mockResolvedValue(jsonResponse(product))

    const result = await fetchProduct(7)

    expect(result).toEqual(product)
    expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/products/7'))
  })

  it('throws on 404', async () => {
    mockFetch.mockResolvedValue(new Response('', { status: 404 }))

    await expect(fetchProduct(99)).rejects.toThrow('Product not found')
  })
})

// ── createProduct ─────────────────────────────────────────────────────────────

describe('createProduct', () => {
  it('sends the payload as JSON with an Authorization header when a token exists', async () => {
    mockGetToken.mockReturnValue('tok-abc')
    mockFetch.mockResolvedValue(jsonResponse({ id: 2, name: 'Bib', price: 3, description: null, image_url: null }))

    await createProduct({ name: 'Bib', description: null, price: 3 })

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit]
    expect((init.headers as Record<string, string>)['Authorization']).toBe('Bearer tok-abc')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body as string)).toMatchObject({ name: 'Bib', price: 3 })
  })

  it('omits Authorization header when no token is stored', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ id: 3, name: 'Toy', price: 1, description: null, image_url: null }))

    await createProduct({ name: 'Toy', description: null, price: 1 })

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit]
    expect((init.headers as Record<string, string>)['Authorization']).toBeUndefined()
  })

  it('throws on failure', async () => {
    mockFetch.mockResolvedValue(new Response('', { status: 403 }))

    await expect(createProduct({ name: 'X', description: null, price: 1 })).rejects.toThrow('Failed to create product')
  })
})

// ── updateProduct ─────────────────────────────────────────────────────────────

describe('updateProduct', () => {
  it('uses the PUT method', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ id: 4, name: 'Updated', price: 9, description: null, image_url: null }))

    await updateProduct(4, { name: 'Updated', description: null, price: 9 })

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit]
    expect(init.method).toBe('PUT')
  })
})

// ── deleteProduct ─────────────────────────────────────────────────────────────

describe('deleteProduct', () => {
  it('uses the DELETE method and sends no body', async () => {
    // jsdom doesn't support 204 in Response constructor; use 200 — we're testing method, not status.
    mockFetch.mockResolvedValue(new Response('', { status: 200 }))

    await deleteProduct(5)

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit]
    expect(init.method).toBe('DELETE')
    expect(init.body).toBeUndefined()
  })

  it('throws on failure', async () => {
    mockFetch.mockResolvedValue(new Response('', { status: 500 }))

    await expect(deleteProduct(5)).rejects.toThrow('Failed to delete product')
  })
})
