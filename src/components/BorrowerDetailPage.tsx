import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { financeApi } from '../lib/financeApi'
import { calculateNextDueDate } from '../lib/financeLogic'
import type { DueReceivableEntry, Installment, Loan, Payment } from '../types'
import { MarkPaidModal } from './MarkPaidModal'

const currency = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })

export function BorrowerDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [loan, setLoan] = useState<Loan | null>(null)
  const [installments, setInstallments] = useState<Installment[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [relatedLoans, setRelatedLoans] = useState<Loan[]>([])
  const [relatedDues, setRelatedDues] = useState<DueReceivableEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showPayModal, setShowPayModal] = useState(false)
  const [selectedInst, setSelectedInst] = useState<Installment | null>(null)

  const loadData = useCallback(() => {
    if (!id) return
    setLoading(true)
    financeApi
      .getLoanDetail(id)
      .then(async (res) => {
        if (res) {
          setLoan(res.loan)
          setInstallments(res.installments)
          setPayments(res.payments)
          try {
            const [allLoans, allDues] = await Promise.all([
              financeApi.listLoans(),
              financeApi.listDues(),
            ])
            const other = allLoans.filter(
              (l) => l.customer_name.toLowerCase() === res.loan.customer_name.toLowerCase() && l.id !== res.loan.id
            )
            const dues = allDues.filter(
              (d) => d.borrower_name.toLowerCase() === res.loan.customer_name.toLowerCase()
            )
            setRelatedLoans(other)
            setRelatedDues(dues)
          } catch {
            // Non-fatal
          }
        } else {
          setError('Borrower account not found.')
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Unable to load borrower details.'))
      .finally(() => setLoading(false))
  }, [id])

  useEffect(() => {
    loadData()
  }, [loadData])

  async function handleCloseAccount() {
    if (!loan) return
    const reason = window.prompt(`Enter closure remarks for ${loan.customer_name} (e.g. Settled in full):`, 'Settled in full')
    if (reason === null) return // cancelled
    try {
      await financeApi.closeLoan(loan.id, reason)
      loadData()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to close account.')
    }
  }

  async function handleDeleteAccount() {
    if (!loan) return
    const confirmed = window.confirm(`Permanently delete ${loan.customer_name}'s ${loan.mode === 'D' ? 'Daily' : 'Weekly'} account, including its schedule and payment history? This cannot be undone.`)
    if (!confirmed) return
    try {
      await financeApi.deleteLoan(loan.id)
      navigate(loan.mode === 'D' ? '/daily' : '/weekly', { replace: true })
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Unable to delete account.')
    }
  }

  async function handleSettleDue(dueId: string, remaining: number) {
    const amountStr = window.prompt(`Enter amount to settle for this due (Remaining: ₹${remaining.toLocaleString('en-IN')}):`, String(remaining))
    if (!amountStr) return
    const amt = Number(amountStr)
    if (isNaN(amt) || amt <= 0) return
    try {
      await financeApi.settleDue(dueId, amt)
      loadData()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to settle due')
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

  const latestPaid = payments[0]?.payment_date || loan.loan_date
  const nextDueDate = loan.status === 'closed' ? 'Closed' : calculateNextDueDate(loan.mode, latestPaid)

  const interestReceived = payments
    .filter((p) => p.payment_type === 'Interest')
    .reduce((sum, p) => sum + p.amount, 0)

  const weeklyReceived = payments
    .filter((p) => p.payment_type === 'Weekly Installment' || p.payment_type === 'Partial')
    .reduce((sum, p) => sum + p.amount, 0)

  const principalCollected = payments
    .filter((p) => p.payment_type === 'Principal')
    .reduce((sum, p) => sum + p.amount, 0)

  const accountProfit = loan.mode === 'D'
    ? interestReceived
    : loan.status === 'closed' ? Math.max(0, loan.total_expected - loan.principal) : 0

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
          <p className="page-description">{loan.mode === 'D' ? 'Daily Loan (10-Day Cycle)' : 'Weekly Loan (10 Weeks)'}</p>
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
          <button type="button" className="danger-button" onClick={handleDeleteAccount}>
            Delete Account
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
          <span>Next Due Date</span>
          <strong>{nextDueDate}</strong>
          <small>Rule: Paid Date + {loan.mode === 'D' ? '10d' : '7d'}</small>
        </div>

        <div className="metric-card">
          <span>Profit From This Account</span>
          <strong className="text-success">{loan.mode === 'W' && loan.status === 'active' ? 'Pending' : currency.format(accountProfit)}</strong>
        </div>
      </section>

      {/* Breakdown Card */}
      <section className="detail-info-card">
        <h3>Borrower Account Summary</h3>
        <div className="info-grid">
          <div>
            <span>Person Name</span>
            <strong>{loan.customer_name}</strong>
          </div>
          <div>
            <span>Loan Type</span>
            <strong>{loan.mode === 'D' ? 'Daily (10-Day Cycle)' : 'Weekly (10 Weeks)'}</strong>
          </div>
          <div>
            <span>{loan.mode === 'D' ? 'Interest Received' : 'Weekly Payments Received'}</span>
            <strong>{currency.format(loan.mode === 'D' ? interestReceived : weeklyReceived)}</strong>
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

      {/* Other Accounts for this Borrower */}
      {relatedLoans.length > 0 && (
        <section className="table-card" style={{ marginTop: '1.5rem' }}>
          <div className="table-heading">
            <div>
              <h2>Other Accounts for {loan.customer_name} ({relatedLoans.length})</h2>
              <p>Borrower portfolio holding multiple loan accounts</p>
            </div>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Account #</th>
                  <th>Mode</th>
                  <th>Loan Date</th>
                  <th className="amount-cell">Principal</th>
                  <th className="amount-cell">Remaining</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {relatedLoans.map((rl) => (
                  <tr key={rl.id}>
                    <td>#{rl.main_sheet_no}</td>
                    <td>{rl.mode === 'D' ? 'Daily (10-Day)' : 'Weekly (10-Wk)'}</td>
                    <td>{rl.loan_date}</td>
                    <td className="amount-cell">{currency.format(rl.principal)}</td>
                    <td className="amount-cell" style={{ color: rl.remaining_balance > 0 ? 'var(--warning)' : 'inherit' }}>
                      {currency.format(rl.remaining_balance)}
                    </td>
                    <td>
                      <span className={`pill ${rl.status === 'active' ? 'pill-green' : 'pill-gray'}`}>
                        {rl.status === 'active' ? 'Active' : 'Closed'}
                      </span>
                    </td>
                    <td>
                      <Link to={`/borrower/${rl.id}`} className="button-secondary" style={{ padding: '3px 8px', fontSize: '0.75rem' }}>
                        Open Account →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Linked Unpaid Dues / Receivables */}
      {relatedDues.length > 0 && (
        <section className="table-card" style={{ marginTop: '1.5rem', borderLeft: '4px solid var(--danger)' }}>
          <div className="table-heading">
            <div>
              <h2 style={{ color: 'var(--danger)' }}>Linked Customer Dues ({relatedDues.length})</h2>
              <p>Uncollected dues / receivables linked to {loan.customer_name}</p>
            </div>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Due Date</th>
                  <th className="amount-cell">Original Due</th>
                  <th className="amount-cell">Remaining Due</th>
                  <th>Status</th>
                  <th>Notes</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {relatedDues.map((due) => (
                  <tr key={due.id}>
                    <td>{due.due_date}</td>
                    <td className="amount-cell">{currency.format(due.amount)}</td>
                    <td className="amount-cell" style={{ color: 'var(--danger)', fontWeight: 700 }}>
                      {currency.format(due.remaining_amount)}
                    </td>
                    <td>
                      <span className={`pill ${due.status === 'settled' ? 'pill-green' : due.status === 'partial' ? 'pill-gold' : 'pill-red'}`}>
                        {due.status.toUpperCase()}
                      </span>
                    </td>
                    <td>{due.notes || '—'}</td>
                    <td>
                      {due.remaining_amount > 0 && (
                        <button
                          type="button"
                          className="button-secondary"
                          style={{ padding: '3px 8px', fontSize: '0.75rem' }}
                          onClick={() => handleSettleDue(due.id, due.remaining_amount)}
                        >
                          Settle Due
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

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
