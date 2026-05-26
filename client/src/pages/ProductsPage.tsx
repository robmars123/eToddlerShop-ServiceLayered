import { useEffect, useState } from 'react'
import type { Product } from '../types'
import { Navbar } from '../components/Navbar'
import { ProductCard } from '../components/ProductCard'
import { fetchProducts } from '../services/productsService'
import { useCart } from '../components/Cart/CartStore'

const Status = {
  Loading: 'loading',
  Error: 'error',
  Ok: 'ok',
} as const

type StatusValue = (typeof Status)[keyof typeof Status]

export function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [status, setStatus] = useState<StatusValue>(Status.Loading)
  const { addToCart } = useCart()

  function load() {
    setStatus(Status.Loading)
    fetchProducts()
      .then(data => { setProducts(data); setStatus(Status.Ok) })
      .catch(() => setStatus(Status.Error))
  }

  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-screen bg-white">
      <Navbar />

      <main className="max-w-6xl mx-auto px-6 py-10">
        <div className="mb-8 flex items-baseline justify-between">
          <h1 className="text-xl font-semibold tracking-[0.15em] uppercase text-[#1A1A1A]">
            All Products
          </h1>
          {status === Status.Ok && (
            <span className="text-xs text-gray-400 tracking-wide">
              {products.length} products
            </span>
          )}
        </div>

        {status === Status.Loading && (
          <p className="text-sm text-gray-400 tracking-wide">Loading…</p>
        )}

        {status === Status.Error && (
          <div className="flex flex-col items-start gap-3">
            <p className="text-sm text-red-500" role="alert">Failed to load products.</p>
            <button
              onClick={load}
              className="text-xs tracking-widest uppercase border border-[#1A1A1A] text-[#1A1A1A] px-4 py-2 hover:bg-[#1A1A1A] hover:text-white transition-colors duration-200"
            >
              Try Again
            </button>
          </div>
        )}

        {status === Status.Ok && products.length === 0 && (
          <p className="text-sm text-gray-400 tracking-wide">No products found.</p>
        )}

        {status === Status.Ok && products.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-5 gap-y-10">
            {products.map(product => (
              <ProductCard
                key={product.id}
                product={product}
                onAddToCart={addToCart}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

export default ProductsPage
