import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { useMutation } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { authApi } from '../api/auth'
import { useAuthStore } from '../stores/authStore'
import { trackPageView } from '../utils/tracking'

function TokenTrailLogo({ className = "w-8 h-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} fill="none">
      <path
        d="M8 32C8 32 12 28 16 24C20 20 24 16 28 12C32 8 36 8 36 8"
        stroke="url(#login-trail-gradient)"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <circle cx="10" cy="30" r="4" fill="#22c55e" />
      <circle cx="20" cy="20" r="3.5" fill="#eab308" />
      <circle cx="30" cy="10" r="3" fill="#ef4444" />
      <defs>
        <linearGradient id="login-trail-gradient" x1="8" y1="32" x2="36" y2="8">
          <stop offset="0%" stopColor="#22c55e" />
          <stop offset="50%" stopColor="#eab308" />
          <stop offset="100%" stopColor="#ef4444" />
        </linearGradient>
      </defs>
    </svg>
  )
}

export default function Login() {
  const navigate = useNavigate()
  const login = useAuthStore((state) => state.login)
  const [formData, setFormData] = useState({ email: '', password: '' })

  useEffect(() => { trackPageView() }, [])

  const mutation = useMutation({
    mutationFn: authApi.login,
    onSuccess: (data) => {
      login(data.user, data.access_token)
      toast.success('Logged in successfully!')
      navigate('/app/dashboard')
    },
    onError: (error: Error & { response?: { data?: { detail?: string } } }) => {
      toast.error(error.response?.data?.detail || 'Login failed')
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    mutation.mutate(formData)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0b] py-12 px-4 sm:px-6 lg:px-8 relative">
      <Helmet>
        <title>Sign In - TokenTrail</title>
        <meta name="description" content="Sign in to your TokenTrail account to manage LLM costs, API usage, and billing." />
      </Helmet>

      {/* Subtle grid background */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(39,39,42,0.3)_1px,transparent_1px),linear-gradient(90deg,rgba(39,39,42,0.3)_1px,transparent_1px)] bg-[size:64px_64px]" />

      <div className="relative max-w-md w-full space-y-8">
        <div className="text-center">
          <Link to="/" className="inline-flex items-center space-x-3 mb-6">
            <TokenTrailLogo className="w-10 h-10" />
            <span className="text-2xl font-semibold text-white tracking-tight">TokenTrail</span>
          </Link>
          <h2 className="text-3xl font-bold text-white">
            Welcome back
          </h2>
          <p className="mt-2 text-zinc-400">Sign in to your account to continue</p>
        </div>

        <div className="bg-zinc-900/80 backdrop-blur rounded-xl border border-zinc-800 p-8">
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-zinc-300 mb-2">
                  Email address
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  className="w-full px-4 py-3 bg-zinc-800/50 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                  placeholder="you@company.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-zinc-300 mb-2">
                  Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  className="w-full px-4 py-3 bg-zinc-800/50 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                  placeholder="Enter your password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                />
              </div>
            </div>

            {mutation.isError && (
              <div role="alert" className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                {(mutation.error as Error & { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Login failed. Please check your credentials and try again.'}
              </div>
            )}

            <button
              type="submit"
              disabled={mutation.isPending}
              className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {mutation.isPending ? 'Signing in...' : 'Sign in'}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-zinc-400">
          Don't have an account?{' '}
          <Link to="/register" className="font-medium text-emerald-400 hover:text-emerald-300 transition-colors">
            Start free trial
          </Link>
        </p>
      </div>
    </div>
  )
}
