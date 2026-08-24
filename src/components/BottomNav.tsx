import { Apple, CalendarDays, ChartNoAxesCombined, Dumbbell } from 'lucide-react'
import { NavLink } from 'react-router-dom'

const items = [
  { to: '/today', label: 'Bugün', icon: CalendarDays },
  { to: '/exercise', label: 'Egzersiz', icon: Dumbbell },
  { to: '/nutrition', label: 'Beslenme', icon: Apple },
  { to: '/progress', label: 'İlerleme', icon: ChartNoAxesCombined },
]

export function BottomNav() {
  return <nav className="bottom-nav" aria-label="Ana menü">{items.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} className={({ isActive }) => isActive ? 'active' : ''}><Icon size={21} /><span>{label}</span></NavLink>)}</nav>
}
