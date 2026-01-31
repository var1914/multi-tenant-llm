import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { authApi } from '../api/auth'
import { useAuthStore } from '../stores/authStore'

export default function DemoLogin() {
  const navigate = useNavigate()
  const login = useAuthStore((state) => state.login)

  const mutation = useMutation({
    mutationFn: authApi.demoLogin,
    onSuccess: (data) => {
      login(data.user, data.access_token)
      toast.success('Welcome to the TokenTrail demo!')
      navigate('/app/dashboard')
    },
    onError: (error: Error) => {
      toast.error('Demo unavailable. Please try again later.')
      navigate('/')
    },
  })

  useEffect(() => {
    // Auto-login to demo on mount
    mutation.mutate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900 flex items-center justify-center">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
        <p className="mt-4 text-zinc-400">Loading demo...</p>
      </div>
    </div>
  )
}
