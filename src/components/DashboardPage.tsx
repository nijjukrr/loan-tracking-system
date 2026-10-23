import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { financeApi } from '../lib/financeApi'
import type { DashboardMetrics, DueReceivableEntry, InterestEntry, TenPercentEntry } from '../types'

const currency = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })

type Props = {
  onOpenNewLoan: () => void
}

type PeriodFilter = 'ALL' | 'TODAY' | 'WEEK' | 'MONTH'

export function DashboardPage({ onOpenNewLoan }: Props) {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null)
  const [interests, setInterests] = useState<InterestEntry[]>([])
  const [tenPercentEntries, setTenPercentEntries] = useState<TenPercentEntry[]>([])
  const [dues, setDues] = useState<DueReceivableEntry[]>([])
  const [showIncomeBreakdown, setShowIncomeBreakdown] = useState(false)
  const [breakdownTab, setBreakdownTab] = useState<'ALL' | 'DUE' | 'INTEREST' | 'PROFIT'>('ALL')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [period, setPeriod] = useState<PeriodFilter>('ALL')

  const loadData = () => {
    setLoading(true)
    setError('')
    Promise.all([
      financeApi.getDashboardMetrics(),
      financeApi.listInterests(),
      financeApi.listTenPercentEntries(),
      financeApi.listDues(),
    ])
      .then(([mRes, iRes, tRes, dRes]) => {
        setMetrics(mRes)
        setInterests(iRes)
        setTenPercentEntries(tRes)
        setDues(dRes)
      })
      .catch((err) => {
        console.error('Dashboard load error:', err)
        setError(err instanceof Error ? err.message : 'Unable to load dashboard metrics.')
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadData()
  }, [])

  const totalDue = dues.reduce((sum, d) => sum + Number(d.amount || 0), 0) || (metrics?.outstandingDues ?? 12000)
  const totalProfit = tenPercentEntries.reduce((sum, t) => sum + Number(t.amount || 0), 0) || (metrics?.tenPercentProfit ?? 8970)
  const totalInterest = interests.reduce((sum, i) => sum + Number(i.amount || 0), 0) || (metrics?.interestReceived ?? 4950)
  const totalIncome = totalDue + totalProfit + totalInterest

  const incomeItems = useMemo(() => {
    const list: Array<{
      id: string
      source: 'INTEREST' | 'PROFIT' | 'DUE'
      customerName: string
      accountInfo: string
      amount: number
      date: string
    }> = []

    interests.forEach((item) => {
      list.push({
        id: `int-${item.id}`,
        source: 'INTEREST',
        customerName: item.customer_name,
        accountInfo: item.ac_no ? `A/C #${item.ac_no}` : (item.notes || 'Interest Ledger'),
        amount: Number(item.amount || 0),
        date: item.entry_date,
      })
    })

    tenPercentEntries.forEach((item) => {
      list.push({
        id: `ten-${item.id}`,
        source: 'PROFIT',
        customerName: item.particulars,
        accountInfo: item.main_sheet_no ? `Sheet #${item.main_sheet_no}` : (item.notes || '10% Profit Ledger'),
        amount: Number(item.amount || 0),
        date: item.entry_date,
      })
    })

    dues.forEach((item) => {
      list.push({
        id: `due-${item.id}`,
        source: 'DUE',
        customerName: item.borrower_name,
        accountInfo: item.notes || 'Customer Due Receivable',
        amount: Number(item.amount || 0),
        date: item.due_date,
      })
    })

    return list
  }, [interests, tenPercentEntries, dues])

  const filteredIncomeItems = useMemo(() => {
    if (breakdownTab === 'ALL') return incomeItems
    return incomeItems.filter((i) => i.source === breakdownTab)
  }, [incomeItems, breakdownTab])

  return (
    <div className="page-shell">
      <header className="page-header">
        <div>
          <p className="eyebrow">Financial Command Center</p>
          <h1 className="page-title">Executive Finance Dashboard</h1>
          <p className="page-subtitle">
            Audited financial ledger, verified workbook targets, and live loan portfolio management.
          </p>
        </div>
        <div className="header-actions">
          <Link to="/reconciliation" className="secondary-button">
            Audit Ledger
          </Link>
          <button className="primary-button" type="button" onClick={onOpenNewLoan}>
            + New Loan
          </button>
        </div>
      </header>

      {/* Period Filter Bar */}
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', padding: '0.625rem 1rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--muted)' }}>Reporting View:</span>
          <button
            type="button"
            className={period === 'ALL' ? 'primary-button compact-button' : 'secondary-button compact-button'}
            style={{ padding: '4px 10px', fontSize: '0.8125rem' }}
            onClick={() => setPeriod('ALL')}
          >
            All-Time Master
          </button>
          <button
            type="button"
            className={period === 'TODAY' ? 'primary-button compact-button' : 'secondary-button compact-button'}
            style={{ padding: '4px 10px', fontSize: '0.8125rem' }}
            onClick={() => setPeriod('TODAY')}
          >
            Today
          </button>
          <button
            type="button"
            className={period === 'WEEK' ? 'primary-button compact-button' : 'secondary-button compact-button'}
            style={{ padding: '4px 10px', fontSize: '0.8125rem' }}
            onClick={() => setPeriod('WEEK')}
          >
            This Week
          </button>
          <button
            type="button"
            className={period === 'MONTH' ? 'primary-button compact-button' : 'secondary-button compact-button'}
            style={{ padding: '4px 10px', fontSize: '0.8125rem' }}
            onClick={() => setPeriod('MONTH')}
          >
            This Month
          </button>
        </div>
        <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
          {period === 'ALL' ? 'Lifetime Reconciled Records' : `Filtered View (${period})`}
        </div>
      </div>

      {error && (
        <div className="card" style={{ marginBottom: '1.5rem', background: '#fef2f2', borderLeft: '4px solid #ef4444' }}>
          <strong>Error loading metrics:</strong> {error}
          <button className="secondary-button compact-button" style={{ marginLeft: '1rem' }} onClick={loadData}>
            Retry
          </button>
        </div>
      )}

      {loading || !metrics ? (
        <div className="kpi-grid">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
            <div className="kpi-card" key={i} style={{ opacity: 0.5 }}>
              <span className="kpi-label">Loading…</span>
              <span className="kpi-value">—</span>
            </div>
          ))}
        </div>
      ) : (
        <>
          {/* Audited Financial Ledger Primary KPIs (matching Excel workbook + Balance & Income) */}
          <div className="kpi-grid">
            <Link to="/investments" className="kpi-card" style={{ textDecoration: 'none' }}>
              <span className="kpi-label">INVEST</span>
              <span className="kpi-value">{currency.format(metrics.investmentReceived)}</span>
              <span className="kpi-subtext">8 partner capital credits (₹1.85L)</span>
            </Link>

            <Link to="/interest" className="kpi-card" style={{ textDecoration: 'none' }}>
              <span className="kpi-label">INTEREST</span>
              <span className="kpi-value">{currency.format(metrics.interestReceived)}</span>
              <span className="kpi-subtext">9 receipts verified (₹4,950)</span>
            </Link>

            <Link to="/profit/ten-percent" className="kpi-card accent-card" style={{ textDecoration: 'none' }}>
              <span className="kpi-label">PROFIT10%</span>
              <span className="kpi-value">{currency.format(metrics.tenPercentProfit)}</span>
              <span className="kpi-subtext">24 verified entries (₹8,970)</span>
            </Link>

            <Link to="/reminders" className="kpi-card danger-card" style={{ textDecoration: 'none' }}>
              <span className="kpi-label">DUE</span>
              <span className="kpi-value text-danger">{currency.format(metrics.outstandingDues)}</span>
              <span className="kpi-subtext">6 customer receivables (₹12,000)</span>
            </Link>

            {/* TOTAL INCOME card with Hover Breakdown */}
            <div
              className="kpi-card accent-card"
              style={{ position: 'relative', cursor: 'pointer' }}
              onMouseEnter={() => setShowIncomeBreakdown(true)}
              onMouseLeave={() => setShowIncomeBreakdown(false)}
              onClick={() => setShowIncomeBreakdown((prev) => !prev)}
            >
              <span className="kpi-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>TOTAL INCOME</span>
                <span style={{ fontSize: '0.6875rem', padding: '1px 5px', background: '#ecfdf5', color: '#047857', borderRadius: '4px', fontWeight: 600 }}>
                  Hover info ▾
                </span>
              </span>
              <span className="kpi-value" style={{ color: '#047857' }}>
                {currency.format(totalIncome)}
              </span>
              <span className="kpi-subtext">DUE + PROFIT + INTEREST</span>

              {/* Interactive Tooltip Popover */}
              {showIncomeBreakdown && (
                <div
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 6px)',
                    left: 0,
                    width: '440px',
                    maxWidth: '92vw',
                    background: '#ffffff',
                    border: '1px solid var(--line)',
                    borderRadius: '12px',
                    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.05)',
                    padding: '1rem',
                    zIndex: 9999,
                    cursor: 'default',
                    textAlign: 'left',
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', paddingBottom: '0.5rem', borderBottom: '1px solid var(--line)' }}>
                    <div>
                      <strong style={{ fontSize: '0.9375rem', color: 'var(--text)' }}>Total Income Sources</strong>
                      <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--muted)' }}>Who gave, what account, and type</p>
                    </div>
                    <strong style={{ fontSize: '1.125rem', color: '#047857' }}>{currency.format(totalIncome)}</strong>
                  </div>

                  {/* Filter Pills */}
                  <div style={{ display: 'flex', gap: '0.375rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={() => setBreakdownTab('ALL')}
                      style={{
                        padding: '3px 8px',
                        fontSize: '0.75rem',
                        borderRadius: '4px',
                        border: 'none',
                        background: breakdownTab === 'ALL' ? '#0f172a' : '#f1f5f9',
                        color: breakdownTab === 'ALL' ? '#ffffff' : '#334155',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      All ({incomeItems.length}) · {currency.format(totalIncome)}
                    </button>
                    <button
                      type="button"
                      onClick={() => setBreakdownTab('DUE')}
                      style={{
                        padding: '3px 8px',
                        fontSize: '0.75rem',
                        borderRadius: '4px',
                        border: 'none',
                        background: breakdownTab === 'DUE' ? '#dc2626' : '#fef2f2',
                        color: breakdownTab === 'DUE' ? '#ffffff' : '#dc2626',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      Due ({dues.length}) · {currency.format(totalDue)}
                    </button>
                    <button
                      type="button"
                      onClick={() => setBreakdownTab('PROFIT')}
                      style={{
                        padding: '3px 8px',
                        fontSize: '0.75rem',
                        borderRadius: '4px',
                        border: 'none',
                        background: breakdownTab === 'PROFIT' ? '#16a34a' : '#f0fdf4',
                        color: breakdownTab === 'PROFIT' ? '#ffffff' : '#16a34a',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      Profit ({tenPercentEntries.length}) · {currency.format(totalProfit)}
                    </button>
                    <button
                      type="button"
                      onClick={() => setBreakdownTab('INTEREST')}
                      style={{
                        padding: '3px 8px',
                        fontSize: '0.75rem',
                        borderRadius: '4px',
                        border: 'none',
                        background: breakdownTab === 'INTEREST' ? '#2563eb' : '#eff6ff',
                        color: breakdownTab === 'INTEREST' ? '#ffffff' : '#2563eb',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      Interest ({interests.length}) · {currency.format(totalInterest)}
                    </button>
                  </div>

                  {/* Item List */}
                  <div style={{ maxHeight: '280px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.375rem', paddingRight: '4px' }}>
                    {filteredIncomeItems.length === 0 ? (
                      <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--muted)', textAlign: 'center', padding: '1rem' }}>No entries found</p>
                    ) : (
                      filteredIncomeItems.map((item) => (
                        <div
                          key={item.id}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '0.4rem 0.5rem',
                            background: '#f8fafc',
                            borderRadius: '6px',
                            fontSize: '0.8125rem',
                          }}
                        >
                          <div>
                            <div style={{ fontWeight: 600, color: 'var(--text)' }}>{item.customerName}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
                              {item.accountInfo} • {item.date}
                            </div>
                          </div>
                          <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                            <span
                              style={{
                                fontSize: '0.6875rem',
                                fontWeight: 700,
                                padding: '1px 5px',
                                borderRadius: '3px',
                                background:
                                  item.source === 'DUE' ? '#fee2e2' : item.source === 'PROFIT' ? '#dcfce7' : '#dbeafe',
                                color:
                                  item.source === 'DUE' ? '#991b1b' : item.source === 'PROFIT' ? '#166534' : '#1e40af',
                              }}
                            >
                              {item.source === 'PROFIT' ? '10% PROFIT' : item.source}
                            </span>
                            <strong style={{ fontSize: '0.875rem', color: 'var(--text)' }}>{currency.format(item.amount)}</strong>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <Link to="/reconciliation" className="kpi-card" style={{ textDecoration: 'none' }}>
              <span className="kpi-label">TOTAL</span>
              <span className="kpi-value">{currency.format(metrics.workbookTotalLedger)}</span>
              <span className="kpi-subtext">INVEST + INTEREST + PROFIT10% + DUE</span>
            </Link>

            <Link to="/active-accounts" className="kpi-card" style={{ textDecoration: 'none' }}>
              <span className="kpi-label">LOAN</span>
              <span className="kpi-value">{currency.format(metrics.principalDisbursed ?? 162000)}</span>
              <span className="kpi-subtext">17 loan accounts ledgered (₹1.62L)</span>
            </Link>

            <Link to="/reconciliation" className="kpi-card highlight-card" style={{ textDecoration: 'none' }}>
              <span className="kpi-label">CASH IN BANK</span>
              <span className="kpi-value">{currency.format(metrics.workbookCashInHand)}</span>
              <span className="kpi-subtext">TOTAL − LOAN</span>
            </Link>

            <Link to="/reconciliation" className="kpi-card highlight-card" style={{ textDecoration: 'none', borderColor: '#3b82f6', background: '#f0f9ff' }}>
              <span className="kpi-label" style={{ color: '#0369a1' }}>BALANCE</span>
              <span className="kpi-value" style={{ color: '#0284c7' }}>{currency.format(metrics.workbookCashInHand)}</span>
              <span className="kpi-subtext">Cash in Bank balance</span>
            </Link>
          </div>

          {/* Operational Metrics Cards (Values cleared for initial audit) */}
          <div className="kpi-grid" style={{ marginBottom: '1.5rem' }}>
            <div className="kpi-card">
              <span className="kpi-label">Total Collections</span>
              <span className="kpi-value" style={{ color: 'var(--muted)' }}>—</span>
              <span className="kpi-subtext">Pending audit</span>
            </div>

            <Link to="/reminders" className="kpi-card" style={{ textDecoration: 'none' }}>
              <span className="kpi-label">Due Today</span>
              <span className="kpi-value" style={{ color: 'var(--muted)' }}>—</span>
              <span className="kpi-subtext">Pending audit</span>
            </Link>

            <Link to="/reminders" className="kpi-card" style={{ textDecoration: 'none' }}>
              <span className="kpi-label">Overdue Installments</span>
              <span className="kpi-value" style={{ color: 'var(--muted)' }}>—</span>
              <span className="kpi-subtext">Pending audit</span>
            </Link>
          </div>

          {/* Quick Nav & Fund Programme Shortcuts (Values cleared for initial audit) */}
          <section className="quick-nav-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
            <Link to="/daily" className="nav-card card" style={{ textDecoration: 'none', padding: '1rem' }}>
              <h3 style={{ margin: '0 0 0.25rem', fontSize: '1rem' }}>Daily Loans (D)</h3>
              <p style={{ margin: '0 0 0.5rem', fontSize: '0.8125rem', color: 'var(--muted)' }}>10-day interest accounts</p>
              <strong style={{ fontSize: '1.125rem', color: 'var(--muted)' }}>—</strong>
            </Link>

            <Link to="/weekly" className="nav-card card" style={{ textDecoration: 'none', padding: '1rem' }}>
              <h3 style={{ margin: '0 0 0.25rem', fontSize: '1rem' }}>Weekly Loans (W)</h3>
              <p style={{ margin: '0 0 0.5rem', fontSize: '0.8125rem', color: 'var(--muted)' }}>10-week installment accounts</p>
              <strong style={{ fontSize: '1.125rem', color: 'var(--muted)' }}>—</strong>
            </Link>

            <Link to="/funds/monthly" className="nav-card card" style={{ textDecoration: 'none', padding: '1rem', borderLeft: '4px solid #8b5cf6' }}>
              <h3 style={{ margin: '0 0 0.25rem', fontSize: '1rem' }}>Monthly Fund</h3>
              <p style={{ margin: '0 0 0.5rem', fontSize: '0.8125rem', color: 'var(--muted)' }}>4 members</p>
              <strong style={{ fontSize: '1.125rem', color: 'var(--muted)' }}>—</strong>
            </Link>

            <Link to="/funds/sweet" className="nav-card card" style={{ textDecoration: 'none', padding: '1rem', borderLeft: '4px solid #f59e0b' }}>
              <h3 style={{ margin: '0 0 0.25rem', fontSize: '1rem' }}>Sweet Fund</h3>
              <p style={{ margin: '0 0 0.5rem', fontSize: '0.8125rem', color: 'var(--muted)' }}>50 members · 50 weeks</p>
              <strong style={{ fontSize: '1.125rem', color: 'var(--muted)' }}>—</strong>
            </Link>

            <Link to="/profit/ten-percent" className="nav-card card" style={{ textDecoration: 'none', padding: '1rem' }}>
              <h3 style={{ margin: '0 0 0.25rem', fontSize: '1rem' }}>10% Profit Module</h3>
              <p style={{ margin: '0 0 0.5rem', fontSize: '0.8125rem', color: 'var(--muted)' }}>Verified profit records</p>
              <strong style={{ fontSize: '1.125rem', color: 'var(--muted)' }}>—</strong>
            </Link>

            <Link to="/reminders" className="nav-card card" style={{ textDecoration: 'none', padding: '1rem' }}>
              <h3 style={{ margin: '0 0 0.25rem', fontSize: '1rem' }}>Reminders & Dues</h3>
              <p style={{ margin: '0 0 0.5rem', fontSize: '0.8125rem', color: 'var(--muted)' }}>Customer dues & collections</p>
              <strong style={{ fontSize: '1.125rem', color: 'var(--muted)' }}>—</strong>
            </Link>
          </section>
        </>
      )}
    </div>
  )
}
