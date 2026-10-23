import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { financeApi } from '../lib/financeApi'
import type { Loan, ModeKind } from '../types'
import { MarkPaidModal } from './MarkPaidModal'

const currency = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })

type Props = {
  onOpenNewLoan: () => void
}

export function ActiveAccountsPage({ onOpenNewLoan }: Props) {
  const [loans, setLoans] = useState<Loan[]>([])
  const [loading, setLoading] = useState(true)
  const [modeFilter, setModeFilter] = useState<ModeKind | 'ALL'>('ALL')
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'OUTSTANDING' | 'CLEARED'>('OUTSTANDING')
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<'date-desc' | 'date-asc' | 'principal-desc' | 'name-asc'>('date-desc')
  const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null)
  const [showPayModal, setShowPayModal] = useState(false)

  const loadData = useCallback(() => {
    setLoading(true)
    const mode = modeFilter === 'ALL' ? undefined : modeFilter
    const status = statusFilter === 'CLEARED' ? 'closed' : statusFilter === 'OUTSTANDING' ? 'active' : undefined
    financeApi
      .listLoans({ status, mode })
      .then((data) => setLoans(data))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false))
  }, [modeFilter, statusFilter])

  useEffect(() => {
    loadData()
  }, [loadData])

  const filteredLoans = loans
    .filter((loan) => {
      // Search
      if (search.trim()) {
        const q = search.toLowerCase()
        const matchesName = loan.customer_name.toLowerCase().includes(q)
        const matchesNo = String(loan.main_sheet_no).includes(q)
        const matchesAc = loan.ac_no ? String(loan.ac_no).includes(q) : false
        if (!matchesName && !matchesNo && !matchesAc) return false
      }

      // Cleared / Outstanding filter
      const isCleared = loan.source_paid || loan.status === 'closed'
      if (statusFilter === 'OUTSTANDING' && isCleared) return false
      if (statusFilter === 'CLEARED' && !isCleared) return false

      return true
    })
    .sort((a, b) => {
      if (sortBy === 'date-desc') return (b.loan_date || '').localeCompare(a.loan_date || '')
      if (sortBy === 'date-asc') return (a.loan_date || '').localeCompare(b.loan_date || '')
      if (sortBy === 'principal-desc') return (b.principal || 0) - (a.principal || 0)
      if (sortBy === 'name-asc') return a.customer_name.localeCompare(b.customer_name)
      return 0
    })

  // Summary totals strictly derived from the filtered set
  const totalPrincipal = filteredLoans.reduce((sum, l) => sum + (l.principal || 0), 0)
  const totalCollected = filteredLoans.reduce((sum, l) => sum + (l.total_collected || 0), 0)
  const totalBalance = filteredLoans.reduce((sum, l) => sum + (l.remaining_balance || 0), 0)

  return (
    <div className="page-shell">
      <header className="page-header">
        <div>
          <p className="eyebrow">Portfolio & Ledger</p>
          <h1 className="page-title">Active Loan Accounts</h1>
          <p className="page-subtitle">
            Every loan debit entry tracked independently, with account numbering, search, and settlement filters.
          </p>
        </div>
        <div className="header-actions">
          <button className="primary-button" type="button" onClick={onOpenNewLoan}>
            + New Loan
          </button>
        </div>
      </header>

      {/* Filtered Summary KPIs */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <span className="kpi-label">Listed Accounts</span>
          <span className="kpi-value">{filteredLoans.length}</span>
          <span className="kpi-subtext">Active ledger items</span>
        </div>
        <div className="kpi-card highlight-card">
          <span className="kpi-label">Total Principal</span>
          <span className="kpi-value">{currency.format(totalPrincipal)}</span>
          <span className="kpi-subtext">Capital deployed</span>
        </div>
        <div className="kpi-card success-card">
          <span className="kpi-label">Total Recovered</span>
          <span className="kpi-value">{currency.format(totalCollected)}</span>
          <span className="kpi-subtext">Repayments received</span>
        </div>
        <div className="kpi-card danger-card">
          <span className="kpi-label">Remaining Balance</span>
          <span className="kpi-value text-danger">{currency.format(totalBalance)}</span>
          <span className="kpi-subtext">Outstanding obligations</span>
        </div>
      </div>

      {/* Search & Filters */}
      <section className="search-bar-card card" style={{ marginBottom: '1.25rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
          <input
            type="search"
            placeholder="Search borrower, sheet #, A/C #…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ padding: '0.5rem 0.75rem', border: '1px solid var(--line)', borderRadius: '6px' }}
          />

          <select
            value={modeFilter}
            onChange={(e) => setModeFilter(e.target.value as ModeKind | 'ALL')}
            style={{ padding: '0.5rem 0.75rem', border: '1px solid var(--line)', borderRadius: '6px' }}
          >
            <option value="ALL">All Modes</option>
            <option value="D">Daily Loans (D)</option>
            <option value="W">Weekly Loans (W)</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            style={{ padding: '0.5rem 0.75rem', border: '1px solid var(--line)', borderRadius: '6px' }}
          >
            <option value="ALL">All Ledger Statuses</option>
            <option value="OUTSTANDING">Outstanding Only</option>
            <option value="CLEARED">Cleared / Settled Only</option>
          </select>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            style={{ padding: '0.5rem 0.75rem', border: '1px solid var(--line)', borderRadius: '6px' }}
          >
            <option value="date-desc">Loan Date (Newest First)</option>
            <option value="date-asc">Loan Date (Oldest First)</option>
            <option value="principal-desc">Principal (Highest First)</option>
            <option value="name-asc">Borrower Name (A-Z)</option>
          </select>
        </div>
      </section>

      {/* Table */}
      <section className="table-card card">
        <div className="card-header" style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ fontSize: '1.125rem', margin: 0, fontWeight: 700 }}>Individual Debit Accounts ({filteredLoans.length})</h2>
            <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--muted)' }}>
              Filtered Principal Total: {currency.format(totalPrincipal)}
            </p>
          </div>
        </div>

        {loading ? (
          <div className="loading-state">Loading active accounts…</div>
        ) : filteredLoans.length === 0 ? (
          <div className="empty-state">
            <strong>No loan accounts found</strong>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.8125rem', color: 'var(--muted)' }}>Try adjusting your filters or search keywords.</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Borrower Name</th>
                  <th>Mode</th>
                  <th>Loan Date</th>
                  <th style={{ textAlign: 'right' }}>Principal</th>
                  <th style={{ textAlign: 'right' }}>Collected</th>
                  <th style={{ textAlign: 'right' }}>Balance</th>
                  <th>Ledger Status</th>
                  <th style={{ textAlign: 'center' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredLoans.map((loan) => {
                  const isCleared = loan.source_paid || loan.status === 'closed'

                  return (
                    <tr key={loan.id}>
                      <td className="primary-cell" style={{ fontWeight: 600 }}>
                        <Link to={`/borrower/${loan.id}`} className="customer-link">
                          {loan.customer_name}
                        </Link>
                        {loan.ac_no && (
                          <span style={{ fontSize: '0.75rem', color: 'var(--muted)', display: 'block' }}>
                            A/C #{loan.ac_no}
                          </span>
                        )}
                      </td>
                      <td>
                        <span className="source-badge">{loan.mode === 'D' ? 'Daily' : 'Weekly'}</span>
                      </td>
                      <td>{loan.loan_date}</td>
                      <td className="amount-cell" style={{ textAlign: 'right' }}>{currency.format(loan.principal)}</td>
                      <td className="amount-cell" style={{ textAlign: 'right' }}>{currency.format(loan.total_collected)}</td>
                      <td className="amount-cell text-danger" style={{ textAlign: 'right' }}>{currency.format(loan.remaining_balance)}</td>
                      <td>
                        <span className={`status-badge ${isCleared ? 'paid' : 'active'}`}>
                          {isCleared ? 'CLEARED' : 'OUTSTANDING'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {isCleared ? (
                          <span className="text-success" style={{ fontSize: '0.8125rem', fontWeight: 600 }}>✓ Settled</span>
                        ) : (
                          <button
                            type="button"
                            className="primary-button compact-button"
                            style={{ padding: '3px 8px', fontSize: '0.75rem' }}
                            onClick={() => {
                              setSelectedLoan(loan)
                              setShowPayModal(true)
                            }}
                          >
                            Mark Paid
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {showPayModal && selectedLoan && (
        <MarkPaidModal
          isOpen={showPayModal}
          loan={selectedLoan}
          onClose={() => {
            setShowPayModal(false)
            setSelectedLoan(null)
          }}
          onSuccess={loadData}
        />
      )}
    </div>
  )
}
