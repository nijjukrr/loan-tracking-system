import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { financeApi } from '../lib/financeApi'
import { isSupabaseConfigured } from '../lib/supabase'

type Props = {
  onSignOut?: () => void
  onOpenNewLoan: () => void
}

export function AppLayout({ onSignOut, onOpenNewLoan }: Props) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const closeMenu = () => setMobileMenuOpen(false)

  const handleResetData = async () => {
    if (!window.confirm('Are you sure you want to remove all existing loan and payment data? This will reset the tracker to a clean slate.')) {
      return
    }
    await financeApi.clearAllData()
    window.location.reload()
  }

  return (
    <div className="app-shell">
      <a href="#main-content" className="skip-link" style={{ position: 'absolute', top: '-40px', left: 0, background: '#16803c', color: '#fff', padding: '8px', zIndex: 100, transition: 'top 0.2s' }} onFocus={(e) => { e.currentTarget.style.top = '0px'; }} onBlur={(e) => { e.currentTarget.style.top = '-40px'; }}>
        Skip to main content
      </a>
      {/* Mobile Top Header */}
      <header className="mobile-bar" role="banner">
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
            to="/borrowers"
            onClick={closeMenu}
          >
            <span>👥</span> Borrowers
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

          <NavLink
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
            to="/investments"
            onClick={closeMenu}
          >
            <span>💼</span> Investments
          </NavLink>

          <NavLink
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
            to="/interest"
            onClick={closeMenu}
          >
            <span>📈</span> Interest
          </NavLink>

          <NavLink
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
            to="/funds/monthly"
            onClick={closeMenu}
          >
            <span>🎯</span> Monthly Fund
          </NavLink>

          <NavLink
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
            to="/funds/sweet"
            onClick={closeMenu}
          >
            <span>🪔</span> Sweet Fund
          </NavLink>

          <NavLink
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
            to="/reconciliation"
            onClick={closeMenu}
          >
            <span>⚖️</span> Reconciliation
          </NavLink>

          <NavLink
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
            to="/reports"
            onClick={closeMenu}
          >
            <span>📄</span> Reports & Exports
          </NavLink>

          <NavLink
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
            to="/audit"
            onClick={closeMenu}
          >
            <span>🛡️</span> Audit Trail
          </NavLink>
        </nav>

        <div className="sidebar-action">
          <button className="primary-button full-width" type="button" onClick={() => { closeMenu(); onOpenNewLoan(); }}>
            + New Loan
          </button>
        </div>

        <div className="sidebar-footer">
          {!isSupabaseConfigured && <span className="preview-badge">Local excel preview</span>}
          <button
            className="text-button"
            type="button"
            style={{ color: '#ef4444', fontSize: '0.8125rem', marginTop: '0.5rem', display: 'block', width: '100%', textAlign: 'left' }}
            onClick={handleResetData}
          >
            🗑️ Reset / Clear All Data
          </button>
          {onSignOut && (
            <button className="text-button" type="button" onClick={onSignOut}>
              Sign out
            </button>
          )}
        </div>
      </aside>

      {mobileMenuOpen && <div className="mobile-overlay" onClick={closeMenu} role="presentation" />}

      <main id="main-content" className="content" tabIndex={-1}>
        <Outlet />
      </main>
    </div>
  )
}
