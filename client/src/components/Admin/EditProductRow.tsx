import type { ChangeEvent } from 'react'
import { productImageUrl } from '../../services/productsService'
import type { Product } from '../../types'
import type { ProductFormData } from './types'

interface Props {
  product: Product
  form: ProductFormData
  onChange: (form: ProductFormData) => void
  onSave: (id: number) => void
  onCancel: () => void
  onImageUpload: (product: Product, file: File) => void
  saving: boolean
  uploadingId: number | null
  error: string | null
  fileInputRef: (el: HTMLInputElement | null) => void
}

export function EditProductRow({
  product, form, onChange, onSave, onCancel,
  onImageUpload, saving, uploadingId, error, fileInputRef,
}: Props) {
  const imgSrc = productImageUrl(product.image_url)

  return (
    <tr className="border-b border-gray-100 last:border-0 bg-gray-50">
      <td className="px-4 py-3">
        <div className="flex flex-col items-center gap-1">
          {imgSrc && (
            <img src={imgSrc} alt={product.name} className="w-10 h-10 object-cover rounded" />
          )}
          <label
            htmlFor={`img-${product.id}`}
            className="cursor-pointer text-[10px] text-gray-400 hover:text-[#1A1A1A] transition-colors whitespace-nowrap"
          >
            {uploadingId === product.id ? 'Uploading…' : 'Upload'}
          </label>
          <input
            id={`img-${product.id}`}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="sr-only"
            ref={fileInputRef}
            disabled={uploadingId === product.id}
            onChange={(e: ChangeEvent<HTMLInputElement>) => {
              const file = e.target.files?.[0]
              if (file) void onImageUpload(product, file)
            }}
          />
        </div>
      </td>
      <td className="px-4 py-3">
        <input
          type="text"
          aria-label="Product name"
          value={form.name}
          onChange={(e: ChangeEvent<HTMLInputElement>) => onChange({ ...form, name: e.target.value })}
          className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm outline-none focus:border-[#1A1A1A] transition-colors"
        />
      </td>
      <td className="px-4 py-3">
        <input
          type="text"
          aria-label="Product description"
          value={form.description}
          onChange={(e: ChangeEvent<HTMLInputElement>) => onChange({ ...form, description: e.target.value })}
          className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm outline-none focus:border-[#1A1A1A] transition-colors"
        />
      </td>
      <td className="px-4 py-3">
        <input
          type="number"
          min="0"
          step="0.01"
          aria-label="Product price"
          value={form.price}
          onChange={(e: ChangeEvent<HTMLInputElement>) => onChange({ ...form, price: e.target.value })}
          className="w-28 border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-right outline-none focus:border-[#1A1A1A] transition-colors"
        />
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-3">
          {error && <span role="alert" className="text-xs text-red-600">{error}</span>}
          <button
            onClick={() => { void onSave(product.id) }}
            disabled={saving}
            className="text-xs font-medium text-green-700 hover:text-green-900 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button
            onClick={onCancel}
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            Cancel
          </button>
        </div>
      </td>
    </tr>
  )
}
