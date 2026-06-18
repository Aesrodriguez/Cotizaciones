import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../stores/authStore'
import toast from 'react-hot-toast'

interface Props { onMenuClick: () => void }

export default function Header({ onMenuClick }: Props) {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    toast.success('Sesión cerrada')
    navigate('/login')
  }

  return (
    <header className="bg-[#1a1a1a] border-b border-[#2a2a2a] px-4 py-3 flex items-center justify-between flex-shrink-0">
      {/* Mobile menu button */}
      <button
        onClick={onMenuClick}
        className="md:hidden p-2 rounded-lg hover:bg-[#2a2a2a] text-[#888] hover:text-[#e8e4da] transition-colors"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
        </svg>
      </button>

      <div className="hidden md:flex items-center gap-2 text-[#444]">
        <span className="text-[11px] font-mono tracking-widest uppercase text-[#555]">
          NIT 901.650.581-4
        </span>
      </div>

      <div className="flex items-center gap-3">
        <div className="text-right hidden sm:block">
          <p className="text-[13px] font-medium text-[#e8e4da]">
            {user?.nombres} {user?.apellidos}
          </p>
          <p className="text-[11px] text-[#888]">
            {user?.roles?.[0]?.nombre}
          </p>
        </div>
        <button
          onClick={handleLogout}
          className="btn-ghost text-[13px] px-3 py-1.5 rounded-lg border border-[#2a2a2a]"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9" />
          </svg>
          Salir
        </button>
      </div>
    </header>
  )
}
