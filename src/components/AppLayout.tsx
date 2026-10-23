import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'

type Props = {
  onSignOut?: () => void
  onOpenNewLoan?: () => void
}

export function AppLayout({ onSignOut: _onSignOut, onOpenNewLoan: _onOpenNewLoan }: Props) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const closeMenu = () => setMobileMenuOpen(false)

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
      </header>

      {/* Sidebar */}
      <aside className={`sidebar ${mobileMenuOpen ? 'open' : ''}`}>
        <div className="brand">
          <span>FT</span>
          <strong>Finance Tracker</strong>
        </div>

        <nav aria-label="Main navigation" style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
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
            to="/total-income"
            onClick={closeMenu}
          >
            <span>📈</span> Total Income
          </NavLink>

          <div className="nav-section-label" style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0.75rem 0 0.25rem 0.5rem' }}>
            Capital & Revenue
          </div>
          <NavLink
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
            to="/investments"
            onClick={closeMenu}
          >
            <span>💼</span> Invest
          </NavLink>
          <NavLink
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
            to="/interest"
            onClick={closeMenu}
          >
            <span>💰</span> Interest
          </NavLink>
          <NavLink
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
            to="/profit/ten-percent"
            onClick={closeMenu}
          >
            <span>🏷️</span> 10% Profit
          </NavLink>
          <NavLink
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
            to="/due"
            onClick={closeMenu}
          >
            <span>⏳</span> Due Ledger
          </NavLink>

          <div className="nav-section-label" style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0.75rem 0 0.25rem 0.5rem' }}>
            Lending Management
          </div>
          <NavLink
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
            to="/daily"
            onClick={closeMenu}
          >
            <span>📅</span> Daily Loans
          </NavLink>
          <NavLink
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
            to="/weekly"
            onClick={closeMenu}
          >
            <span>📆</span> Weekly Loans
          </NavLink>

          <div className="nav-section-label" style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0.75rem 0 0.25rem 0.5rem' }}>
            Accounting & Audit
          </div>
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
      </aside>

      {mobileMenuOpen && <div className="mobile-overlay" onClick={closeMenu} role="presentation" />}

      <main id="main-content" className="content" tabIndex={-1}>
        <Outlet />
      </main>
    </div>
  )
}
