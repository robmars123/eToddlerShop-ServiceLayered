import { Link } from 'react-router-dom'
import type { Product } from '../../types'
import { productImageUrl } from '../../services/productsService'
import { ShoppingCart } from './ShoppingCartIcon'

interface ProductCardProps {
  product: Product
  onAddToCart: (product: Product) => void
}

export function ProductCard({ product, onAddToCart }: ProductCardProps) {
  const imgSrc = productImageUrl(product.image_url)

  return (
    <article className="group flex flex-col">
      <Link to={`/products/${product.id}`} className="relative bg-[#F5F5F0] aspect-square overflow-hidden block">
        {imgSrc ? (
          <img
            src={imgSrc}
            alt={product.name}
            width={400}
            height={400}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ShoppingCart
              className="w-20 h-20 text-gray-300 group-hover:scale-105 transition-transform duration-500 ease-out"
              aria-hidden="true"
            />
          </div>
        )}

        <span className="absolute top-3 left-3 bg-[#D4513A] text-white text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5">
          Sale
        </span>

        <div className="absolute bottom-0 left-0 right-0 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out">
          <button
            type="button"
            onClick={e => { e.preventDefault(); e.stopPropagation(); onAddToCart(product) }}
            className="w-full bg-[#1A1A1A] hover:bg-[#333] text-white text-xs font-semibold tracking-widest uppercase py-3 transition-colors duration-150"
          >
            Add to Cart
          </button>
        </div>
      </Link>

      <Link to={`/products/${product.id}`} className="pt-3 pb-1 flex flex-col gap-1">
        <h2 className="text-sm font-medium text-[#1A1A1A] leading-snug line-clamp-1">
          {product.name}
        </h2>

        {product.description && (
          <p className="text-xs text-gray-500 line-clamp-1 leading-relaxed">
            {product.description}
          </p>
        )}

        <div className="flex items-center gap-2 mt-1">
          <span className="text-sm font-semibold text-[#1A1A1A]">
            ${product.price.toFixed(2)}
          </span>
        </div>
      </Link>
    </article>
  )
}

export default ProductCard
