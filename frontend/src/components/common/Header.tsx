import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../stores/authStore'

export default function Header() {
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <header className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-x-4 border-b border-vscode-border bg-vscode-bgSidebar px-4 sm:gap-x-6 sm:px-6 lg:px-8">
      <div className="flex flex-1 gap-x-4 self-stretch lg:gap-x-6">
        {/* Search bar placeholder */}
        <div className="flex flex-1 items-center">
          <div className="relative w-full max-w-md">
            <input
              type="text"
              placeholder="Search..."
              className="input w-full pl-10 py-1.5 text-sm"
            />
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-vscode-textMuted"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>

        {/* Right side actions */}
        <div className="flex items-center gap-x-4 lg:gap-x-6">
          {/* Notifications */}
          <button className="btn-ghost p-2 rounded-md relative">
            <svg className="h-5 w-5 text-vscode-textSecondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-vscode-error" />
          </button>

          {/* Divider */}
          <div className="h-6 w-px bg-vscode-border" />

          {/* User menu */}
          <div className="flex items-center gap-x-3">
            <div className="w-8 h-8 rounded-full bg-vscode-blue flex items-center justify-center text-white text-sm font-medium">
              {user?.email?.charAt(0).toUpperCase() || 'U'}
            </div>
            <span className="text-sm text-vscode-text hidden sm:block">{user?.email}</span>
            <button
              onClick={handleLogout}
              className="btn-ghost px-3 py-1.5 text-sm text-vscode-textSecondary hover:text-vscode-error"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    </header>
  )
}
