import { NavLink, Outlet } from 'react-router-dom'
import { isSupabaseConfigured } from '../lib/supabase'

type Props = { onSignOut?: () => void }

export function AppLayout({ onSignOut }: Props) {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><span>FT</span><strong>Finance tracker</strong></div>
        <nav aria-label="Main navigation">
          <NavLink className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`} to="/profit/ten-percent">
            <span>10%</span>10% Profit
          </NavLink>
        </nav>
        <div className="sidebar-footer">
          {!isSupabaseConfigured && <span className="preview-badge">Local preview</span>}
          {onSignOut && <button className="text-button" type="button" onClick={onSignOut}>Sign out</button>}
        </div>
      </aside>
      <main className="content"><Outlet /></main>
    </div>
  )
}
