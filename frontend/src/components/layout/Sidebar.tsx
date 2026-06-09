import { NavLink } from 'react-router-dom'
import { useAuthStore } from '../../stores/authStore'

const navItems = [
  { to: '/dashboard', icon: '📊', label: 'Dashboard' },
  { to: '/cotizaciones', icon: '📄', label: 'Cotizaciones' },
  { to: '/clientes', icon: '👥', label: 'Clientes' },
  { to: '/productos', icon: '📦', label: 'Productos' },
]

interface Props { open: boolean; onClose: () => void }

export default function Sidebar({ open, onClose }: Props) {
  const user = useAuthStore((s) => s.user)

  return (
    <>
      {open && <div className="fixed inset-0 bg-black/40 z-20 md:hidden" onClick={onClose} />}
      <aside className={`fixed inset-y-0 left-0 z-30 w-64 bg-blue-800 text-white flex flex-col transform transition-transform duration-200 md:relative md:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="px-6 py-5 border-b border-blue-700">
          <h1 className="text-xl font-bold">GDM Cotizaciones</h1>
          <p className="text-xs text-blue-200 mt-0.5">Sistema de gestión</p>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${isActive ? 'bg-white/20 text-white' : 'text-blue-100 hover:bg-white/10'}`
              }
            >
              <span className="text-lg">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="px-4 py-3 border-t border-blue-700 text-xs text-blue-300">
          <p className="font-medium text-blue-100">{user?.nombres} {user?.apellidos}</p>
          <p>{user?.roles?.[0]?.nombre ?? 'Usuario'}</p>
        </div>
      </aside>
    </>
  )
}
