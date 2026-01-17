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
    budget_limit_usd: '',
    budget_alert_threshold: '80',
    budget_alert_enabled: true,
    budget_block_on_limit: false,
    workflow_budget_usd: '',
    workflow_budget_action: 'alert',
  })
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null)

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
      const payload = {
        ...data,
        budget_limit_usd: data.budget_limit_usd ? parseFloat(data.budget_limit_usd) : null,
        budget_alert_threshold: data.budget_alert_threshold ? parseFloat(data.budget_alert_threshold) : 80,
        workflow_budget_usd: data.workflow_budget_usd ? parseFloat(data.workflow_budget_usd) : null,
      }
      const response = await apiClient.post('/customers', payload)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] })
      toast.success('Customer created successfully')
      setShowModal(false)
      resetForm()
    },
    onError: (error: Error & { response?: { data?: { detail?: string } } }) => {
      toast.error(error.response?.data?.detail || 'Failed to create customer')
    },
  })

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      const payload = {
        name: data.name,
        email: data.email,
        budget_limit_usd: data.budget_limit_usd ? parseFloat(data.budget_limit_usd) : null,
        budget_alert_threshold: data.budget_alert_threshold ? parseFloat(data.budget_alert_threshold) : 80,
        budget_alert_enabled: data.budget_alert_enabled,
        budget_block_on_limit: data.budget_block_on_limit,
        workflow_budget_usd: data.workflow_budget_usd ? parseFloat(data.workflow_budget_usd) : null,
        workflow_budget_action: data.workflow_budget_action,
      }
      const response = await apiClient.patch(`/customers/${id}`, payload)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] })
      toast.success('Customer updated successfully')
      setShowModal(false)
      setEditingCustomer(null)
      resetForm()
    },
    onError: (error: Error & { response?: { data?: { detail?: string } } }) => {
      toast.error(error.response?.data?.detail || 'Failed to update customer')
    },
  })

  const resetForm = () => {
    setFormData({
      external_id: '',
      name: '',
      email: '',
      budget_limit_usd: '',
      budget_alert_threshold: '80',
      budget_alert_enabled: true,
      budget_block_on_limit: false,
      workflow_budget_usd: '',
      workflow_budget_action: 'alert',
    })
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (editingCustomer) {
      updateMutation.mutate({ id: editingCustomer.id, data: formData })
    } else {
      createMutation.mutate(formData)
    }
  }

  const handleEditCustomer = (customer: Customer) => {
    setEditingCustomer(customer)
    setFormData({
      external_id: customer.external_id,
      name: customer.name || '',
      email: customer.email || '',
      budget_limit_usd: customer.budget_limit_usd?.toString() || '',
      budget_alert_threshold: customer.budget_alert_threshold?.toString() || '80',
      budget_alert_enabled: customer.budget_alert_enabled ?? true,
      budget_block_on_limit: customer.budget_block_on_limit ?? false,
      workflow_budget_usd: customer.workflow_budget_usd?.toString() || '',
      workflow_budget_action: customer.workflow_budget_action || 'alert',
    })
    setShowModal(true)
  }

  const handleCloseModal = () => {
    setShowModal(false)
    setEditingCustomer(null)
    resetForm()
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
                  Monthly Budget
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Workflow Budget
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Created
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  Actions
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
                    <td className="px-6 py-4 whitespace-nowrap">
                      {customer.budget_limit_usd ? (
                        <div>
                          <span className="text-sm font-medium text-gray-900">
                            ${parseFloat(customer.budget_limit_usd).toFixed(2)}
                          </span>
                          {customer.budget_block_on_limit && (
                            <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                              <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M13.477 14.89A6 6 0 015.11 6.524l8.367 8.368zm1.414-1.414L6.524 5.11a6 6 0 018.367 8.367zM18 10a8 8 0 11-16 0 8 8 0 0116 0z" clipRule="evenodd" />
                              </svg>
                              Blocking
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400">No limit</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {customer.workflow_budget_usd ? (
                        <div>
                          <span className="text-sm font-medium text-gray-900">
                            ${parseFloat(customer.workflow_budget_usd).toFixed(2)}
                          </span>
                          <span
                            className={`ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                              customer.workflow_budget_action === 'pause'
                                ? 'bg-red-100 text-red-800'
                                : 'bg-yellow-100 text-yellow-800'
                            }`}
                          >
                            {customer.workflow_budget_action === 'pause' ? 'Auto-pause' : 'Alert only'}
                          </span>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400">No limit</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(customer.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <button
                        onClick={() => handleEditCustomer(customer)}
                        className="text-indigo-600 hover:text-indigo-900 text-sm font-medium"
                      >
                        Edit
                      </button>
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
            <h2 className="text-xl font-semibold mb-4">
              {editingCustomer ? 'Edit Customer' : 'Add Customer'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="label">External ID *</label>
                <input
                  type="text"
                  required
                  disabled={!!editingCustomer}
                  className="input disabled:bg-gray-100"
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

              {/* Monthly Budget Limit Section */}
              <div className="border-t pt-4 mt-4">
                <h3 className="text-sm font-medium text-gray-700 mb-3">Monthly Budget Limit</h3>
                <div className="space-y-3">
                  <div>
                    <label className="label">Monthly Limit (USD)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="input"
                      placeholder="e.g., 100.00"
                      value={formData.budget_limit_usd}
                      onChange={(e) => setFormData({ ...formData, budget_limit_usd: e.target.value })}
                    />
                    <p className="text-xs text-gray-500 mt-1">Total monthly spending limit for this customer</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="label">Alert Threshold (%)</label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        className="input"
                        placeholder="80"
                        value={formData.budget_alert_threshold}
                        onChange={(e) => setFormData({ ...formData, budget_alert_threshold: e.target.value })}
                      />
                      <p className="text-xs text-gray-500 mt-1">Send alert at this % of limit</p>
                    </div>
                    <div className="flex items-center mt-6">
                      <label className="flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                          checked={formData.budget_alert_enabled}
                          onChange={(e) => setFormData({ ...formData, budget_alert_enabled: e.target.checked })}
                        />
                        <span className="ml-2 text-sm text-gray-700">Enable alerts</span>
                      </label>
                    </div>
                  </div>
                  <div className="flex items-start pt-2">
                    <label className="flex items-start cursor-pointer">
                      <input
                        type="checkbox"
                        className="w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-500 mt-0.5"
                        checked={formData.budget_block_on_limit}
                        onChange={(e) => setFormData({ ...formData, budget_block_on_limit: e.target.checked })}
                      />
                      <div className="ml-2">
                        <span className="text-sm font-medium text-gray-900">Block requests when limit exceeded</span>
                        <p className="text-xs text-gray-500">When enabled, API requests will be rejected after reaching the monthly limit</p>
                      </div>
                    </label>
                  </div>
                </div>
              </div>

              {/* Workflow Budget Section */}
              <div className="border-t pt-4 mt-4">
                <h3 className="text-sm font-medium text-gray-700 mb-3">Workflow Budget (Agentic AI)</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Budget per Workflow ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="input"
                      placeholder="e.g., 0.50"
                      value={formData.workflow_budget_usd}
                      onChange={(e) => setFormData({ ...formData, workflow_budget_usd: e.target.value })}
                    />
                    <p className="text-xs text-gray-500 mt-1">Leave empty for no limit</p>
                  </div>
                  <div>
                    <label className="label">When Exceeded</label>
                    <select
                      className="input"
                      value={formData.workflow_budget_action}
                      onChange={(e) => setFormData({ ...formData, workflow_budget_action: e.target.value })}
                    >
                      <option value="alert">Alert Only</option>
                      <option value="pause">Auto-Pause Workflow</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="btn btn-primary"
                >
                  {createMutation.isPending || updateMutation.isPending
                    ? 'Saving...'
                    : editingCustomer
                      ? 'Save Changes'
                      : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
