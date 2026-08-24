import { CalendarDays, ChartNoAxesCombined, Dumbbell, UserRound } from 'lucide-react'
import { NavLink } from 'react-router-dom'

const items = [
  { to: '/today', label: 'Bugün', icon: CalendarDays },
  { to: '/exercise', label: 'Egzersiz', icon: Dumbbell },
  { to: '/progress', label: 'İlerleme', icon: ChartNoAxesCombined },
  { to: '/profile', label: 'Profil', icon: UserRound },
]

export function BottomNav() {
  return <nav className="bottom-nav" aria-label="Ana menü">{items.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} className={({ isActive }) => isActive ? 'active' : ''}><Icon size={21} /><span>{label}</span></NavLink>)}</nav>
}
