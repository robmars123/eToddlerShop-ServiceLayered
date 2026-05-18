import type { FormEvent, ChangeEvent } from 'react'
import type { ProductFormData } from './types'

interface Props {
  form: ProductFormData
  imageFile: File | null
  onChange: (form: ProductFormData) => void
  onImageChange: (file: File | null) => void
  onSubmit: (e: FormEvent<HTMLFormElement>) => void
  error: string | null
  adding: boolean
}

export function AddProductForm({ form, imageFile, onChange, onImageChange, onSubmit, error, adding }: Props) {
  return (
    <section aria-label="Add product" className="bg-white border border-gray-200 rounded-xl p-6 mb-10 shadow-sm">
      <h2 className="text-xs tracking-widest uppercase text-gray-500 mb-4">Add Product</h2>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-3">
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-3 items-end">
          <div>
            <label htmlFor="add-name" className="block text-xs text-gray-500 mb-1">
              Name <span aria-hidden="true">*</span>
            </label>
            <input
              id="add-name"
              type="text"
              required
              value={form.name}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                onChange({ ...form, name: e.target.value })
              }
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#1A1A1A] transition-colors"
            />
          </div>
          <div>
            <label htmlFor="add-description" className="block text-xs text-gray-500 mb-1">
              Description
            </label>
            <input
              id="add-description"
              type="text"
              value={form.description}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                onChange({ ...form, description: e.target.value })
              }
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#1A1A1A] transition-colors"
            />
          </div>
          <div>
            <label htmlFor="add-price" className="block text-xs text-gray-500 mb-1">
              Price <span aria-hidden="true">*</span>
            </label>
            <input
              id="add-price"
              type="number"
              min="0"
              step="0.01"
              required
              value={form.price}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                onChange({ ...form, price: e.target.value })
              }
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#1A1A1A] transition-colors"
            />
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-end gap-3">
          <div className="flex-1">
            <label htmlFor="add-image" className="block text-xs text-gray-500 mb-1">
              Image <span className="text-gray-400">(optional, max 5 MB)</span>
            </label>
            <div className="flex items-center gap-3">
              <label
                htmlFor="add-image"
                className="cursor-pointer border border-dashed border-gray-300 rounded-lg px-3 py-2 text-xs text-gray-500 hover:border-[#1A1A1A] hover:text-[#1A1A1A] transition-colors whitespace-nowrap"
              >
                {imageFile ? imageFile.name : 'Choose image…'}
              </label>
              <input
                id="add-image"
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="sr-only"
                onChange={(e: ChangeEvent<HTMLInputElement>) => {
                  onImageChange(e.target.files?.[0] ?? null)
                }}
              />
              {imageFile && (
                <button
                  type="button"
                  onClick={() => onImageChange(null)}
                  className="text-xs text-gray-400 hover:text-red-500 transition-colors"
                >
                  Remove
                </button>
              )}
            </div>
          </div>

          <button
            type="submit"
            disabled={adding}
            className="bg-[#1A1A1A] text-white text-xs tracking-widest uppercase px-5 py-2.5 rounded-lg hover:bg-[#333] disabled:opacity-50 transition-colors whitespace-nowrap"
          >
            {adding ? 'Adding…' : 'Add Product'}
          </button>
        </div>

        {error && (
          <p role="alert" className="text-xs text-red-600">{error}</p>
        )}
      </form>
    </section>
  )
}
