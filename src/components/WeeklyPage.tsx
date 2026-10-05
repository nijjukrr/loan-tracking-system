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
  const [search, setSearch] = useState('')
  const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null)
  const [showPayModal, setShowPayModal] = useState(false)

  const loadData = () => {
    setLoading(true)
    financeApi
      .listLoans({ mode: 'W', search })
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
          <p className="eyebrow">7-Day Weekly Installment Loans</p>
          <h1>Weekly Loans</h1>
          <p className="page-description">
            Weekly loans are paid every 7 days across 10 weeks (e.g. ₹27,000 principal → 10 payments of ₹3,000 = ₹30,000 total expected, ₹3,000 profit).
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
          placeholder="Search weekly loans by customer or Main Sheet No…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </section>

      <section className="table-card">
        <div className="table-heading">
          <div>
            <h2>Weekly Accounts ({loans.length})</h2>
            <p>Money Lent: {currency.format(loans.reduce((sum, l) => sum + l.principal, 0))}</p>
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
                  <th>Customer</th>
                  <th>Main Sheet No</th>
                  <th>Borrowed Date</th>
                  <th className="amount-cell">Principal</th>
                  <th className="amount-cell">Weekly Payment</th>
                  <th className="amount-cell">Total Expected</th>
                  <th>Weeks Paid</th>
                  <th>Weeks Remaining</th>
                  <th>Next Due</th>
                  <th className="amount-cell">Total Received</th>
                  <th className="amount-cell">Remaining</th>
                  <th className="amount-cell">Profit</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {loans.map((loan) => {
                  const weeksPaid = Math.floor(loan.total_collected / (loan.weekly_payment || 3000))
                  const weeksRemaining = Math.max(0, 10 - weeksPaid)
                  const nextDue = calculateNextDueDate('W', loan.loan_date)
                  const isOverdue = nextDue < todayStr && loan.status === 'active'
                  const isDueToday = nextDue === todayStr && loan.status === 'active'
                  const profit = Math.max(0, loan.total_expected - loan.principal)

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
                      <td className="amount-cell">{currency.format(loan.weekly_payment)}</td>
                      <td className="amount-cell">{currency.format(loan.total_expected)}</td>
                      <td>{weeksPaid} / 10</td>
                      <td>{weeksRemaining} wks</td>
                      <td>
                        <span className={`due-tag ${isOverdue ? 'overdue' : isDueToday ? 'due-today' : 'upcoming'}`}>
                          {nextDue}
                        </span>
                      </td>
                      <td className="amount-cell">{currency.format(loan.total_collected)}</td>
                      <td className="amount-cell">{currency.format(loan.remaining_balance)}</td>
                      <td className="amount-cell text-success">{currency.format(profit)}</td>
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
