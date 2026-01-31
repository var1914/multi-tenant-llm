import { Link } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'

export default function DemoBanner() {
  const user = useAuthStore((state) => state.user)

  if (!user?.is_demo) return null

  return (
    <div className="bg-amber-500 text-white px-4 py-2.5 text-center text-sm font-medium">
      <span className="inline-flex items-center gap-2">
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
        </svg>
        You're viewing a demo. Data is read-only.
        <Link
          to="/register"
          className="underline hover:no-underline ml-1 font-semibold"
        >
          Sign up for full access
        </Link>
      </span>
    </div>
  )
}
