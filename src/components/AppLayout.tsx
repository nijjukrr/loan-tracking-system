import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { isSupabaseConfigured } from '../lib/supabase'

type Props = {
  onSignOut?: () => void
  onOpenNewLoan: () => void
}

export function AppLayout({ onSignOut, onOpenNewLoan }: Props) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const closeMenu = () => setMobileMenuOpen(false)

  return (
    <div className="app-shell">
      {/* Mobile Top Header */}
      <header className="mobile-bar">
        <button
          className="menu-toggle"
          type="button"
          aria-label="Toggle Navigation"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          ☰
        </button>
        <div className="brand">
          <span>FT</span>
          <strong>Finance Tracker</strong>
        </div>
        <button className="primary-button compact-button" type="button" onClick={onOpenNewLoan}>
          + Loan
        </button>
      </header>

      {/* Sidebar */}
      <aside className={`sidebar ${mobileMenuOpen ? 'open' : ''}`}>
        <div className="brand">
          <span>FT</span>
          <strong>Finance Tracker</strong>
        </div>

        <nav aria-label="Main navigation">
          <NavLink
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
            to="/"
            end
            onClick={closeMenu}
          >
            <span>📊</span> Dashboard
          </NavLink>

          <NavLink
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
            to="/daily"
            onClick={closeMenu}
          >
            <span>📅</span> Daily (10-Day)
          </NavLink>

          <NavLink
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
            to="/weekly"
            onClick={closeMenu}
          >
            <span>🗓️</span> Weekly (10-Wk)
          </NavLink>

          <NavLink
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
            to="/reminders"
            onClick={closeMenu}
          >
            <span>🔔</span> Reminders
          </NavLink>

          <NavLink
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
            to="/payments"
            onClick={closeMenu}
          >
            <span>💳</span> Payments
          </NavLink>

          <NavLink
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
            to="/active-accounts"
            onClick={closeMenu}
          >
            <span>📂</span> Active Accounts
          </NavLink>

          <NavLink
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
            to="/closed-accounts"
            onClick={closeMenu}
          >
            <span>📁</span> Closed Accounts
          </NavLink>

          <NavLink
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
            to="/profit/ten-percent"
            onClick={closeMenu}
          >
            <span>💰</span> 10% Profit
          </NavLink>
        </nav>

        <div className="sidebar-action">
          <button className="primary-button full-width" type="button" onClick={() => { closeMenu(); onOpenNewLoan(); }}>
            + New Loan
          </button>
        </div>

        <div className="sidebar-footer">
          {!isSupabaseConfigured && <span className="preview-badge">Local excel preview</span>}
          {onSignOut && (
            <button className="text-button" type="button" onClick={onSignOut}>
              Sign out
            </button>
          )}
        </div>
      </aside>

      {mobileMenuOpen && <div className="mobile-overlay" onClick={closeMenu} role="presentation" />}

      <main className="content">
        <Outlet />
      </main>
    </div>
  )
}
