import { NavLink } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';

const navItems = [
  { to: '/dashboard', icon: '📊', label: 'Dashboard' },
  { to: '/cotizaciones', icon: '📄', label: 'Cotizaciones' },
  { to: '/clientes', icon: '👥', label: 'Clientes' },
  { to: '/productos', icon: '📦', label: 'Productos' },
  { to: '/usuarios', icon: '🔑', label: 'Usuarios', roles: ['admin'] },
];

export default function Sidebar({ open, onClose }) {
  const { user } = useAuthStore();
  const filtered = navItems.filter((i) => !i.roles || i.roles.includes(user?.role));

  return (
    <>
      {open && <div className="fixed inset-0 bg-black/40 z-20 md:hidden" onClick={onClose} />}
      <aside className={`fixed inset-y-0 left-0 z-30 w-64 bg-primary-800 text-white flex flex-col transform transition-transform duration-200 md:relative md:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="px-6 py-5 border-b border-primary-700">
          <h1 className="text-xl font-bold text-white">GDM Cotizaciones</h1>
          <p className="text-xs text-primary-200 mt-0.5">Sistema de gestión</p>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {filtered.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${isActive ? 'bg-white/20 text-white' : 'text-primary-100 hover:bg-white/10 hover:text-white'}`
              }
            >
              <span className="text-lg">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="px-4 py-3 border-t border-primary-700 text-xs text-primary-300">
          <p className="font-medium text-primary-100">{user?.name}</p>
          <p className="capitalize">{user?.role}</p>
        </div>
      </aside>
    </>
  );
}
