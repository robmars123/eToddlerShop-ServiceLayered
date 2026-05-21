import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { CartProvider } from './components/Cart/CartStore'
import { AuthProvider } from './features/Auth'
import { ProtectedRoute } from './components/ProtectedRoute'
import { ProductsPage } from './pages/ProductsPage'
import { CartPage } from './pages/CartPage'
import { ProductDetailPage } from './pages/ProductDetailPage'
import { LoginPage } from './pages/LoginPage'
import { AdminPage } from './pages/AdminPage'
import { RecommendPage } from './pages/RecommendPage'
import { ChatWidget } from './features/Chatbot'
import { Role } from './types'

export function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<ProductsPage />} />
            <Route path="/recommend" element={<RecommendPage />} />
            <Route path="/products/:id" element={<ProductDetailPage />} />
            <Route path="/cart" element={<CartPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route
              path="/admin"
              element={
                <ProtectedRoute requiredRole={Role.Admin}>
                  <AdminPage />
                </ProtectedRoute>
              }
            />
          </Routes>
          <ChatWidget />
        </BrowserRouter>
      </CartProvider>
    </AuthProvider>
  )
}

export default App
