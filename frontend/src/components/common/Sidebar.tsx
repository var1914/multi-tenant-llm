import { Link, useLocation } from 'react-router-dom'
import clsx from 'clsx'
import { useAuthStore } from '../../stores/authStore'

const mainNavigation = [
  { name: 'Dashboard', href: '/app/dashboard', icon: DashboardIcon },
  { name: 'Analytics', href: '/app/analytics', icon: AnalyticsIcon },
  { name: 'Smart Routing', href: '/app/smart-routing', icon: RoutingIcon },
  { name: 'Predictions', href: '/app/predictions', icon: PredictionsIcon },
  { name: 'Workflows', href: '/app/workflows', icon: WorkflowsIcon },
  { name: 'Agent Efficiency', href: '/app/agent-efficiency', icon: EfficiencyIcon },
]

const manageNavigation = [
  { name: 'Customers', href: '/app/customers', icon: CustomersIcon },
  { name: 'API Keys', href: '/app/api-keys', icon: KeyIcon },
  { name: 'Billing', href: '/app/billing', icon: BillingIcon },
  { name: 'Settings', href: '/app/settings', icon: SettingsIcon },
]

function DashboardIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
    </svg>
  )
}

function AnalyticsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
    </svg>
  )
}

function CustomersIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
    </svg>
  )
}

function KeyIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
    </svg>
  )
}

function BillingIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
    </svg>
  )
}

function SettingsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  )
}

function RoutingIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
    </svg>
  )
}

function PredictionsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
    </svg>
  )
}

function WorkflowsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75v10.5M15 12v5.25" />
    </svg>
  )
}

function EfficiencyIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
    </svg>
  )
}

function AdminIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
    </svg>
  )
}

// Navigation item component
function NavItem({ item, isActive }: { item: { name: string; href: string; icon: React.ComponentType<{ className?: string }> }; isActive: boolean }) {
  return (
    <li>
      <Link
        to={item.href}
        className={clsx(
          'group flex items-center gap-x-3 rounded-md px-3 py-2 text-sm font-medium transition-all duration-200',
          isActive
            ? 'bg-vscode-bgActive text-vscode-text border-l-2 border-vscode-blue'
            : 'text-vscode-textSecondary hover:bg-vscode-bgHover hover:text-vscode-text border-l-2 border-transparent'
        )}
      >
        <item.icon className={clsx(
          'h-5 w-5 shrink-0 transition-colors',
          isActive ? 'text-vscode-blue' : 'text-vscode-textSecondary group-hover:text-vscode-text'
        )} />
        {item.name}
        {isActive && (
          <span className="ml-auto w-1.5 h-1.5 rounded-full bg-vscode-blue animate-pulse" />
        )}
      </Link>
    </li>
  )
}

export default function Sidebar() {
  const location = useLocation()
  const { user } = useAuthStore()
  const isAdmin = user?.role === 'admin'

  return (
    <div className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-50 lg:block lg:w-64 lg:overflow-y-auto lg:bg-vscode-bgSidebar lg:border-r lg:border-vscode-border lg:pb-4">
      {/* Logo Section */}
      <div className="flex h-16 shrink-0 items-center px-6 border-b border-vscode-border">
        <div className="flex items-center gap-3">
          <svg viewBox="0 0 40 40" className="w-8 h-8" fill="none">
            <path
              d="M8 32C8 32 12 28 16 24C20 20 24 16 28 12C32 8 36 8 36 8"
              stroke="url(#sidebar-trail-gradient)"
              strokeWidth="3"
              strokeLinecap="round"
            />
            <circle cx="10" cy="30" r="4" fill="#22c55e" />
            <circle cx="20" cy="20" r="3.5" fill="#eab308" />
            <circle cx="30" cy="10" r="3" fill="#ef4444" />
            <defs>
              <linearGradient id="sidebar-trail-gradient" x1="8" y1="32" x2="36" y2="8">
                <stop offset="0%" stopColor="#22c55e" />
                <stop offset="50%" stopColor="#eab308" />
                <stop offset="100%" stopColor="#ef4444" />
              </linearGradient>
            </defs>
          </svg>
          <span className="text-lg font-semibold text-vscode-text">TokenTrail</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="mt-4 px-3">
        {/* Main section */}
        <div className="px-3 mb-2">
          <span className="text-xs font-medium text-vscode-textMuted uppercase tracking-wider">
            Overview
          </span>
        </div>
        <ul role="list" className="space-y-1">
          {mainNavigation.map((item) => (
            <NavItem key={item.name} item={item} isActive={location.pathname === item.href} />
          ))}
        </ul>

        {/* Manage section */}
        <div className="px-3 mt-6 mb-2">
          <span className="text-xs font-medium text-vscode-textMuted uppercase tracking-wider">
            Manage
          </span>
        </div>
        <ul role="list" className="space-y-1">
          {manageNavigation.map((item) => (
            <NavItem key={item.name} item={item} isActive={location.pathname === item.href} />
          ))}
        </ul>

        {/* Admin section - only visible to admins */}
        {isAdmin && (
          <>
            <div className="px-3 mt-6 mb-2">
              <span className="text-xs font-medium text-vscode-textMuted uppercase tracking-wider">
                Admin
              </span>
            </div>
            <ul role="list" className="space-y-1">
              <NavItem
                item={{ name: 'Admin Panel', href: '/app/admin', icon: AdminIcon }}
                isActive={location.pathname === '/app/admin'}
              />
            </ul>
          </>
        )}
      </nav>

      {/* Bottom status */}
      <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-vscode-border bg-vscode-bgSidebar">
        <div className="flex items-center gap-3 px-3">
          <span className="w-2 h-2 rounded-full bg-vscode-success animate-pulse" />
          <span className="text-xs text-vscode-textSecondary">System Online</span>
        </div>
      </div>
    </div>
  )
}
