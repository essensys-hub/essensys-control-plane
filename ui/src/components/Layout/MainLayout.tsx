import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import TopBar from './TopBar'

export default function MainLayout() {
  return (
    <div className="min-h-screen bg-cp-gray-50">
      <Sidebar />
      <TopBar />
      <main className="ml-56 mt-14 p-6">
        <Outlet />
      </main>
    </div>
  )
}
