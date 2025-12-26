import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import apiClient from '../api/client'
import type { Customer } from '../types'

interface CustomerUsage {
  customer_id: string
  customer_name: string | null
  total_quantity: number
  total_cost_usd: string
  event_count: number
}

export default function Customers() {
  const queryClient = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [formData, setFormData] = useState({
    external_id: '',
    name: '',
    email: '',
  })

  const { data: customers, isLoading } = useQuery({
    queryKey: ['customers'],
    queryFn: async () => {
      const response = await apiClient.get('/customers')
      return response.data as Customer[]
    },
  })

  const { data: usageByCustomer } = useQuery<CustomerUsage[]>({
    queryKey: ['usage-by-customer'],
    queryFn: async () => {
      const response = await apiClient.get('/usage/dashboard/by-customer')
      return response.data
    },
  })

  // Create a map for quick lookup
  const usageMap = usageByCustomer?.reduce(
    (acc, u) => {
      acc[u.customer_id] = u
      return acc
    },
    {} as Record<string, CustomerUsage>
  )

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const response = await apiClient.post('/customers', data)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] })
      toast.success('Customer created successfully')
      setShowModal(false)
      setFormData({ external_id: '', name: '', email: '' })
    },
    onError: (error: Error & { response?: { data?: { detail?: string } } }) => {
      toast.error(error.response?.data?.detail || 'Failed to create customer')
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    createMutation.mutate(formData)
  }

  // Sort customers by usage cost (highest first)
  const sortedCustomers = customers?.slice().sort((a, b) => {
    const aUsage = usageMap?.[a.external_id]
    const bUsage = usageMap?.[b.external_id]
    const aCost = aUsage ? parseFloat(aUsage.total_cost_usd) : 0
    const bCost = bUsage ? parseFloat(bUsage.total_cost_usd) : 0
    return bCost - aCost
  })

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Customers</h1>
          <p className="text-gray-600">Manage your end customers and view their usage</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn btn-primary">
          Add Customer
        </button>
      </div>

      <div className="card">
        {isLoading ? (
          <div className="p-6 text-center text-gray-500">Loading...</div>
        ) : customers?.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            No customers yet. Create your first customer to get started.
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Customer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Email
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  Events
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  Usage
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  Cost
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Created
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sortedCustomers?.map((customer) => {
                const usage = usageMap?.[customer.external_id]
                const cost = usage ? parseFloat(usage.total_cost_usd) : 0
                return (
                  <tr key={customer.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {customer.name || customer.external_id}
                      </div>
                      {customer.name && (
                        <div className="text-xs text-gray-500">{customer.external_id}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {customer.email || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">
                      {usage?.event_count || 0}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">
                      {usage?.total_quantity?.toLocaleString() || 0}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <span
                        className={`text-sm font-medium ${
                          cost > 0 ? 'text-gray-900' : 'text-gray-400'
                        }`}
                      >
                        ${cost.toFixed(2)}
                      </span>
                      {cost > 0 && (
                        <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
                          <div
                            className="bg-blue-600 h-1.5 rounded-full"
                            style={{
                              width: `${Math.min(
                                (cost /
                                  Math.max(
                                    ...Object.values(usageMap || {}).map((u) =>
                                      parseFloat(u.total_cost_usd)
                                    )
                                  )) *
                                  100,
                                100
                              )}%`,
                            }}
                          />
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(customer.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-semibold mb-4">Add Customer</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="label">External ID *</label>
                <input
                  type="text"
                  required
                  className="input"
                  placeholder="customer_123"
                  value={formData.external_id}
                  onChange={(e) => setFormData({ ...formData, external_id: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Name</label>
                <input
                  type="text"
                  className="input"
                  placeholder="John Doe"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Email</label>
                <input
                  type="email"
                  className="input"
                  placeholder="john@example.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="btn btn-primary"
                >
                  {createMutation.isPending ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
