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
  const [search, setSearch] = useState('')
  const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null)
  const [showPayModal, setShowPayModal] = useState(false)

  const loadData = () => {
    setLoading(true)
    financeApi
      .listLoans({ mode: 'D', search })
      .then((data) => setLoans(data))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadData()
  }, [search])

  const todayStr = formatDateISO(new Date())

  return (
    <>
      <header className="page-header">
        <div>
          <p className="eyebrow">10-Day Cycle Loans</p>
          <h1>Daily Loans</h1>
          <p className="page-description">
            Track 10-day interest cycles (up to 60 days). Next due updates automatically to Paid Date + 10 days upon payment.
          </p>
        </div>
        <div className="header-actions">
          <button className="primary-button" type="button" onClick={onOpenNewLoan}>
            + New Loan
          </button>
        </div>
      </header>

      <section className="search-bar-card">
        <input
          type="search"
          placeholder="Search by customer name or Main Sheet No…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </section>

      <section className="table-card">
        <div className="table-heading">
          <div>
            <h2>Daily Accounts ({loans.length})</h2>
            <p>Money Lent: {currency.format(loans.reduce((sum, l) => sum + l.principal, 0))}</p>
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
                  <th>Customer Name</th>
                  <th>Main Sheet No</th>
                  <th>Loan Date</th>
                  <th className="amount-cell">Principal</th>
                  <th className="amount-cell">10d Interest</th>
                  <th>Next Due</th>
                  <th className="amount-cell">Collected</th>
                  <th className="amount-cell">Remaining</th>
                  <th>Status</th>
                  <th>Action</th>
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
                      <td>
                        <span className="sheet-badge">#{loan.main_sheet_no}</span>
                      </td>
                      <td>{loan.loan_date}</td>
                      <td className="amount-cell">{currency.format(loan.principal)}</td>
                      <td className="amount-cell">{currency.format(loan.interest_amount)}</td>
                      <td>
                        <span className={`due-tag ${isOverdue ? 'overdue' : isDueToday ? 'due-today' : 'upcoming'}`}>
                          {nextDue}
                        </span>
                      </td>
                      <td className="amount-cell">{currency.format(loan.total_collected)}</td>
                      <td className="amount-cell">{currency.format(loan.remaining_balance)}</td>
                      <td>
                        <span className={`status-badge ${loan.status}`}>{loan.status.toUpperCase()}</span>
                      </td>
                      <td>
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
