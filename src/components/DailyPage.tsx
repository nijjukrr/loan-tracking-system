import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { financeApi } from '../lib/financeApi'
import { calculateNextDueDate, formatDateISO } from '../lib/financeLogic'
import type { Loan } from '../types'
import { MarkPaidModal } from './MarkPaidModal'

const currency = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })

type Props = {
  onOpenNewLoan: () => void
}

export function DailyPage({ onOpenNewLoan }: Props) {
  const [loans, setLoans] = useState<Loan[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'CLOSED'>('ACTIVE')
  const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null)
  const [showPayModal, setShowPayModal] = useState(false)
  const [todayStr] = useState(() => formatDateISO(new Date()))

  const loadData = useCallback(() => {
    setLoading(true)
    setError('')
    const status = statusFilter === 'ALL' ? undefined : statusFilter.toLowerCase() as 'active' | 'closed'
    financeApi
      .listLoans({ mode: 'D', status, search })
      .then((data) => setLoans(data))
      .catch((err) => {
        console.error('Daily loans load error:', err)
        setError(err instanceof Error ? err.message : 'Unable to load Daily accounts.')
      })
      .finally(() => setLoading(false))
  }, [search, statusFilter])

  useEffect(() => {
    loadData()
  }, [loadData])

  const totalPrincipal = loans.reduce((sum, l) => sum + Number(l.principal || 0), 0)
  const totalCollected = loans.reduce((sum, l) => sum + Number(l.total_collected || 0), 0)
  const totalBalance = loans.reduce((sum, l) => sum + Number(l.remaining_balance || 0), 0)

  return (
    <div className="page-shell">
      <header className="page-header">
        <div>
          <p className="eyebrow">10-Day Interest Cycle Loans</p>
          <h1 className="page-title">Daily Loans</h1>
          <p className="page-subtitle">
            Track 10-day interest cycles. Next due updates automatically to Paid Date + 10 days upon payment.
          </p>
        </div>
        <div className="header-actions">
          <button className="primary-button" type="button" onClick={onOpenNewLoan}>
            + New Loan
          </button>
        </div>
      </header>

      {/* Summary KPI Cards */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <span className="kpi-label">Daily Accounts</span>
          <span className="kpi-value">{loans.length}</span>
          <span className="kpi-subtext">Active 10-day cycle loans</span>
        </div>
        <div className="kpi-card highlight-card">
          <span className="kpi-label">Money Given (Principal)</span>
          <span className="kpi-value">{currency.format(totalPrincipal)}</span>
          <span className="kpi-subtext">Total Daily principal deployed</span>
        </div>
        <div className="kpi-card success-card">
          <span className="kpi-label">Money Collected</span>
          <span className="kpi-value">{currency.format(totalCollected)}</span>
          <span className="kpi-subtext">Verified returns received</span>
        </div>
        <div className="kpi-card danger-card">
          <span className="kpi-label">Outstanding Balance</span>
          <span className="kpi-value text-danger">{currency.format(totalBalance)}</span>
          <span className="kpi-subtext">Pending portfolio recovery</span>
        </div>
      </div>

      {error && <div className="form-message error-message" style={{ marginBottom: '1rem' }}>{error}</div>}

      {/* Search & Status Filters */}
      <section className="search-bar-card card" style={{ marginBottom: '1.25rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
          <input
            type="search"
            placeholder="Search borrower, sheet #, A/C #…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8125rem', color: 'var(--muted)', fontWeight: 600 }}>Status:</span>
            {(['ACTIVE', 'CLOSED', 'ALL'] as const).map((s) => (
              <button
                key={s}
                type="button"
                className={statusFilter === s ? 'primary-button compact-button' : 'secondary-button compact-button'}
                style={{ padding: '4px 10px', fontSize: '0.8125rem' }}
                onClick={() => setStatusFilter(s)}
              >
                {s === 'ALL' ? 'All' : s === 'ACTIVE' ? 'Active' : 'Closed'}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="table-card card">
        <div className="card-header" style={{ marginBottom: '1rem' }}>
          <h2 style={{ fontSize: '1.125rem', margin: 0, fontWeight: 700 }}>Daily Accounts ({loans.length})</h2>
        </div>

        {loading ? (
          <div className="empty-state">Loading Daily loans…</div>
        ) : loans.length === 0 ? (
          <div className="empty-state">
            <strong>No Daily loans found</strong>
            <span>Try adjusting your search query or add a new Daily loan.</span>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>A/C #</th>
                  <th>Borrower</th>
                  <th>Loan Date</th>
                  <th style={{ textAlign: 'right' }}>Principal</th>
                  <th style={{ textAlign: 'right' }}>Interest (3%)</th>
                  <th>Next Due</th>
                  <th style={{ textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loans.map((loan) => {
                  const nextDue = calculateNextDueDate('D', loan.loan_date)
                  const isOverdue = nextDue < todayStr && loan.status === 'active'
                  const isDueToday = nextDue === todayStr && loan.status === 'active'

                  return (
                    <tr key={loan.id}>
                      <td style={{ fontWeight: 600, color: 'var(--muted)' }}>#{loan.main_sheet_no}</td>
                      <td className="primary-cell" style={{ fontWeight: 600 }}>
                        <Link to={`/borrower/${loan.id}`} className="customer-link">
                          {loan.customer_name}
                        </Link>
                      </td>
                      <td>{loan.loan_date}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>{currency.format(loan.principal)}</td>
                      <td style={{ textAlign: 'right', color: 'var(--accent)' }}>{currency.format(loan.interest_amount)}</td>
                      <td>
                        <span className={`pill ${isOverdue ? 'pill-red' : isDueToday ? 'pill-gold' : 'pill-green'}`}>
                          {nextDue}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '0.375rem', justifyContent: 'center' }}>
                          {loan.status === 'active' && (
                            <button
                              type="button"
                              className="secondary-button compact-button"
                              style={{ padding: '3px 8px', fontSize: '0.75rem' }}
                              onClick={() => {
                                setSelectedLoan(loan)
                                setShowPayModal(true)
                              }}
                            >
                              Collect
                            </button>
                          )}
                          <Link
                            to={`/borrower/${loan.id}`}
                            className="secondary-button compact-button"
                            style={{ padding: '3px 8px', fontSize: '0.75rem' }}
                          >
                            Timeline
                          </Link>
                        </div>
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
          onSuccess={() => {
            setShowPayModal(false)
            setSelectedLoan(null)
            loadData()
          }}
        />
      )}
    </div>
  )
}
