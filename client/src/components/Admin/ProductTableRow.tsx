import { productImageUrl } from '../../services/productsService'
import type { Product } from '../../types'

interface Props {
  product: Product
  onEdit: (product: Product) => void
  onDelete: (id: number) => void
}

export function ProductTableRow({ product, onEdit, onDelete }: Props) {
  const imgSrc = productImageUrl(product.image_url)

  return (
    <tr className="border-b border-gray-100 last:border-0">
      <td className="px-4 py-3">
        {imgSrc ? (
          <img
            src={imgSrc}
            alt={product.name}
            className="w-10 h-10 object-cover rounded"
          />
        ) : (
          <div className="w-10 h-10 rounded bg-gray-100 flex items-center justify-center text-gray-300 text-[10px]">
            —
          </div>
        )}
      </td>
      <td className="px-4 py-3 font-medium text-[#1A1A1A]">{product.name}</td>
      <td className="px-4 py-3 text-gray-500">{product.description ?? '—'}</td>
      <td className="px-4 py-3 text-right text-[#1A1A1A]">${product.price.toFixed(2)}</td>
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-3">
          <button
            onClick={() => onEdit(product)}
            className="text-xs text-gray-500 hover:text-[#1A1A1A] transition-colors"
          >
            Edit
          </button>
          <button
            onClick={() => { void onDelete(product.id) }}
            className="text-xs text-[#D4513A] hover:text-red-800 transition-colors"
          >
            Delete
          </button>
        </div>
      </td>
    </tr>
  )
}
