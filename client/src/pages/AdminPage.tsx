import { useState, useEffect, useRef, type FormEvent } from 'react'
import { Navbar } from '../components/Navbar'
import {
  fetchProducts, createProduct, updateProduct,
  deleteProduct, uploadProductImage,
} from '../services/productsService'
import type { Product } from '../types'
import {
  AddProductForm,
  ProductsTable,
  EMPTY_FORM,
  toPayload,
  isValidForm,
  type ProductFormData,
} from '../components/Admin'

export function AdminPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [pageError, setPageError] = useState<string | null>(null)

  const [addForm, setAddForm] = useState<ProductFormData>(EMPTY_FORM)
  const [addError, setAddError] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)

  const [editingId, setEditingId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState<ProductFormData>(EMPTY_FORM)
  const [editError, setEditError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [uploadingId, setUploadingId] = useState<number | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)

  const fileInputRefs = useRef<Record<number, HTMLInputElement | null>>({})

  async function load(): Promise<void> {
    setLoading(true)
    setPageError(null)
    try {
      setProducts(await fetchProducts())
    } catch {
      setPageError('Failed to load products.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  function startEdit(product: Product): void {
    setEditingId(product.id)
    setEditForm({ name: product.name, description: product.description ?? '', price: String(product.price) })
    setEditError(null)
    setUploadError(null)
  }

  function cancelEdit(): void {
    setEditingId(null)
    setEditError(null)
    setUploadError(null)
  }

  async function handleAdd(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault()
    const validationError = isValidForm(addForm)
    if (validationError) { setAddError(validationError); return }
    setAdding(true)
    setAddError(null)
    try {
      const created = await createProduct(toPayload(addForm))
      setProducts(prev => [...prev, created])
      setAddForm(EMPTY_FORM)
    } catch {
      setAddError('Failed to add product.')
    } finally {
      setAdding(false)
    }
  }

  async function handleSaveEdit(id: number): Promise<void> {
    const validationError = isValidForm(editForm)
    if (validationError) { setEditError(validationError); return }
    setSaving(true)
    setEditError(null)
    try {
      const updated = await updateProduct(id, toPayload(editForm))
      setProducts(prev => prev.map(p => (p.id === id ? updated : p)))
      setEditingId(null)
    } catch {
      setEditError('Failed to update product.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: number): Promise<void> {
    if (!window.confirm('Delete this product? This cannot be undone.')) return
    try {
      await deleteProduct(id)
      setProducts(prev => prev.filter(p => p.id !== id))
    } catch {
      setPageError('Failed to delete product.')
    }
  }

  async function handleImageUpload(product: Product, file: File): Promise<void> {
    if (file.size > 5 * 1024 * 1024) {
      setUploadError('Image must be under 5 MB.')
      const input = fileInputRefs.current[product.id]
      if (input) input.value = ''
      return
    }
    setUploadingId(product.id)
    setUploadError(null)
    try {
      const updated = await uploadProductImage(product.id, file)
      setProducts(prev => prev.map(p => (p.id === product.id ? updated : p)))
    } catch {
      setUploadError('Failed to upload image.')
    } finally {
      setUploadingId(null)
      const input = fileInputRefs.current[product.id]
      if (input) input.value = ''
    }
  }

  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      <main className="max-w-5xl mx-auto px-6 py-10">
        <h1 className="text-xl font-semibold tracking-[0.15em] uppercase text-[#1A1A1A] mb-8">
          Admin — Products
        </h1>

        <AddProductForm
          form={addForm}
          onChange={setAddForm}
          onSubmit={e => void handleAdd(e)}
          error={addError}
          adding={adding}
        />

        <ProductsTable
          products={products}
          loading={loading}
          pageError={pageError}
          uploadError={uploadError}
          editingId={editingId}
          editForm={editForm}
          editError={editError}
          saving={saving}
          uploadingId={uploadingId}
          fileInputRefs={fileInputRefs}
          onEditChange={setEditForm}
          onStartEdit={startEdit}
          onCancelEdit={cancelEdit}
          onSaveEdit={id => void handleSaveEdit(id)}
          onDelete={id => void handleDelete(id)}
          onImageUpload={(product, file) => void handleImageUpload(product, file)}
        />
      </main>
    </div>
  )
}

export default AdminPage
