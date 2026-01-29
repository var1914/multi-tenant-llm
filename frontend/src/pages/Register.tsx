import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { authApi } from '../api/auth'
import { useAuthStore } from '../stores/authStore'

function TokenTrailLogo({ className = "w-8 h-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} fill="none">
      <path
        d="M8 32C8 32 12 28 16 24C20 20 24 16 28 12C32 8 36 8 36 8"
        stroke="url(#register-trail-gradient)"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <circle cx="10" cy="30" r="4" fill="#22c55e" />
      <circle cx="20" cy="20" r="3.5" fill="#eab308" />
      <circle cx="30" cy="10" r="3" fill="#ef4444" />
      <defs>
        <linearGradient id="register-trail-gradient" x1="8" y1="32" x2="36" y2="8">
          <stop offset="0%" stopColor="#22c55e" />
          <stop offset="50%" stopColor="#eab308" />
          <stop offset="100%" stopColor="#ef4444" />
        </linearGradient>
      </defs>
    </svg>
  )
}

const benefits = [
  'Track every LLM API call in real-time',
  'Save 30-50% with smart model routing',
  'Bill customers based on actual usage',
  'Full access free for 14 days',
]

export default function Register() {
  const navigate = useNavigate()
  const login = useAuthStore((state) => state.login)
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    full_name: '',
    company_name: '',
  })

  const mutation = useMutation({
    mutationFn: authApi.register,
    onSuccess: (data) => {
      login(data.user, data.access_token)
      toast.success('Account created successfully!')
      navigate('/app/dashboard')
    },
    onError: (error: Error & { response?: { data?: { detail?: string } } }) => {
      toast.error(error.response?.data?.detail || 'Registration failed')
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    mutation.mutate(formData)
  }

  return (
    <div className="min-h-screen bg-[#0a0a0b] relative">
      {/* Subtle grid background */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(39,39,42,0.3)_1px,transparent_1px),linear-gradient(90deg,rgba(39,39,42,0.3)_1px,transparent_1px)] bg-[size:64px_64px]" />

      <div className="relative min-h-screen flex">
        {/* Left side - Benefits */}
        <div className="hidden lg:flex lg:w-1/2 flex-col justify-center px-12 xl:px-20">
          <Link to="/" className="inline-flex items-center space-x-3 mb-8">
            <TokenTrailLogo className="w-10 h-10" />
            <span className="text-2xl font-semibold text-white tracking-tight">TokenTrail</span>
          </Link>

          <div className="inline-flex items-center px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-emerald-400 text-sm mb-4 w-fit">
            <span className="w-2 h-2 bg-emerald-400 rounded-full mr-2" />
            Early Access Available
          </div>
          <h1 className="text-4xl font-bold text-white mb-4">
            Start tracking your LLM costs today
          </h1>
          <p className="text-xl text-zinc-400 mb-8">
            Get instant visibility into every API call. See exactly where your AI budget goes.
          </p>

          <div className="space-y-4">
            {benefits.map((benefit) => (
              <div key={benefit} className="flex items-center space-x-3">
                <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                  <svg className="w-3 h-3 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <span className="text-zinc-300">{benefit}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right side - Form */}
        <div className="w-full lg:w-1/2 flex items-center justify-center px-4 py-12">
          <div className="w-full max-w-md space-y-8">
            {/* Mobile logo */}
            <div className="lg:hidden text-center">
              <Link to="/" className="inline-flex items-center space-x-3 mb-6">
                <TokenTrailLogo className="w-10 h-10" />
                <span className="text-2xl font-semibold text-white tracking-tight">TokenTrail</span>
              </Link>
            </div>

            <div className="text-center lg:text-left">
              <h2 className="text-3xl font-bold text-white">
                Create your account
              </h2>
              <p className="mt-2 text-zinc-400">Get instant access to the dashboard</p>
            </div>

            <div className="bg-zinc-900/80 backdrop-blur rounded-xl border border-zinc-800 p-8">
              <form className="space-y-5" onSubmit={handleSubmit}>
                <div>
                  <label htmlFor="company_name" className="block text-sm font-medium text-zinc-300 mb-2">
                    Company name
                  </label>
                  <input
                    id="company_name"
                    name="company_name"
                    type="text"
                    required
                    className="w-full px-4 py-3 bg-zinc-800/50 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                    placeholder="Acme Inc"
                    value={formData.company_name}
                    onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                  />
                </div>

                <div>
                  <label htmlFor="full_name" className="block text-sm font-medium text-zinc-300 mb-2">
                    Your name
                  </label>
                  <input
                    id="full_name"
                    name="full_name"
                    type="text"
                    className="w-full px-4 py-3 bg-zinc-800/50 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                    placeholder="John Doe"
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  />
                </div>

                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-zinc-300 mb-2">
                    Work email
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
                    minLength={8}
                    className="w-full px-4 py-3 bg-zinc-800/50 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                    placeholder="At least 8 characters"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  />
                </div>

                {mutation.isError && (
                  <div role="alert" className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                    {(mutation.error as Error & { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Registration failed. Please try again.'}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={mutation.isPending}
                  className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {mutation.isPending ? 'Creating account...' : 'Get Started Free'}
                </button>

                <p className="text-xs text-zinc-500 text-center">
                  No credit card required. By signing up, you agree to our Terms of Service and Privacy Policy.
                </p>
              </form>
            </div>

            <p className="text-center text-sm text-zinc-400">
              Already have an account?{' '}
              <Link to="/login" className="font-medium text-emerald-400 hover:text-emerald-300 transition-colors">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
