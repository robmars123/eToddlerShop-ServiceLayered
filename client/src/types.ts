export const Role = { Admin: 'admin', User: 'user' } as const
export type Role = (typeof Role)[keyof typeof Role]

export interface User {
  id: number
  email: string
  username: string
  role: Role
}

export interface Product {
  id: number
  name: string
  description: string | null
  price: number
  image_url: string | null
}
