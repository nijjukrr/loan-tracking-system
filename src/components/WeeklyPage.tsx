import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { financeApi } from '../lib/financeApi'
import { calculateNextDueDate, formatDateISO } from '../lib/financeLogic'
import type { Loan } from '../types'
import { MarkPaidModal } from './MarkPaidModal'

const currency = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })

type Props = {
  onOpenNewLoan: () => void
}

export function WeeklyPage({ onOpenNewLoan }: Props) {
  const [loans, setLoans] = useState<Loan[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null)
  const [showPayModal, setShowPayModal] = useState(false)

  const loadData = () => {
    setLoading(true)
    setError('')
    financeApi
      .listLoans({ mode: 'W', search })
      .then((data) => setLoans(data))
      .catch((err) => {
        console.error('Weekly loans load error:', err)
        setError(err instanceof Error ? err.message : 'Unable to load Weekly accounts.')
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadData()
  }, [search])

  const todayStr = formatDateISO(new Date())
  const moneyGiven = loans.reduce((sum, l) => sum + Number(l.principal || 0), 0)

  return (
    <>
      <header className="page-header">
        <div>
          <p className="eyebrow">7-Day Weekly Installment Loans</p>
          <h1>Weekly Loans</h1>
          <p className="page-description">
            Weekly loans are paid every 7 days across 10 weeks. Next due date advances automatically upon payment.
          </p>
        </div>
        <div className="header-actions">
          <button className="primary-button" type="button" onClick={onOpenNewLoan}>
            + New Loan
          </button>
        </div>
      </header>

      {/* Summary Cards */}
      <section className="metrics-grid" style={{ marginBottom: '1.5rem', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
        <div className="metric-card highlight-card">
          <span>Money Given</span>
          <strong>{currency.format(moneyGiven)}</strong>
          <small>Total Weekly principal lent</small>
        </div>
        <div className="metric-card">
          <span>Money Collected</span>
          <strong>₹0</strong>
          <small>Weekly collections (pending logic)</small>
        </div>
      </section>

      {error && <div className="form-message error-message" style={{ marginBottom: '1rem' }}>{error}</div>}

      <section className="search-bar-card">
        <input
          type="search"
          placeholder="Search weekly loans by customer name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </section>

      <section className="table-card">
        <div className="table-heading">
          <div>
            <h2>Weekly Accounts ({loans.length})</h2>
          </div>
        </div>

        {loading ? (
          <div className="empty-state">Loading Weekly loans…</div>
        ) : loans.length === 0 ? (
          <div className="empty-state">
            <strong>No Weekly loans found</strong>
            <span>Add a new Weekly loan to get started.</span>
          </div>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Loan Date</th>
                  <th className="amount-cell">Weekly Amount</th>
                  <th>Next Due</th>
                  <th>Weeks Paid</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loans.map((loan) => {
                  const weeksPaid = Math.floor(loan.total_collected / (loan.weekly_payment || 3000))
                  const nextDue = calculateNextDueDate('W', loan.loan_date)
                  const isOverdue = nextDue < todayStr && loan.status === 'active'
                  const isDueToday = nextDue === todayStr && loan.status === 'active'

                  return (
                    <tr key={loan.id}>
                      <td className="primary-cell">
                        <Link to={`/borrower/${loan.id}`} className="customer-link">
                          {loan.customer_name}
                        </Link>
                      </td>
                      <td>{loan.loan_date}</td>
                      <td className="amount-cell">{currency.format(loan.weekly_payment || 3000)}</td>
                      <td>
                        <span className={`due-tag ${isOverdue ? 'overdue' : isDueToday ? 'due-today' : 'upcoming'}`}>
                          {nextDue}
                        </span>
                      </td>
                      <td>{weeksPaid} / 10</td>
                      <td>
                        <span className={`status-badge ${loan.status}`}>{loan.status.toUpperCase()}</span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button
                            type="button"
                            className="secondary-button compact-button"
                            onClick={() => {
                              setSelectedLoan(loan)
                              setShowPayModal(true)
                            }}
                          >
                            Mark Paid
                          </button>
                          <Link to={`/borrower/${loan.id}`} className="secondary-button compact-button">
                            View
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
          onSuccess={loadData}
        />
      )}
    </>
  )
}

