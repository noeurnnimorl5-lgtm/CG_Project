import { NavLink } from 'react-router-dom'
import { LayoutDashboard, Camera, Users, FileText, Clock, GraduationCap } from 'lucide-react'
import clsx from 'clsx'

const links = [
  { to: '/',          icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/scanner',   icon: Camera,          label: 'Scanner'   },
  { to: '/students',  icon: Users,           label: 'Students'  },
  { to: '/reports',   icon: FileText,        label: 'Reports'   },
  { to: '/schedule',  icon: Clock,           label: 'Schedule'  },
]

export default function Sidebar() {
  return (
    <aside className="w-64 min-h-screen bg-surface border-r border-border flex flex-col">
      <div className="px-6 py-6 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-accent flex items-center justify-center">
            <GraduationCap size={18} className="text-white" />
          </div>
          <div>
            <p className="font-display font-700 text-text text-sm leading-tight">Smart</p>
            <p className="font-display font-700 text-accent text-sm leading-tight">Attendance</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {links.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) => clsx(
              'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all',
              isActive
                ? 'bg-accent/15 text-accent border border-accent/20'
                : 'text-text-dim hover:text-text hover:bg-border'
            )}
          >
            <Icon size={16} />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="px-6 py-4 border-t border-border">
        <p className="text-xs text-text-dim font-mono">YOLOv8 + InsightFace</p>
        <p className="text-xs text-muted mt-0.5">v1.0.0</p>
      </div>
    </aside>
  )
}