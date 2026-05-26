import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Navbar } from '../components/Navbar'
import { useCart } from '../components/Cart/CartStore'
import { useAuth } from '../features/Auth'
import { ShoppingCart } from '../components/ProductCard/ShoppingCartIcon'
import { createOrder } from '../services/ordersService'
import { productImageUrl } from '../services/productsService'

type CheckoutStatus = 'idle' | 'placing' | 'success' | 'error'

export function CartPage() {
  const { items, subtotal, removeFromCart, updateQuantity, clearCart } = useCart()
  const { user } = useAuth()
  const [checkoutStatus, setCheckoutStatus] = useState<CheckoutStatus>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [orderId, setOrderId] = useState<number | null>(null)

  const shipping = subtotal > 50 ? 0 : 5.99
  const total    = subtotal + shipping

  async function handleCheckout() {
    if (!user) { setErrorMsg('Please sign in to place an order'); setCheckoutStatus('error'); return }
    setCheckoutStatus('placing')
    setErrorMsg('')
    try {
      const order = await createOrder({
        user_id: user.id,
        items: items.map(({ product, quantity }) => ({
          product_id: product.id,
          quantity,
          unit_price: product.price,
        })),
      })
      setOrderId(order.id)
      clearCart()
      setCheckoutStatus('success')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to place order')
      setCheckoutStatus('error')
    }
  }

  // ── Order placed confirmation ─────────────────────────────────────────────
  if (checkoutStatus === 'success') {
    return (
      <div className="min-h-screen bg-white">
        <Navbar />
        <main className="max-w-6xl mx-auto px-6 py-20 flex flex-col items-center gap-6 text-center">
          <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-7 h-7 text-green-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold tracking-[0.15em] uppercase text-[#1A1A1A]">
            Order Placed!
          </h1>
          <p className="text-sm text-gray-500">
            Order <span className="font-semibold text-[#1A1A1A]">#{orderId}</span> has been received.
            We'll get it ready for you.
          </p>
          <Link
            to="/"
            className="mt-2 text-xs tracking-widest uppercase border border-[#1A1A1A] text-[#1A1A1A] px-6 py-2.5 hover:bg-[#1A1A1A] hover:text-white transition-colors duration-200"
          >
            Continue Shopping
          </Link>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white overflow-x-hidden">
      <Navbar />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
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
          <div className="flex flex-col lg:flex-row gap-10">
            {/* Item list */}
            <div className="flex-1 min-w-0 flex flex-col divide-y divide-gray-100">
              {items.map(({ product, quantity }) => {
                const imgSrc = productImageUrl(product.image_url)
                return (
                <div key={product.id} className="flex gap-4 py-5 min-w-0">
                  {/* Thumbnail */}
                  <div className="w-20 h-20 sm:w-24 sm:h-24 shrink-0 bg-[#F5F5F0] overflow-hidden">
                    {imgSrc ? (
                      <img src={imgSrc} alt={product.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ShoppingCart className="w-8 h-8 text-gray-300" aria-hidden="true" />
                      </div>
                    )}
                  </div>

                  {/* Details */}
                  <div className="flex flex-1 flex-col gap-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 min-w-0">
                      <h2 className="text-sm font-medium text-[#1A1A1A] leading-snug line-clamp-2 min-w-0">
                        {product.name}
                      </h2>
                      <p className="shrink-0 text-sm font-semibold text-[#1A1A1A]">
                        ${(product.price * quantity).toFixed(2)}
                      </p>
                    </div>

                    <p className="text-xs text-gray-400">
                      ${product.price.toFixed(2)} each
                    </p>

                    <div className="flex items-center gap-4 mt-auto pt-2">
                      <div className="flex items-center border border-gray-200">
                        <button
                          type="button"
                          onClick={() => updateQuantity(product.id, quantity - 1)}
                          className="w-8 h-8 flex items-center justify-center text-gray-500 hover:bg-gray-50 transition-colors text-lg leading-none"
                          aria-label="Decrease quantity"
                        >-</button>
                        <span className="w-8 text-center text-sm font-medium text-[#1A1A1A] select-none">{quantity}</span>
                        <button
                          type="button"
                          onClick={() => updateQuantity(product.id, quantity + 1)}
                          className="w-8 h-8 flex items-center justify-center text-gray-500 hover:bg-gray-50 transition-colors text-lg leading-none"
                          aria-label="Increase quantity"
                        >+</button>
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
                </div>
                )
              })}

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
            <div className="lg:w-72 shrink-0 self-start lg:sticky lg:top-28">
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
                </div>

                <div className="border-t border-gray-100 pt-4 flex justify-between text-sm font-semibold text-[#1A1A1A]">
                  <span>Total</span>
                  <span>${total.toFixed(2)}</span>
                </div>

                {checkoutStatus === 'error' && (
                  <p role="alert" className="text-xs text-red-600">{errorMsg}</p>
                )}

                {!user && (
                  <p className="text-xs text-gray-400">
                    <Link to="/login" className="underline underline-offset-2 hover:text-[#1A1A1A]">Sign in</Link> to place your order.
                  </p>
                )}

                <button
                  type="button"
                  onClick={() => { void handleCheckout() }}
                  disabled={checkoutStatus === 'placing' || !user}
                  className="w-full bg-[#1A1A1A] hover:bg-[#333] text-white text-xs font-semibold tracking-widest uppercase py-3.5 transition-colors duration-150 mt-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {checkoutStatus === 'placing' ? 'Placing Order…' : 'Checkout'}
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
