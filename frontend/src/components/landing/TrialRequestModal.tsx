import { useState } from 'react'
import { XMarkIcon, CheckCircleIcon, ExclamationCircleIcon } from '@heroicons/react/24/outline'
import trialApi from '../../api/trial'

interface TrialRequestModalProps {
  isOpen: boolean
  onClose: () => void
}

type SubmitState = 'idle' | 'submitting' | 'success' | 'error'

export default function TrialRequestModal({ isOpen, onClose }: TrialRequestModalProps) {
  const [formData, setFormData] = useState({
    email: '',
    full_name: '',
    company_name: '',
    use_case: '',
  })
  const [submitState, setSubmitState] = useState<SubmitState>('idle')
  const [errorMessage, setErrorMessage] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitState('submitting')
    setErrorMessage('')

    try {
      await trialApi.submitRequest({
        email: formData.email,
        full_name: formData.full_name,
        company_name: formData.company_name || undefined,
        use_case: formData.use_case,
      })
      setSubmitState('success')
    } catch (error: unknown) {
      setSubmitState('error')
      const err = error as { response?: { data?: { detail?: string } } }
      if (err.response?.data?.detail) {
        setErrorMessage(err.response.data.detail)
      } else {
        setErrorMessage('Something went wrong. Please try again.')
      }
    }
  }

  const handleClose = () => {
    // Reset form when closing
    setFormData({ email: '', full_name: '', company_name: '', use_case: '' })
    setSubmitState('idle')
    setErrorMessage('')
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md bg-zinc-900 rounded-2xl border border-zinc-800 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="relative px-6 pt-6 pb-4 border-b border-zinc-800">
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 p-2 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>

          {/* MVP Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-500/10 border border-amber-500/20 rounded-full text-amber-400 text-xs font-medium mb-4">
            <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-pulse" />
            MVP Preview
          </div>

          <h2 className="text-xl font-bold text-white">
            Request $5 Trial Credits
          </h2>
          <p className="text-sm text-zinc-400 mt-1">
            Get free credits to explore TokenTrail's full capabilities.
          </p>
        </div>

        {/* Content */}
        <div className="p-6">
          {submitState === 'success' ? (
            // Success state
            <div className="text-center py-4">
              <div className="w-16 h-16 mx-auto mb-4 bg-green-500/10 rounded-full flex items-center justify-center">
                <CheckCircleIcon className="w-8 h-8 text-green-400" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">
                Request Submitted!
              </h3>
              <p className="text-zinc-400 text-sm mb-6">
                We'll review your request and send you an email within 24 hours.
                Keep an eye on your inbox!
              </p>
              <button
                onClick={handleClose}
                className="px-6 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg font-medium transition-colors"
              >
                Got it
              </button>
            </div>
          ) : (
            // Form
            <form onSubmit={handleSubmit} className="space-y-4">
              {submitState === 'error' && (
                <div className="flex items-start gap-3 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                  <ExclamationCircleIcon className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-400">{errorMessage}</p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  className="w-full px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500/50 transition-colors"
                  placeholder="John Doe"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                  Email *
                </label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500/50 transition-colors"
                  placeholder="john@example.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                  Company Name
                </label>
                <input
                  type="text"
                  value={formData.company_name}
                  onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                  className="w-full px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500/50 transition-colors"
                  placeholder="Acme Inc (optional)"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                  What are you building? *
                </label>
                <textarea
                  required
                  rows={3}
                  value={formData.use_case}
                  onChange={(e) => setFormData({ ...formData, use_case: e.target.value })}
                  className="w-full px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500/50 transition-colors resize-none"
                  placeholder="Tell us about your AI product or use case..."
                />
              </div>

              <button
                type="submit"
                disabled={submitState === 'submitting'}
                className="w-full py-3 bg-green-500 hover:bg-green-400 disabled:bg-green-500/50 text-black font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                {submitState === 'submitting' ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Submitting...
                  </>
                ) : (
                  'Request Trial Credits'
                )}
              </button>

              <p className="text-xs text-zinc-500 text-center">
                By submitting, you agree to receive emails about your trial request.
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
