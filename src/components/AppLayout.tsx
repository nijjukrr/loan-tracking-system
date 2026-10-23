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

        <nav aria-label="Main navigation" style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
          <NavLink
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
            to="/"
            end
            onClick={closeMenu}
          >
            <span>📊</span> Dashboard
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
