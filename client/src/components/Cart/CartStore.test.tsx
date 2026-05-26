/**
 * Integration tests for CartStore context.
 *
 * Uses renderHook to exercise the real CartProvider + useCart without
 * rendering any UI — tests the state machine directly.
 */
import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { ReactNode } from 'react'
import { CartProvider, useCart } from './CartStore'
import type { Product } from '../../types'

const wrapper = ({ children }: { children: ReactNode }) => (
  <CartProvider>{children}</CartProvider>
)

const p = (id: number, price = 10): Product => ({
  id,
  name: `Product ${id}`,
  description: null,
  price,
  image_url: null,
})

describe('CartStore', () => {
  it('starts empty', () => {
    const { result } = renderHook(() => useCart(), { wrapper })

    expect(result.current.items).toHaveLength(0)
    expect(result.current.totalCount).toBe(0)
    expect(result.current.subtotal).toBe(0)
  })

  it('addToCart adds a new item with quantity 1', () => {
    const { result } = renderHook(() => useCart(), { wrapper })

    act(() => result.current.addToCart(p(1)))

    expect(result.current.items).toHaveLength(1)
    expect(result.current.items[0].quantity).toBe(1)
    expect(result.current.totalCount).toBe(1)
  })

  it('addToCart increments quantity for an existing item', () => {
    const { result } = renderHook(() => useCart(), { wrapper })

    act(() => {
      result.current.addToCart(p(1))
      result.current.addToCart(p(1))
    })

    expect(result.current.items).toHaveLength(1)
    expect(result.current.items[0].quantity).toBe(2)
    expect(result.current.totalCount).toBe(2)
  })

  it('removeFromCart removes the item entirely', () => {
    const { result } = renderHook(() => useCart(), { wrapper })

    act(() => {
      result.current.addToCart(p(1))
      result.current.addToCart(p(2))
      result.current.removeFromCart(1)
    })

    expect(result.current.items).toHaveLength(1)
    expect(result.current.items[0].product.id).toBe(2)
  })

  it('updateQuantity changes the item count', () => {
    const { result } = renderHook(() => useCart(), { wrapper })

    act(() => {
      result.current.addToCart(p(1))
      result.current.updateQuantity(1, 5)
    })

    expect(result.current.items[0].quantity).toBe(5)
    expect(result.current.totalCount).toBe(5)
  })

  it('updateQuantity with 0 removes the item', () => {
    const { result } = renderHook(() => useCart(), { wrapper })

    act(() => {
      result.current.addToCart(p(1))
      result.current.updateQuantity(1, 0)
    })

    expect(result.current.items).toHaveLength(0)
  })

  it('computes subtotal correctly across multiple items', () => {
    const { result } = renderHook(() => useCart(), { wrapper })

    act(() => {
      result.current.addToCart(p(1, 10))  // 10 × 1
      result.current.addToCart(p(2, 5))   //  5 × 1
      result.current.addToCart(p(1, 10))  // 10 × 2 after second add
    })

    // item 1: qty=2 @ $10 = $20, item 2: qty=1 @ $5 = $5 → total $25
    expect(result.current.subtotal).toBe(25)
    expect(result.current.totalCount).toBe(3)
  })
})
