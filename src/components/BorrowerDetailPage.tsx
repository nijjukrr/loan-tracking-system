import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { financeApi } from '../lib/financeApi'
import { calculateNextDueDate, differenceInDays, formatDateISO } from '../lib/financeLogic'
import type { Installment, Loan, Payment } from '../types'
import { MarkPaidModal } from './MarkPaidModal'

const currency = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })

export function BorrowerDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [loan, setLoan] = useState<Loan | null>(null)
  const [installments, setInstallments] = useState<Installment[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showPayModal, setShowPayModal] = useState(false)
  const [selectedInst, setSelectedInst] = useState<Installment | null>(null)

  const loadData = () => {
    if (!id) return
    setLoading(true)
    financeApi
      .getLoanDetail(id)
      .then((res) => {
        if (res) {
          setLoan(res.loan)
          setInstallments(res.installments)
          setPayments(res.payments)
        } else {
          setError('Borrower account not found.')
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Unable to load borrower details.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadData()
  }, [id])

  async function handleCloseAccount() {
    if (!loan) return
    if (!window.confirm(`Are you sure you want to close account for ${loan.customer_name} (Main Sheet #${loan.main_sheet_no})?`)) return
    try {
      await financeApi.closeLoan(loan.id)
      loadData()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to close account.')
    }
  }

  if (loading) return <div className="loading-screen">Loading borrower detail…</div>
  if (error || !loan) {
    return (
      <div className="empty-state">
        <h2>Account Not Found</h2>
        <p>{error || 'The requested loan record does not exist.'}</p>
        <Link to="/daily" className="primary-button">
          Back to Loans
        </Link>
      </div>
    )
  }

  const todayStr = formatDateISO(new Date())
  const loanAge = differenceInDays(loan.loan_date, todayStr)

  const latestPaid = payments[0]?.payment_date || loan.loan_date
  const nextDueDate = loan.status === 'closed' ? 'Closed' : calculateNextDueDate(loan.mode, latestPaid)

  const interestCollected = payments
    .filter((p) => p.payment_type === 'Interest' || p.payment_type === 'Weekly Installment' || p.payment_type === 'Partial')
    .reduce((sum, p) => sum + p.amount, 0)

  const principalCollected = payments
    .filter((p) => p.payment_type === 'Principal')
    .reduce((sum, p) => sum + p.amount, 0)

  const realizedProfit = loan.mode === 'D' ? interestCollected : Math.max(0, loan.total_collected - loan.principal)

  return (
    <>
      <header className="page-header">
        <div>
          <div className="breadcrumb">
            <Link to={loan.mode === 'D' ? '/daily' : '/weekly'}>
              ← Back to {loan.mode === 'D' ? 'Daily' : 'Weekly'} Loans
            </Link>
          </div>
          <h1>{loan.customer_name}</h1>
          <p className="page-description">
            Main Sheet #{loan.main_sheet_no} · {loan.mode === 'D' ? 'Daily Loan (10-Day Cycle)' : 'Weekly Loan (10 Weeks)'}
          </p>
        </div>
        <div className="header-actions">
          {loan.status === 'active' && (
            <button type="button" className="secondary-button" onClick={handleCloseAccount}>
              Close Account
            </button>
          )}
          <button
            type="button"
            className="primary-button"
            onClick={() => {
              setSelectedInst(null)
              setShowPayModal(true)
            }}
          >
            + Add Payment / Mark Paid
          </button>
        </div>
      </header>

      {/* Metrics Grid */}
      <section className="metrics-grid">
        <div className="metric-card">
          <span>Principal Amount</span>
          <strong>{currency.format(loan.principal)}</strong>
          <small>Loan Date: {loan.loan_date}</small>
        </div>

        <div className="metric-card">
          <span>{loan.mode === 'D' ? '10-Day Interest' : 'Weekly Payment'}</span>
          <strong>
            {currency.format(loan.mode === 'D' ? loan.interest_amount : loan.weekly_payment)}
          </strong>
          <small>{loan.mode === 'D' ? 'Per 10 days' : 'Per week'}</small>
        </div>

        <div className="metric-card">
          <span>Total Collected</span>
          <strong>{currency.format(loan.total_collected)}</strong>
          <small>Expected: {currency.format(loan.total_expected)}</small>
        </div>

        <div className="metric-card">
          <span>Remaining Balance</span>
          <strong className="text-highlight">{currency.format(loan.remaining_balance)}</strong>
          <small>Status: {loan.status.toUpperCase()}</small>
        </div>

        <div className="metric-card">
          <span>Next Due Date</span>
          <strong>{nextDueDate}</strong>
          <small>Rule: Paid Date + {loan.mode === 'D' ? '10d' : '7d'}</small>
        </div>

        <div className="metric-card">
          <span>Realized Profit</span>
          <strong className="text-success">{currency.format(realizedProfit)}</strong>
          <small>Loan Age: {loanAge} days</small>
        </div>
      </section>

      {/* Breakdown Card */}
      <section className="detail-info-card">
        <h3>Borrower Account Summary</h3>
        <div className="info-grid">
          <div>
            <span>Customer Name</span>
            <strong>{loan.customer_name}</strong>
          </div>
          <div>
            <span>Main Sheet No</span>
            <strong>#{loan.main_sheet_no}</strong>
          </div>
          <div>
            <span>Loan Type</span>
            <strong>{loan.mode === 'D' ? 'Daily (10-Day Cycle)' : 'Weekly (10 Weeks)'}</strong>
          </div>
          <div>
            <span>Interest Collected</span>
            <strong>{currency.format(interestCollected)}</strong>
          </div>
          <div>
            <span>Principal Collected</span>
            <strong>{currency.format(principalCollected)}</strong>
          </div>
          <div>
            <span>Remarks / Notes</span>
            <strong>{loan.source_remarks || '—'}</strong>
          </div>
        </div>
      </section>

      {/* Installment Timeline */}
      <section className="table-card">
        <div className="table-heading">
          <div>
            <h2>Repayment Schedule & Cycles</h2>
            <p>
              {loan.mode === 'D'
                ? '6 10-day interest cycles (up to 60 days)'
                : '10 weekly installment schedule'}
            </p>
          </div>
        </div>

        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>{loan.mode === 'D' ? 'Cycle #' : 'Week #'}</th>
                <th>Due Date</th>
                <th className="amount-cell">Expected Amount</th>
                <th>Paid Date</th>
                <th className="amount-cell">Paid Amount</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {installments.map((inst) => (
                <tr key={inst.id}>
                  <td>
                    <strong>
                      {loan.mode === 'D' ? `Day ${inst.installment_number * 10}` : `Week ${inst.installment_number}`}
                    </strong>
                  </td>
                  <td>{inst.due_date}</td>
                  <td className="amount-cell">{currency.format(inst.expected_amount)}</td>
                  <td>{inst.paid_date || '—'}</td>
                  <td className="amount-cell">{currency.format(inst.paid_amount)}</td>
                  <td>
                    <span className={`status-badge ${inst.status.toLowerCase().replace(' ', '-')}`}>
                      {inst.status}
                    </span>
                  </td>
                  <td>
                    {inst.status !== 'Paid' && (
                      <button
                        type="button"
                        className="secondary-button compact-button"
                        onClick={() => {
                          setSelectedInst(inst)
                          setShowPayModal(true)
                        }}
                      >
                        Mark Paid
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Payment History */}
      <section className="table-card">
        <div className="table-heading">
          <div>
            <h2>Payment History ({payments.length})</h2>
            <p>Complete record of transactions for this loan</p>
          </div>
        </div>

        {payments.length === 0 ? (
          <div className="empty-state">No payments recorded yet for this loan.</div>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Payment Date</th>
                  <th>Payment Type</th>
                  <th className="amount-cell">Amount</th>
                  <th>Note / Remarks</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((pay) => (
                  <tr key={pay.id}>
                    <td>{pay.payment_date}</td>
                    <td>
                      <span className="source-badge">{pay.payment_type}</span>
                    </td>
                    <td className="amount-cell primary-cell">{currency.format(pay.amount)}</td>
                    <td>{pay.note || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {showPayModal && (
        <MarkPaidModal
          isOpen={showPayModal}
          loan={loan}
          installment={selectedInst}
          onClose={() => {
            setShowPayModal(false)
            setSelectedInst(null)
          }}
          onSuccess={loadData}
        />
      )}
    </>
  )
}
