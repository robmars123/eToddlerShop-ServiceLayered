import { useState, useEffect, useRef, type FormEvent } from 'react'
import { Navbar } from '../components/Navbar'
import {
  fetchProducts, createProduct, updateProduct,
  deleteProduct, uploadProductImage,
} from '../services/productsService'
import { embedProducts } from '../services/aiService'
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
  const [addImageFile, setAddImageFile] = useState<File | null>(null)
  const [addError, setAddError] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)

  const [editingId, setEditingId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState<ProductFormData>(EMPTY_FORM)
  const [editError, setEditError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [uploadingId, setUploadingId] = useState<number | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)

  const [indexing, setIndexing] = useState(false)
  const [indexResult, setIndexResult] = useState<string | null>(null)
  const [indexError, setIndexError] = useState<string | null>(null)

  const fileInputRefs = useRef<Record<number, HTMLInputElement | null>>({})

  async function handleIndexProducts(): Promise<void> {
    setIndexing(true)
    setIndexResult(null)
    setIndexError(null)
    try {
      const result = await embedProducts()
      setIndexResult(result.message)
    } catch {
      setIndexError('Indexing failed. Make sure products exist and try again.')
    } finally {
      setIndexing(false)
    }
  }

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
    if (addImageFile && addImageFile.size > 5 * 1024 * 1024) {
      setAddError('Image must be under 5 MB.')
      return
    }
    setAdding(true)
    setAddError(null)
    try {
      let created = await createProduct(toPayload(addForm))
      if (addImageFile) {
        created = await uploadProductImage(created.id, addImageFile)
      }
      setProducts(prev => [...prev, created])
      setAddForm(EMPTY_FORM)
      setAddImageFile(null)
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
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-xl font-semibold tracking-[0.15em] uppercase text-[#1A1A1A]">
            Admin — Products
          </h1>
          <div className="flex flex-col items-end gap-1">
            <button
              type="button"
              onClick={() => void handleIndexProducts()}
              disabled={indexing}
              className="px-4 py-2 text-sm font-medium bg-gray-900 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors"
            >
              {indexing ? 'Indexing…' : 'Index Products for AI Search'}
            </button>
            {indexResult && (
              <p className="text-xs text-green-600">{indexResult}</p>
            )}
            {indexError && (
              <p className="text-xs text-red-600">{indexError}</p>
            )}
          </div>
        </div>

        <AddProductForm
          form={addForm}
          imageFile={addImageFile}
          onChange={setAddForm}
          onImageChange={setAddImageFile}
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
