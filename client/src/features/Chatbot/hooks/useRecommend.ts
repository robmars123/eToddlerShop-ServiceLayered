import { useState } from 'react'
import { recommendProducts, type RecommendResult } from '../../../services/aiService'
import { fetchProducts } from '../../../services/productsService'
import type { Product } from '../../../types'

export type SortOption = 'relevance' | 'price_asc' | 'price_desc'
export type GridCols = 2 | 3 | 4

export function useRecommend() {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<RecommendResult | null>(null)
  const [rankedProducts, setRankedProducts] = useState<Product[]>([])
  const [sort, setSort] = useState<SortOption>('relevance')
  const [cols, setCols] = useState<GridCols>(3)

  async function search(overrideText?: string): Promise<void> {
    const text = (overrideText ?? query).trim()
    if (!text || loading) return
    setLoading(true)
    setError(null)
    setResult(null)
    setRankedProducts([])
    setSort('relevance')
    try {
      const [recommend, allProducts] = await Promise.all([
        recommendProducts(text),
        fetchProducts(),
      ])
      setResult(recommend)
      const productMap = new Map(allProducts.map(p => [p.id, p]))
      const ranked = recommend.ranked_product_ids
        .map(id => productMap.get(id))
        .filter((p): p is Product => p !== undefined)
      setRankedProducts(ranked)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  function displayProducts(): Product[] {
    if (sort === 'price_asc') return [...rankedProducts].sort((a, b) => a.price - b.price)
    if (sort === 'price_desc') return [...rankedProducts].sort((a, b) => b.price - a.price)
    return rankedProducts
  }

  return {
    query, setQuery,
    loading, error,
    result,
    products: displayProducts(),
    sort, setSort,
    cols, setCols,
    search,
  }
}
