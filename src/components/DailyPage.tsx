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

export function DailyPage({ onOpenNewLoan }: Props) {
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
      .listLoans({ mode: 'D', search })
      .then((data) => setLoans(data))
      .catch((err) => {
        console.error('Daily loans load error:', err)
        setError(err instanceof Error ? err.message : 'Unable to load Daily accounts.')
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
          <p className="eyebrow">10-Day Cycle Loans</p>
          <h1>Daily Loans</h1>
          <p className="page-description">
            Track 10-day interest cycles. Next due updates automatically to Paid Date + 10 days upon payment.
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
          <small>Total Daily principal lent</small>
        </div>
        <div className="metric-card">
          <span>Money Collected</span>
          <strong>₹0</strong>
          <small>Daily collections (pending logic)</small>
        </div>
      </section>

      {error && <div className="form-message error-message" style={{ marginBottom: '1rem' }}>{error}</div>}

      <section className="search-bar-card">
        <input
          type="search"
          placeholder="Search by customer name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </section>

      <section className="table-card">
        <div className="table-heading">
          <div>
            <h2>Daily Accounts ({loans.length})</h2>
          </div>
        </div>

        {loading ? (
          <div className="empty-state">Loading Daily loans…</div>
        ) : loans.length === 0 ? (
          <div className="empty-state">
            <strong>No Daily loans found</strong>
            <span>Try adjusting your search query or add a new Daily loan.</span>
          </div>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Given Date</th>
                  <th className="amount-cell">Interest Amount</th>
                  <th>Next Due Date</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loans.map((loan) => {
                  const nextDue = calculateNextDueDate('D', loan.loan_date)
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
                      <td className="amount-cell">{currency.format(loan.interest_amount)}</td>
                      <td>
                        <span className={`due-tag ${isOverdue ? 'overdue' : isDueToday ? 'due-today' : 'upcoming'}`}>
                          {nextDue}
                        </span>
                      </td>
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

