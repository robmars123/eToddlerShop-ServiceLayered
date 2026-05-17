import type { MutableRefObject } from 'react'
import type { Product } from '../../types'
import type { ProductFormData } from './types'
import { ProductTableRow } from './ProductTableRow'
import { EditProductRow } from './EditProductRow'

interface Props {
  products: Product[]
  loading: boolean
  pageError: string | null
  uploadError: string | null
  editingId: number | null
  editForm: ProductFormData
  editError: string | null
  saving: boolean
  uploadingId: number | null
  fileInputRefs: MutableRefObject<Record<number, HTMLInputElement | null>>
  onEditChange: (form: ProductFormData) => void
  onStartEdit: (product: Product) => void
  onCancelEdit: () => void
  onSaveEdit: (id: number) => void
  onDelete: (id: number) => void
  onImageUpload: (product: Product, file: File) => void
}

export function ProductsTable({
  products, loading, pageError, uploadError,
  editingId, editForm, editError, saving, uploadingId, fileInputRefs,
  onEditChange, onStartEdit, onCancelEdit, onSaveEdit, onDelete, onImageUpload,
}: Props) {
  if (loading) return <p className="text-sm text-gray-400">Loading…</p>

  return (
    <>
      {pageError && <p role="alert" className="text-sm text-red-600 mb-4">{pageError}</p>}
      {uploadError && <p role="alert" className="text-sm text-red-600 mb-4">{uploadError}</p>}

      {products.length === 0 && !pageError && (
        <p className="text-sm text-gray-400">No products yet. Add one above.</p>
      )}

      {products.length > 0 && (
        <div className="overflow-x-auto border border-gray-200 rounded-xl shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 text-xs tracking-widest uppercase text-gray-500 font-medium w-14">Image</th>
                <th className="text-left px-4 py-3 text-xs tracking-widest uppercase text-gray-500 font-medium">Name</th>
                <th className="text-left px-4 py-3 text-xs tracking-widest uppercase text-gray-500 font-medium">Description</th>
                <th className="text-right px-4 py-3 text-xs tracking-widest uppercase text-gray-500 font-medium">Price</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {products.map(product =>
                editingId === product.id ? (
                  <EditProductRow
                    key={product.id}
                    product={product}
                    form={editForm}
                    onChange={onEditChange}
                    onSave={onSaveEdit}
                    onCancel={onCancelEdit}
                    onImageUpload={onImageUpload}
                    saving={saving}
                    uploadingId={uploadingId}
                    error={editError}
                    fileInputRef={el => { fileInputRefs.current[product.id] = el }}
                  />
                ) : (
                  <ProductTableRow
                    key={product.id}
                    product={product}
                    onEdit={onStartEdit}
                    onDelete={onDelete}
                  />
                )
              )}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
