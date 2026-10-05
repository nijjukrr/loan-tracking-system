import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { financeApi } from '../lib/financeApi'
import { calculateNextDueDate, formatDateISO } from '../lib/financeLogic'
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
  const [search, setSearch] = useState('')
  const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null)
  const [showPayModal, setShowPayModal] = useState(false)

  const loadData = () => {
    setLoading(true)
    const mode = modeFilter === 'ALL' ? undefined : modeFilter
    financeApi
      .listLoans({ status: 'active', mode, search })
      .then((data) => setLoans(data))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadData()
  }, [modeFilter, search])

  const todayStr = formatDateISO(new Date())

  return (
    <>
      <header className="page-header">
        <div>
          <p className="eyebrow">Portfolio</p>
          <h1>Active Accounts</h1>
          <p className="page-description">Overview of all active open loans across Daily and Weekly modes.</p>
        </div>
        <div className="header-actions">
          <button className="primary-button" type="button" onClick={onOpenNewLoan}>
            + New Loan
          </button>
        </div>
      </header>

      <section className="search-bar-card filters-row">
        <input
          type="search"
          placeholder="Search active accounts by customer or Main Sheet No…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <select value={modeFilter} onChange={(e) => setModeFilter(e.target.value as ModeKind | 'ALL')}>
          <option value="ALL">All Modes</option>
          <option value="D">Daily Loans</option>
          <option value="W">Weekly Loans</option>
        </select>
      </section>

      <section className="table-card">
        <div className="table-heading">
          <div>
            <h2>Open Accounts ({loans.length})</h2>
            <p>Active Money Lent: {currency.format(loans.reduce((sum, l) => sum + l.principal, 0))}</p>
          </div>
        </div>

        {loading ? (
          <div className="empty-state">Loading active accounts…</div>
        ) : loans.length === 0 ? (
          <div className="empty-state">No active accounts found.</div>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Customer Name</th>
                  <th>Mode</th>
                  <th>Main Sheet No</th>
                  <th className="amount-cell">Principal</th>
                  <th>Start Date</th>
                  <th>Next Due</th>
                  <th className="amount-cell">Amount Due</th>
                  <th className="amount-cell">Collected</th>
                  <th className="amount-cell">Balance</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {loans.map((loan) => {
                  const nextDue = calculateNextDueDate(loan.mode, loan.loan_date)
                  const isOverdue = nextDue < todayStr
                  const isDueToday = nextDue === todayStr
                  const amountDue = loan.mode === 'D' ? loan.interest_amount : loan.weekly_payment

                  return (
                    <tr key={loan.id}>
                      <td className="primary-cell">
                        <Link to={`/borrower/${loan.id}`} className="customer-link">
                          {loan.customer_name}
                        </Link>
                      </td>
                      <td>
                        <span className="source-badge">{loan.mode === 'D' ? 'Daily' : 'Weekly'}</span>
                      </td>
                      <td>#{loan.main_sheet_no}</td>
                      <td className="amount-cell">{currency.format(loan.principal)}</td>
                      <td>{loan.loan_date}</td>
                      <td>
                        <span className={`due-tag ${isOverdue ? 'overdue' : isDueToday ? 'due-today' : 'upcoming'}`}>
                          {nextDue}
                        </span>
                      </td>
                      <td className="amount-cell">{currency.format(amountDue)}</td>
                      <td className="amount-cell">{currency.format(loan.total_collected)}</td>
                      <td className="amount-cell text-highlight">{currency.format(loan.remaining_balance)}</td>
                      <td>
                        <span className="status-badge active">ACTIVE</span>
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
