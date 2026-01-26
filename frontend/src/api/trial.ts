import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

// Public API client (no auth required)
const publicClient = axios.create({
  baseURL: `${API_URL}/api/v1`,
  headers: {
    'Content-Type': 'application/json',
  },
})

export interface TrialRequestData {
  email: string
  full_name: string
  company_name?: string
  use_case: string
}

export interface TrialRequestResponse {
  message: string
  request_id: string
}

export interface TrialStatusResponse {
  status: 'not_found' | 'pending' | 'approved' | 'rejected'
  message: string
}

export const trialApi = {
  submitRequest: async (data: TrialRequestData): Promise<TrialRequestResponse> => {
    const response = await publicClient.post('/trial/request', data)
    return response.data
  },

  checkStatus: async (email: string): Promise<TrialStatusResponse> => {
    const response = await publicClient.get(`/trial/status/${encodeURIComponent(email)}`)
    return response.data
  },
}

export default trialApi
