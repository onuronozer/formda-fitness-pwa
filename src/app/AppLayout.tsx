import { Outlet } from 'react-router-dom'
import { BottomNav } from '../components/BottomNav'
import { CloudRuntime } from '../components/CloudRuntime'

export function AppLayout() {
  return <main className="app-canvas"><div className="app-shell"><CloudRuntime /><Outlet /><BottomNav /></div></main>
}
