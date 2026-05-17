import type { ProductPayload } from '../../services/productsService'

export interface ProductFormData {
  name: string
  description: string
  price: string
}

export const EMPTY_FORM: ProductFormData = { name: '', description: '', price: '' }

export function toPayload(form: ProductFormData): ProductPayload {
  return {
    name: form.name.trim(),
    description: form.description.trim() || null,
    price: parseFloat(form.price),
  }
}

export function isValidForm(form: ProductFormData): string | null {
  if (!form.name.trim()) return 'Name is required.'
  const price = parseFloat(form.price)
  if (isNaN(price) || price < 0) return 'Enter a valid price.'
  return null
}
