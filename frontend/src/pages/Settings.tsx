import { useQuery } from '@tanstack/react-query'
import apiClient from '../api/client'
import { useAuthStore } from '../stores/authStore'

export default function Settings() {
  const { user } = useAuthStore()

  const { data: tenant } = useQuery({
    queryKey: ['tenant'],
    queryFn: async () => {
      const response = await apiClient.get('/tenants/current')
      return response.data
    },
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-600">Manage your account and organization settings</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Profile Section */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold mb-4">Profile</h2>
          <div className="space-y-4">
            <div>
              <label className="label">Email</label>
              <input type="email" className="input" value={user?.email || ''} disabled />
            </div>
            <div>
              <label className="label">Name</label>
              <input
                type="text"
                className="input"
                value={user?.full_name || ''}
                disabled
              />
            </div>
            <div>
              <label className="label">Role</label>
              <input
                type="text"
                className="input"
                value={user?.role || ''}
                disabled
              />
            </div>
          </div>
        </div>

        {/* Organization Section */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold mb-4">Organization</h2>
          <div className="space-y-4">
            <div>
              <label className="label">Company Name</label>
              <input
                type="text"
                className="input"
                value={tenant?.company_name || ''}
                disabled
              />
            </div>
            <div>
              <label className="label">Slug</label>
              <input type="text" className="input" value={tenant?.slug || ''} disabled />
            </div>
            <div>
              <label className="label">Subscription Plan</label>
              <input
                type="text"
                className="input capitalize"
                value={tenant?.subscription_plan || ''}
                disabled
              />
            </div>
            <div>
              <label className="label">Status</label>
              <input
                type="text"
                className="input capitalize"
                value={tenant?.subscription_status || ''}
                disabled
              />
            </div>
          </div>
        </div>
      </div>

      {/* Usage Example */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold mb-4">API Usage Example</h2>
        <p className="text-gray-600 mb-4">
          Use this curl command to track usage events:
        </p>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
{`curl -X POST http://localhost:8000/api/v1/usage/track \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "customer_id": "customer_123",
    "event_type": "llm_tokens",
    "model": "gpt-4o",
    "provider": "openai",
    "quantity": 1500,
    "cost_usd": 0.045,
    "idempotency_key": "unique-request-id"
  }'`}
        </pre>
      </div>
    </div>
  )
}
