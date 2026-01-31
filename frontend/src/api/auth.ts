import apiClient from './client'
import type { AuthResponse, User } from '../types'

export interface LoginData {
  email: string
  password: string
}

export interface RegisterData {
  email: string
  password: string
  full_name?: string
  company_name: string
}

export const authApi = {
  login: async (data: LoginData): Promise<AuthResponse> => {
    const response = await apiClient.post('/auth/login', data)
    return response.data
  },

  register: async (data: RegisterData): Promise<AuthResponse> => {
    const response = await apiClient.post('/auth/register', data)
    return response.data
  },

  getMe: async (): Promise<User> => {
    const response = await apiClient.get('/auth/me')
    return response.data
  },

  demoLogin: async (): Promise<AuthResponse> => {
    const response = await apiClient.post('/auth/demo-login')
    return response.data
  },
}

export default authApi
