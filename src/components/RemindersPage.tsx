import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { financeApi } from '../lib/financeApi'
import { differenceInDays, formatDateISO } from '../lib/financeLogic'
import type { Installment, Loan } from '../types'
import { MarkPaidModal } from './MarkPaidModal'

const currency = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })

export function RemindersPage() {
  const [installments, setInstallments] = useState<Array<Installment & { loan?: Loan }>>([])
  const [loading, setLoading] = useState(true)
  const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null)
  const [selectedInst, setSelectedInst] = useState<Installment | null>(null)
  const [showPayModal, setShowPayModal] = useState(false)

  const loadData = () => {
    setLoading(true)
    financeApi
      .listInstallments()
      .then((data) => setInstallments(data))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadData()
  }, [])

  const todayStr = formatDateISO(new Date())

  // Categorize
  const dueToday = installments.filter((i) => i.due_date === todayStr && i.paid_amount < i.expected_amount)

  const overdue = installments
    .filter((i) => i.due_date < todayStr && i.paid_amount < i.expected_amount)
    .sort((a, b) => differenceInDays(a.due_date, todayStr) - differenceInDays(b.due_date, todayStr)) // Most overdue first

  const upcoming = installments
    .filter((i) => i.due_date > todayStr && i.paid_amount < i.expected_amount)
    .sort((a, b) => a.due_date.localeCompare(b.due_date))

  const handleMarkPaid = (inst: Installment & { loan?: Loan }) => {
    if (inst.loan) {
      setSelectedLoan(inst.loan)
      setSelectedInst(inst)
      setShowPayModal(true)
    }
  }

  return (
    <>
      <header className="page-header">
        <div>
          <p className="eyebrow">Payment Schedules</p>
          <h1>Reminders & Due Dates</h1>
          <p className="page-description">
            Automatic collection tracking for Due Today, Overdue, and Upcoming loan payments.
          </p>
        </div>
      </header>

      {loading ? (
        <div className="empty-state">Loading reminders…</div>
      ) : (
        <div className="reminders-sections">
          {/* Section 1: Due Today */}
          <section className="table-card">
            <div className="table-heading warning-heading">
              <div>
                <h2>Due Today ({dueToday.length})</h2>
                <p>Payments expected today ({todayStr})</p>
              </div>
            </div>

            {dueToday.length === 0 ? (
              <div className="empty-state">No payments due today.</div>
            ) : (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Customer Name</th>
                      <th>Mode</th>
                      <th>Main Sheet No</th>
                      <th className="amount-cell">Principal</th>
                      <th className="amount-cell">Amount Due</th>
                      <th>Due Date</th>
                      <th className="amount-cell">Remaining Balance</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dueToday.map((inst) => (
                      <tr key={inst.id}>
                        <td className="primary-cell">
                          {inst.loan ? (
                            <Link to={`/borrower/${inst.loan.id}`} className="customer-link">
                              {inst.loan.customer_name}
                            </Link>
                          ) : (
                            'Unknown'
                          )}
                        </td>
                        <td>
                          <span className="source-badge">{inst.loan?.mode === 'D' ? 'Daily' : 'Weekly'}</span>
                        </td>
                        <td>#{inst.loan?.main_sheet_no}</td>
                        <td className="amount-cell">{currency.format(inst.loan?.principal || 0)}</td>
                        <td className="amount-cell primary-cell">{currency.format(inst.expected_amount - inst.paid_amount)}</td>
                        <td>
                          <span className="due-tag due-today">{inst.due_date}</span>
                        </td>
                        <td className="amount-cell">{currency.format(inst.loan?.remaining_balance || 0)}</td>
                        <td>
                          <button
                            type="button"
                            className="primary-button compact-button"
                            onClick={() => handleMarkPaid(inst)}
                          >
                            Mark Paid
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Section 2: Overdue */}
          <section className="table-card">
            <div className="table-heading danger-heading">
              <div>
                <h2>Overdue Payments ({overdue.length})</h2>
                <p>Sorted by most overdue first</p>
              </div>
            </div>

            {overdue.length === 0 ? (
              <div className="empty-state">No overdue payments. All accounts are up to date!</div>
            ) : (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Customer Name</th>
                      <th>Mode</th>
                      <th>Original Due Date</th>
                      <th>Days Overdue</th>
                      <th className="amount-cell">Amount Due</th>
                      <th className="amount-cell">Principal</th>
                      <th className="amount-cell">Remaining Balance</th>
                      <th>Last Payment</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overdue.map((inst) => {
                      const daysOverdue = differenceInDays(inst.due_date, todayStr)
                      return (
                        <tr key={inst.id}>
                          <td className="primary-cell">
                            {inst.loan ? (
                              <Link to={`/borrower/${inst.loan.id}`} className="customer-link">
                                {inst.loan.customer_name}
                              </Link>
                            ) : (
                              'Unknown'
                            )}
                          </td>
                          <td>
                            <span className="source-badge">{inst.loan?.mode === 'D' ? 'Daily' : 'Weekly'}</span>
                          </td>
                          <td>{inst.due_date}</td>
                          <td>
                            <span className="due-tag overdue">+{daysOverdue} days</span>
                          </td>
                          <td className="amount-cell text-danger">{currency.format(inst.expected_amount - inst.paid_amount)}</td>
                          <td className="amount-cell">{currency.format(inst.loan?.principal || 0)}</td>
                          <td className="amount-cell">{currency.format(inst.loan?.remaining_balance || 0)}</td>
                          <td>{inst.paid_date || 'No payment yet'}</td>
                          <td>
                            <button
                              type="button"
                              className="secondary-button compact-button"
                              onClick={() => handleMarkPaid(inst)}
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

          {/* Section 3: Upcoming */}
          <section className="table-card">
            <div className="table-heading">
              <div>
                <h2>Upcoming Schedules ({upcoming.length})</h2>
                <p>Next upcoming collections</p>
              </div>
            </div>

            {upcoming.length === 0 ? (
              <div className="empty-state">No upcoming payments scheduled.</div>
            ) : (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Customer Name</th>
                      <th>Mode</th>
                      <th>Due Date</th>
                      <th>Days Until Due</th>
                      <th className="amount-cell">Expected Amount</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {upcoming.slice(0, 15).map((inst) => {
                      const daysUntil = differenceInDays(todayStr, inst.due_date)
                      return (
                        <tr key={inst.id}>
                          <td className="primary-cell">
                            {inst.loan ? (
                              <Link to={`/borrower/${inst.loan.id}`} className="customer-link">
                                {inst.loan.customer_name}
                              </Link>
                            ) : (
                              'Unknown'
                            )}
                          </td>
                          <td>
                            <span className="source-badge">{inst.loan?.mode === 'D' ? 'Daily' : 'Weekly'}</span>
                          </td>
                          <td>{inst.due_date}</td>
                          <td>In {daysUntil} days</td>
                          <td className="amount-cell">{currency.format(inst.expected_amount)}</td>
                          <td>
                            <button
                              type="button"
                              className="secondary-button compact-button"
                              onClick={() => handleMarkPaid(inst)}
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
        </div>
      )}

      {showPayModal && selectedLoan && (
        <MarkPaidModal
          isOpen={showPayModal}
          loan={selectedLoan}
          installment={selectedInst}
          onClose={() => {
            setShowPayModal(false)
            setSelectedLoan(null)
            setSelectedInst(null)
          }}
          onSuccess={loadData}
        />
      )}
    </>
  )
}
