import { Link } from 'react-router-dom'
import { Navbar } from '../components/Navbar'
import { useCart } from '../components/Cart/CartStore'
import { ShoppingCart } from '../components/ProductCard/ShoppingCartIcon'

export function CartPage() {
  const { items, subtotal, removeFromCart, updateQuantity } = useCart()

  const shipping = subtotal > 50 ? 0 : 5.99 //just sample. This should be in db.
  const total    = subtotal + shipping

  return (
    <div className="min-h-screen bg-white overflow-x-clip">
      <Navbar />

      <main className="w-full max-w-6xl mx-auto px-6 py-10">
        <h1 className="text-xl font-semibold tracking-[0.15em] uppercase text-[#1A1A1A] mb-8">
          Your Cart
        </h1>

        {items.length === 0 ? (
          <div className="flex flex-col items-center gap-6 py-24 text-center">
            <ShoppingCart className="w-16 h-16 text-gray-200" />
            <p className="text-sm text-gray-400 tracking-wide">Your cart is empty.</p>
            <Link
              to="/"
              className="text-xs tracking-widest uppercase border border-[#1A1A1A] text-[#1A1A1A] px-6 py-2.5 hover:bg-[#1A1A1A] hover:text-white transition-colors duration-200"
            >
              Continue Shopping
            </Link>
          </div>
        ) : (
          <div className="flex flex-col lg:flex-row gap-12">
            {/* Item list */}
            <div className="flex-1 flex flex-col divide-y divide-gray-100">
              {items.map(({ product, quantity }) => (
                <div key={product.id} className="flex gap-5 py-6">
                  {/* Image placeholder */}
                  <div className="w-24 h-24 shrink-0 bg-[#F5F5F0] flex items-center justify-center">
                    <ShoppingCart className="w-8 h-8 text-gray-300" aria-hidden="true" />
                  </div>

                  {/* Details */}
                  <div className="flex flex-1 flex-col gap-1 min-w-0">
                    <h2 className="text-sm font-medium text-[#1A1A1A] leading-snug truncate">
                      {product.name}
                    </h2>
                    {product.description && (
                      <p className="text-xs text-gray-400 truncate">{product.description}</p>
                    )}
                    <p className="text-sm font-semibold text-[#1A1A1A] mt-1">
                      ${product.price.toFixed(2)}
                    </p>

                    <div className="flex items-center gap-4 mt-auto pt-2">
                      {/* Quantity control */}
                      <div className="flex items-center border border-gray-200">
                        <button
                          type="button"
                          onClick={() => updateQuantity(product.id, quantity - 1)}
                          className="w-8 h-8 flex items-center justify-center text-gray-500 hover:bg-gray-50 transition-colors text-lg leading-none"
                          aria-label="Decrease quantity"
                        > - </button>
                        <span className="w-8 text-center text-sm font-medium text-[#1A1A1A] select-none"> {quantity}</span>
                        <button
                          type="button"
                          onClick={() => updateQuantity(product.id, quantity + 1)}
                          className="w-8 h-8 flex items-center justify-center text-gray-500 hover:bg-gray-50 transition-colors text-lg leading-none"
                          aria-label="Increase quantity"
                        > + </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => removeFromCart(product.id)}
                        className="text-xs text-gray-400 hover:text-[#D4513A] tracking-wide transition-colors underline underline-offset-2"
                      >
                        Remove
                      </button>
                    </div>
                  </div>

                  {/* Line total */}
                  <p className="shrink-0 text-sm font-semibold text-[#1A1A1A] pt-0.5">
                    ${(product.price * quantity).toFixed(2)}
                  </p>
                </div>
              ))}

              <div className="pt-6">
                <Link
                  to="/"
                  className="text-xs tracking-widest uppercase text-gray-500 hover:text-[#1A1A1A] transition-colors underline underline-offset-2"
                >
                  ← Continue Shopping
                </Link>
              </div>
            </div>

            {/* Order summary */}
            <div className="lg:w-80 shrink-0 self-start sticky top-28">
              <div className="border border-gray-100 p-6 flex flex-col gap-4">
                <h2 className="text-xs font-semibold tracking-widest uppercase text-[#1A1A1A]">
                  Order Summary
                </h2>

                <div className="flex flex-col gap-2 text-sm text-gray-600">
                  <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span>${subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Shipping</span>
                    <span>{shipping === 0 ? 'Free' : `$${shipping.toFixed(2)}`}</span>
                  </div>
                  {/* {shipping > 0 && (
                    <p className="text-xs text-gray-400">
                      Free shipping on orders over $50
                    </p>
                  )} */}
                </div>

                <div className="border-t border-gray-100 pt-4 flex justify-between text-sm font-semibold text-[#1A1A1A]">
                  <span>Total</span>
                  <span>${total.toFixed(2)}</span>
                </div>

                <button
                  type="button"
                  className="w-full bg-[#1A1A1A] hover:bg-[#333] text-white text-xs font-semibold tracking-widest uppercase py-3.5 transition-colors duration-150 mt-2"
                >
                  Checkout
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

export default CartPage
