import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'

export default function DemoBanner() {
  const user = useAuthStore((state) => state.user)
  const logout = useAuthStore((state) => state.logout)
  const navigate = useNavigate()

  if (!user?.is_demo) return null

  const handleExitDemo = () => {
    logout()
    navigate('/')
  }

  return (
    <div className="bg-amber-500 text-white px-4 py-2.5 flex items-center justify-center gap-4">
      <span className="inline-flex items-center gap-2 text-sm font-medium">
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
        </svg>
        You're viewing a demo. Data is read-only.
      </span>

      <div className="flex items-center gap-2">
        <Link
          to="/register"
          className="px-3 py-1 bg-white text-amber-600 rounded-md hover:bg-amber-50 transition-colors text-sm font-semibold"
        >
          Sign Up
        </Link>
        <button
          onClick={handleExitDemo}
          className="px-3 py-1 bg-amber-600 text-white rounded-md hover:bg-amber-700 transition-colors text-sm font-medium"
        >
          Exit Demo
        </button>
      </div>
    </div>
  )
}
