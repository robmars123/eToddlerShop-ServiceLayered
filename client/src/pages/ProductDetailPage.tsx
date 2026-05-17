import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import type { Product } from '../types'
import { Navbar } from '../components/Navbar'
import { ShoppingCart } from '../components/ProductCard/ShoppingCartIcon'
import { fetchProduct, productImageUrl } from '../services/productsService'
import { useCart } from '../components/Cart/CartStore'

//const SIZES = ['XS', 'S', 'M', 'L', 'XL']

const Status = {
  Loading: 'loading',
  Error: 'error',
  Ok: 'ok',
} as const

type StatusValue = (typeof Status)[keyof typeof Status]

export function ProductDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { addToCart } = useCart()

  const [product, setProduct] = useState<Product | null>(null)
  const [status, setStatus] = useState<StatusValue>(Status.Loading)
  //const [selectedSize, setSelectedSize] = useState<string>(SIZES[2])
  const [added, setAdded] = useState(false)

  useEffect(() => {
    const numId = Number(id)
    if (!id || !Number.isInteger(numId) || numId < 1) {
      setStatus(Status.Error)
      return
    }
    setStatus(Status.Loading)
    fetchProduct(numId)
      .then(data => { setProduct(data); setStatus(Status.Ok) })
      .catch(() => setStatus(Status.Error))
  }, [id])

  function handleAddToCart() {
    if (!product) return
    addToCart(product)
    setAdded(true)
    setTimeout(() => setAdded(false), 1800)
  }

  return (
    <div className="min-h-screen bg-white overflow-x-clip">
      <Navbar />

      <main className="w-full max-w-6xl mx-auto px-6 py-10">
        {/* Breadcrumb */}
        <nav className="text-xs text-gray-400 tracking-wide mb-8 flex items-center gap-2" aria-label="Breadcrumb">
          <Link to="/" className="hover:text-[#1A1A1A] transition-colors">All Products</Link>
          <span>/</span>
          <span className="text-[#1A1A1A]">{product?.name ?? '…'}</span>
        </nav>

        {status === Status.Loading && (
          <p className="text-sm text-gray-400 tracking-wide">Loading…</p>
        )}

        {status === Status.Error && (
          <div className="flex flex-col items-center gap-6 py-24 text-center">
            <p className="text-sm text-gray-400">Product not found.</p>
            <Link
              to="/"
              className="text-xs tracking-widest uppercase border border-[#1A1A1A] text-[#1A1A1A] px-6 py-2.5 hover:bg-[#1A1A1A] hover:text-white transition-colors duration-200"
            >
              Back to Shop
            </Link>
          </div>
        )}

        {status === Status.Ok && product && (
          <div className="flex flex-col lg:flex-row gap-12 xl:gap-20">
            {/* Image */}
            <div className="lg:flex-1 xl:flex-none xl:w-[520px] shrink-0">
              <div className="relative bg-[#F5F5F0] aspect-square flex items-center justify-center overflow-hidden">
                {productImageUrl(product.image_url) ? (
                  <img
                    src={productImageUrl(product.image_url) as string}
                    alt={product.name}
                    width={520}
                    height={520}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <ShoppingCart className="w-32 h-32 text-gray-200" aria-hidden="true" />
                )}
                <span className="absolute top-4 left-4 bg-[#D4513A] text-white text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5">
                  Sale
                </span>
              </div>
            </div>

            {/* Info */}
            <div className="flex-1 flex flex-col gap-5 lg:pt-2">
              {/* Title */}
              <div className="flex flex-col gap-1.5">
                <h1 className="text-2xl font-semibold text-[#1A1A1A] leading-snug">
                  {product.name}
                </h1>
                {product.description && (
                  <p className="text-sm text-gray-500 leading-relaxed">
                    {product.description}
                  </p>
                )}
              </div>

              {/* Price */}
              <div className="flex items-baseline gap-3">
                <span className="text-xl font-semibold text-[#1A1A1A]">
                  ${product.price.toFixed(2)}
                </span>
                {/* <span className="text-sm text-gray-400 line-through">
                  ${(product.price * 1.25).toFixed(2)}
                </span>
                <span className="text-xs text-[#D4513A] font-medium tracking-wide">
                  20% off
                </span> */}
              </div>

              <div className="border-t border-gray-100" />

              {/* Size selector */}
              {/* <div className="flex flex-col gap-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold tracking-widest uppercase text-[#1A1A1A]">
                    Size
                  </span>
                  <button type="button" className="text-xs text-gray-400 underline underline-offset-2 hover:text-[#1A1A1A] transition-colors">
                    Size Guide
                  </button>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {SIZES.map(size => (
                    <button
                      key={size}
                      type="button"
                      onClick={() => setSelectedSize(size)}
                      className={`w-11 h-11 text-xs font-medium border transition-colors duration-150
                        ${selectedSize === size
                          ? 'border-[#1A1A1A] bg-[#1A1A1A] text-white'
                          : 'border-gray-200 text-gray-600 hover:border-[#1A1A1A]'
                        }`}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div> */}

              {/* CTA */}
              <div className="flex flex-col gap-2.5 mt-1">
                <button
                  type="button"
                  onClick={handleAddToCart}
                  className={`w-full py-4 text-xs font-semibold tracking-widest uppercase transition-colors duration-200
                    ${added
                      ? 'bg-[#2D6A4F] text-white'
                      : 'bg-[#1A1A1A] hover:bg-[#333] text-white'
                    }`}
                >
                  {added ? '✓ Added to Cart' : 'Add to Cart'}
                </button>
              </div>

              <div className="border-t border-gray-100" />

              {/* Details */}
              {/* <div className="flex flex-col gap-2 text-xs text-gray-500 leading-relaxed">
                <p>✓ Free shipping on orders over $50</p>
                <p>✓ Free returns within 30 days</p>
                <p>✓ Secure checkout</p>
              </div> */}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

export default ProductDetailPage
