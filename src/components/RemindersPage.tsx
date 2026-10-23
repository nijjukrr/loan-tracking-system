import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { financeApi } from '../lib/financeApi'
import { differenceInDays, formatDateISO } from '../lib/financeLogic'
import type { DueReceivableEntry, Installment, Loan } from '../types'
import { MarkPaidModal } from './MarkPaidModal'

const currency = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })

export function RemindersPage() {
  const [installments, setInstallments] = useState<Array<Installment & { loan?: Loan }>>([])
  const [dues, setDues] = useState<DueReceivableEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState<'ALL' | 'DUE_TODAY' | 'OVERDUE' | 'RECEIVABLES' | 'UPCOMING'>('ALL')
  const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null)
  const [selectedInst, setSelectedInst] = useState<Installment | null>(null)
  const [showPayModal, setShowPayModal] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const loadData = () => {
    setLoading(true)
    setError('')
    Promise.all([
      financeApi.listInstallments(),
      financeApi.listDues(),
    ])
      .then(([instData, duesData]) => {
        setInstallments(instData)
        setDues(duesData)
      })
      .catch((err) => {
        console.error('Reminders load error:', err)
        setError(err instanceof Error ? err.message : 'Unable to load payment schedules.')
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadData()
  }, [])

  const todayStr = formatDateISO(new Date())

  // Installment Categories
  const dueToday = installments.filter((i) => i.due_date === todayStr && i.paid_amount < i.expected_amount)
  const dueTodayTotal = dueToday.reduce((sum, i) => sum + (i.expected_amount - i.paid_amount), 0)

  const overdue = installments
    .filter((i) => i.due_date < todayStr && i.paid_amount < i.expected_amount)
    .sort((a, b) => differenceInDays(a.due_date, todayStr) - differenceInDays(b.due_date, todayStr))
  const overdueTotal = overdue.reduce((sum, i) => sum + (i.expected_amount - i.paid_amount), 0)

  const upcoming = installments
    .filter((i) => i.due_date > todayStr && i.paid_amount < i.expected_amount)
    .sort((a, b) => a.due_date.localeCompare(b.due_date))
  const upcomingTotal = upcoming.reduce((sum, i) => sum + (i.expected_amount - i.paid_amount), 0)

  // Customer Dues / Receivables (from SEP&OCT ledger reference ₹12,000)
  const uncollectedDues = dues.filter((d) => d.remaining_amount > 0)
  const uncollectedDuesTotal = uncollectedDues.reduce((sum, d) => sum + d.remaining_amount, 0)

  const handleMarkPaid = (inst: Installment & { loan?: Loan }) => {
    if (inst.loan) {
      setSelectedLoan(inst.loan)
      setSelectedInst(inst)
      setShowPayModal(true)
    }
  }

  const handleSettleDue = async (due: DueReceivableEntry) => {
    const amountStr = window.prompt(
      `Enter amount to settle for ${due.borrower_name} (Remaining Due: ${currency.format(due.remaining_amount)}):`,
      String(due.remaining_amount)
    )
    if (!amountStr) return
    const amt = Number(amountStr)
    if (isNaN(amt) || amt <= 0) return
    try {
      await financeApi.settleDue(due.id, amt)
      loadData()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Unable to record settlement.')
    }
  }

  const copyReminder = (id: string, name: string, amount: number, dueDate: string) => {
    const text = `Hi ${name}, this is a gentle reminder from Nijju Finance regarding your payment of ${currency.format(amount)} due on ${dueDate}. Kindly arrange payment at your earliest convenience. Thank you!`
    void navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 2500)
    })
  }

  return (
    <div className="page-shell">
      <header className="page-header">
        <div>
          <h1 className="page-title">Reminders & Dues Management</h1>
          <p className="page-subtitle">
            Collection schedules, overdue installments, and workbook receivables (₹12,000 target).
          </p>
        </div>
      </header>

      {error && <div className="form-message error-message" style={{ marginBottom: '1rem' }}>{error}</div>}

      {/* KPI Summary Cards */}
      <div className="kpi-grid" style={{ marginBottom: '1.5rem' }}>
        <div className="card kpi-card" onClick={() => setActiveTab('DUE_TODAY')} style={{ cursor: 'pointer' }}>
          <span className="kpi-label">Due Today</span>
          <strong className="kpi-value text-gold">{currency.format(dueTodayTotal)}</strong>
          <span className="kpi-subtext">{dueToday.length} payments due on {todayStr}</span>
        </div>

        <div className="card kpi-card" onClick={() => setActiveTab('OVERDUE')} style={{ cursor: 'pointer' }}>
          <span className="kpi-label">Overdue Installments</span>
          <strong className="kpi-value text-danger">{currency.format(overdueTotal)}</strong>
          <span className="kpi-subtext">{overdue.length} accounts past due</span>
        </div>

        <div className="card kpi-card" onClick={() => setActiveTab('RECEIVABLES')} style={{ cursor: 'pointer', borderLeft: '4px solid var(--danger)' }}>
          <span className="kpi-label">Customer Dues (Receivable)</span>
          <strong className="kpi-value text-danger">{currency.format(uncollectedDuesTotal)}</strong>
          <span className="kpi-subtext">{uncollectedDues.length} ledger dues (target: ₹12,000)</span>
        </div>

        <div className="card kpi-card" onClick={() => setActiveTab('UPCOMING')} style={{ cursor: 'pointer' }}>
          <span className="kpi-label">Upcoming Cycles</span>
          <strong className="kpi-value">{currency.format(upcomingTotal)}</strong>
          <span className="kpi-subtext">{upcoming.length} scheduled installments</span>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="radio-tabs" style={{ marginBottom: '1.5rem', width: 'fit-content' }}>
        <button
          type="button"
          className={`tab-btn ${activeTab === 'ALL' ? 'active' : ''}`}
          onClick={() => setActiveTab('ALL')}
        >
          All Collections ({dueToday.length + overdue.length + uncollectedDues.length + upcoming.length})
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === 'DUE_TODAY' ? 'active' : ''}`}
          onClick={() => setActiveTab('DUE_TODAY')}
        >
          Due Today ({dueToday.length})
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === 'OVERDUE' ? 'active' : ''}`}
          onClick={() => setActiveTab('OVERDUE')}
        >
          Overdue ({overdue.length})
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === 'RECEIVABLES' ? 'active' : ''}`}
          onClick={() => setActiveTab('RECEIVABLES')}
        >
          Customer Dues ({uncollectedDues.length})
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === 'UPCOMING' ? 'active' : ''}`}
          onClick={() => setActiveTab('UPCOMING')}
        >
          Upcoming ({upcoming.length})
        </button>
      </div>

      {loading ? (
        <div className="card loading-state">Loading reminder schedules…</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Section: Customer Dues / Receivables */}
          {(activeTab === 'ALL' || activeTab === 'RECEIVABLES') && (
            <section className="card" style={{ borderLeft: '4px solid #ef4444' }}>
              <div className="card-header" style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h2 style={{ fontSize: '1.125rem', margin: 0, fontWeight: 700 }}>
                    Customer Ledger Dues ({uncollectedDues.length})
                  </h2>
                  <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--muted)' }}>
                    Workbook reported dues (Ajith, Shanthi, Divya) totaling ₹12,000 receivable.
                  </p>
                </div>
                <strong style={{ fontSize: '1rem', color: 'var(--danger)' }}>
                  Total: {currency.format(uncollectedDuesTotal)}
                </strong>
              </div>

              {uncollectedDues.length === 0 ? (
                <p style={{ margin: 0, color: 'var(--muted)', fontSize: '0.875rem' }}>
                  No outstanding customer dues recorded.
                </p>
              ) : (
                <div className="table-responsive">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Borrower</th>
                        <th>Due Date</th>
                        <th style={{ textAlign: 'right' }}>Original Due</th>
                        <th style={{ textAlign: 'right' }}>Settled</th>
                        <th style={{ textAlign: 'right' }}>Remaining Due</th>
                        <th style={{ textAlign: 'center' }}>Status</th>
                        <th>Notes / Remarks</th>
                        <th style={{ textAlign: 'center' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {uncollectedDues.map((d) => (
                        <tr key={d.id}>
                          <td style={{ fontWeight: 600 }}>{d.borrower_name}</td>
                          <td>{d.due_date}</td>
                          <td style={{ textAlign: 'right' }}>{currency.format(d.amount)}</td>
                          <td style={{ textAlign: 'right', color: 'var(--positive)' }}>
                            {currency.format(d.settled_amount || 0)}
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--danger)' }}>
                            {currency.format(d.remaining_amount)}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <span className="pill pill-red">{d.status.toUpperCase()}</span>
                          </td>
                          <td style={{ fontSize: '0.8125rem', color: 'var(--muted)' }}>{d.notes || '—'}</td>
                          <td style={{ textAlign: 'center' }}>
                            <div style={{ display: 'flex', gap: '0.375rem', justifyContent: 'center' }}>
                              <button
                                type="button"
                                className="button-secondary"
                                style={{ padding: '3px 8px', fontSize: '0.75rem' }}
                                onClick={() => handleSettleDue(d)}
                              >
                                Settle Due
                              </button>
                              <button
                                type="button"
                                className="button-secondary"
                                style={{ padding: '3px 8px', fontSize: '0.75rem' }}
                                onClick={() => copyReminder(d.id, d.borrower_name, d.remaining_amount, d.due_date)}
                              >
                                {copiedId === d.id ? '✓ Copied' : '📋 Copy Text'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}

          {/* Section: Due Today */}
          {(activeTab === 'ALL' || activeTab === 'DUE_TODAY') && (
            <section className="card">
              <div className="card-header" style={{ marginBottom: '1rem' }}>
                <h2 style={{ fontSize: '1.125rem', margin: 0, fontWeight: 700 }}>
                  Due Today ({dueToday.length})
                </h2>
                <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--muted)' }}>
                  Installment collections due today ({todayStr}).
                </p>
              </div>

              {dueToday.length === 0 ? (
                <p style={{ margin: 0, color: 'var(--muted)', fontSize: '0.875rem' }}>
                  No installment payments due today.
                </p>
              ) : (
                <div className="table-responsive">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Person Name</th>
                        <th>Mode</th>
                        <th style={{ textAlign: 'right' }}>Principal</th>
                        <th style={{ textAlign: 'right' }}>Amount Due</th>
                        <th>Due Date</th>
                        <th style={{ textAlign: 'center' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dueToday.map((inst) => (
                        <tr key={inst.id}>
                          <td style={{ fontWeight: 600 }}>
                            {inst.loan ? (
                              <Link to={`/borrower/${inst.loan.id}`} style={{ color: 'var(--ink)' }}>
                                {inst.loan.customer_name}
                              </Link>
                            ) : (
                              'Unknown'
                            )}
                          </td>
                          <td>
                            <span className="source-badge">{inst.loan?.mode === 'D' ? 'Daily' : 'Weekly'}</span>
                          </td>
                          <td style={{ textAlign: 'right' }}>{currency.format(inst.loan?.principal || 0)}</td>
                          <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--warning)' }}>
                            {currency.format(inst.expected_amount - inst.paid_amount)}
                          </td>
                          <td>
                            <span className="pill pill-gold">{inst.due_date}</span>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <div style={{ display: 'flex', gap: '0.375rem', justifyContent: 'center' }}>
                              <button
                                type="button"
                                className="primary-button compact-button"
                                onClick={() => handleMarkPaid(inst)}
                              >
                                Mark Paid
                              </button>
                              <button
                                type="button"
                                className="button-secondary"
                                style={{ padding: '3px 8px', fontSize: '0.75rem' }}
                                onClick={() =>
                                  copyReminder(
                                    inst.id,
                                    inst.loan?.customer_name || 'Borrower',
                                    inst.expected_amount - inst.paid_amount,
                                    inst.due_date
                                  )
                                }
                              >
                                {copiedId === inst.id ? '✓ Copied' : '📋 Copy Text'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}

          {/* Section: Overdue */}
          {(activeTab === 'ALL' || activeTab === 'OVERDUE') && (
            <section className="card">
              <div className="card-header" style={{ marginBottom: '1rem' }}>
                <h2 style={{ fontSize: '1.125rem', margin: 0, fontWeight: 700, color: 'var(--danger)' }}>
                  Overdue Installments ({overdue.length})
                </h2>
                <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--muted)' }}>
                  Sorted with longest past-due accounts first.
                </p>
              </div>

              {overdue.length === 0 ? (
                <p style={{ margin: 0, color: 'var(--muted)', fontSize: '0.875rem' }}>
                  No overdue installments. All loans are fully up to date!
                </p>
              ) : (
                <div className="table-responsive">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Person Name</th>
                        <th>Mode</th>
                        <th>Original Due Date</th>
                        <th style={{ textAlign: 'center' }}>Days Overdue</th>
                        <th style={{ textAlign: 'right' }}>Amount Due</th>
                        <th style={{ textAlign: 'right' }}>Principal</th>
                        <th>Last Payment</th>
                        <th style={{ textAlign: 'center' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {overdue.map((inst) => {
                        const daysOverdue = differenceInDays(inst.due_date, todayStr)
                        return (
                          <tr key={inst.id}>
                            <td style={{ fontWeight: 600 }}>
                              {inst.loan ? (
                                <Link to={`/borrower/${inst.loan.id}`} style={{ color: 'var(--ink)' }}>
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
                            <td style={{ textAlign: 'center' }}>
                              <span className="pill pill-red">+{daysOverdue} days</span>
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--danger)' }}>
                              {currency.format(inst.expected_amount - inst.paid_amount)}
                            </td>
                            <td style={{ textAlign: 'right' }}>{currency.format(inst.loan?.principal || 0)}</td>
                            <td style={{ fontSize: '0.8125rem', color: 'var(--muted)' }}>
                              {inst.paid_date || 'No payment yet'}
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <div style={{ display: 'flex', gap: '0.375rem', justifyContent: 'center' }}>
                                <button
                                  type="button"
                                  className="button-secondary"
                                  style={{ padding: '3px 8px', fontSize: '0.75rem' }}
                                  onClick={() => handleMarkPaid(inst)}
                                >
                                  Mark Paid
                                </button>
                                <button
                                  type="button"
                                  className="button-secondary"
                                  style={{ padding: '3px 8px', fontSize: '0.75rem' }}
                                  onClick={() =>
                                    copyReminder(
                                      inst.id,
                                      inst.loan?.customer_name || 'Borrower',
                                      inst.expected_amount - inst.paid_amount,
                                      inst.due_date
                                    )
                                  }
                                >
                                  {copiedId === inst.id ? '✓ Copied' : '📋 Copy'}
                                </button>
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
          )}

          {/* Section: Upcoming */}
          {(activeTab === 'ALL' || activeTab === 'UPCOMING') && (
            <section className="card">
              <div className="card-header" style={{ marginBottom: '1rem' }}>
                <h2 style={{ fontSize: '1.125rem', margin: 0, fontWeight: 700 }}>
                  Upcoming Schedules ({upcoming.length})
                </h2>
                <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--muted)' }}>
                  Future installment collection obligations.
                </p>
              </div>

              {upcoming.length === 0 ? (
                <p style={{ margin: 0, color: 'var(--muted)', fontSize: '0.875rem' }}>
                  No upcoming payments scheduled.
                </p>
              ) : (
                <div className="table-responsive">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Person Name</th>
                        <th>Mode</th>
                        <th>Due Date</th>
                        <th style={{ textAlign: 'center' }}>Timeline</th>
                        <th style={{ textAlign: 'right' }}>Expected Amount</th>
                        <th style={{ textAlign: 'center' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {upcoming.slice(0, 20).map((inst) => {
                        const daysUntil = differenceInDays(todayStr, inst.due_date)
                        return (
                          <tr key={inst.id}>
                            <td style={{ fontWeight: 600 }}>
                              {inst.loan ? (
                                <Link to={`/borrower/${inst.loan.id}`} style={{ color: 'var(--ink)' }}>
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
                            <td style={{ textAlign: 'center' }}>
                              <span className="pill pill-gray">In {daysUntil} days</span>
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: 600 }}>{currency.format(inst.expected_amount)}</td>
                            <td style={{ textAlign: 'center' }}>
                              <button
                                type="button"
                                className="button-secondary"
                                style={{ padding: '3px 8px', fontSize: '0.75rem' }}
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
          )}
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
    </div>
  )
}
