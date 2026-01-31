import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Header from './Header'
import DemoBanner from '../DemoBanner'

export default function Layout() {
  return (
    <div className="min-h-screen bg-gray-50">
      <DemoBanner />
      <Sidebar />
      <div className="lg:ml-64 overflow-x-hidden">
        <Header />
        <main className="p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
