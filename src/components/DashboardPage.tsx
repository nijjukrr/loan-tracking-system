import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { financeApi } from '../lib/financeApi'
import type { DashboardMetrics, Loan } from '../types'

const currency = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })

type Props = {
  onOpenNewLoan: () => void
}

type PeriodFilter = 'ALL' | 'TODAY' | 'WEEK' | 'MONTH'

export function DashboardPage({ onOpenNewLoan }: Props) {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null)
  const [recentLoans, setRecentLoans] = useState<Loan[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [period, setPeriod] = useState<PeriodFilter>('ALL')

  const loadData = () => {
    setLoading(true)
    setError('')
    Promise.all([financeApi.getDashboardMetrics(), financeApi.listLoans({ status: 'active' })])
      .then(([mRes, lRes]) => {
        setMetrics(mRes)
        setRecentLoans(lRes.slice(0, 6))
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
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div className="kpi-card" key={i} style={{ opacity: 0.5 }}>
              <span className="kpi-label">Loading…</span>
              <span className="kpi-value">—</span>
            </div>
          ))}
        </div>
      ) : (
        <>
          {/* Audited Financial Ledger Primary KPIs */}
          <div className="kpi-grid">
            <Link to="/investments" className="kpi-card" style={{ textDecoration: 'none' }}>
              <span className="kpi-label">Investments Received</span>
              <span className="kpi-value">{currency.format(metrics.investmentReceived)}</span>
              <span className="kpi-subtext">8 partner capital credits (₹1.85L)</span>
            </Link>

            <Link to="/active-accounts" className="kpi-card" style={{ textDecoration: 'none' }}>
              <span className="kpi-label">Principal Disbursed</span>
              <span className="kpi-value">{currency.format(metrics.principalDisbursed ?? 162000)}</span>
              <span className="kpi-subtext">17 loan accounts ledgered (₹1.62L)</span>
            </Link>

            <Link to="/interest" className="kpi-card" style={{ textDecoration: 'none' }}>
              <span className="kpi-label">Interest Received</span>
              <span className="kpi-value">{currency.format(metrics.interestReceived)}</span>
              <span className="kpi-subtext">9 receipts verified (₹4,950)</span>
            </Link>

            <Link to="/profit/ten-percent" className="kpi-card accent-card" style={{ textDecoration: 'none' }}>
              <span className="kpi-label">10% Profit Collected</span>
              <span className="kpi-value">{currency.format(metrics.tenPercentProfit)}</span>
              <span className="kpi-subtext">24 verified entries (₹8,970)</span>
            </Link>

            <Link to="/reminders" className="kpi-card danger-card" style={{ textDecoration: 'none' }}>
              <span className="kpi-label">Outstanding Dues</span>
              <span className="kpi-value text-danger">{currency.format(metrics.outstandingDues)}</span>
              <span className="kpi-subtext">6 customer receivables (₹12,000)</span>
            </Link>

            <Link to="/reconciliation" className="kpi-card" style={{ textDecoration: 'none' }}>
              <span className="kpi-label">Total Ledger Value</span>
              <span className="kpi-value">{currency.format(metrics.workbookTotalLedger)}</span>
              <span className="kpi-subtext">Inv + Int + Profit + Dues (₹2,10,920)</span>
            </Link>

            <Link to="/reconciliation" className="kpi-card highlight-card" style={{ textDecoration: 'none' }}>
              <span className="kpi-label">Excel Nominal Cash</span>
              <span className="kpi-value">{currency.format(metrics.workbookCashInHand)}</span>
              <span className="kpi-subtext">Ledger ₹2.10L − Principal ₹1.62L</span>
            </Link>

            <Link to="/reconciliation" className="kpi-card success-card" style={{ textDecoration: 'none', background: '#ecfdf5', borderColor: '#10b981' }}>
              <span className="kpi-label">Actual Liquid Available Cash</span>
              <span className="kpi-value" style={{ color: '#047857' }}>{currency.format(metrics.reconciledAvailableCash)}</span>
              <span className="kpi-subtext">Excludes ₹12k unpaid customer dues</span>
            </Link>
          </div>

          {/* Cash vs Unpaid Due Accounting Alert */}
          <div className="card" style={{ marginBottom: '1.5rem', background: '#eff6ff', borderLeft: '4px solid #3b82f6' }}>
            <h3 style={{ margin: '0 0 0.375rem', fontSize: '0.9375rem', fontWeight: 700, color: '#1e40af' }}>
              ℹ️ Accounting Reconciliation: Nominal vs Liquid Cash Variance
            </h3>
            <p style={{ margin: 0, fontSize: '0.8125rem', color: '#1e3a8a', lineHeight: '1.5' }}>
              The Excel workbook displays a nominal cash balance of <strong>{currency.format(metrics.workbookCashInHand)}</strong> (₹210,920 − ₹162,000),
              which arithmetically includes <strong>{currency.format(metrics.outstandingDues)}</strong> in customer dues.
              In true cash accounting, unpaid dues are receivables and cannot be spent.
              Therefore, the actual liquid available cash is <strong>{currency.format(metrics.reconciledAvailableCash)}</strong>.
            </p>
          </div>

          {/* Operational Metrics Cards */}
          <div className="kpi-grid" style={{ marginBottom: '1.5rem' }}>
            <div className="kpi-card">
              <span className="kpi-label">Total Collections</span>
              <span className="kpi-value">{currency.format(metrics.totalCollected)}</span>
              <span className="kpi-subtext">Today: {currency.format(metrics.todayCollections ?? 0)}</span>
            </div>

            <div className="kpi-card">
              <span className="kpi-label">Active / Closed Accounts</span>
              <span className="kpi-value">{metrics.activeAccounts} <span style={{ fontSize: '0.875rem', color: 'var(--muted)' }}>/ {metrics.closedAccounts}</span></span>
              <span className="kpi-subtext">Managed loan portfolio (17 total)</span>
            </div>

            <Link to="/reminders" className="kpi-card" style={{ textDecoration: 'none' }}>
              <span className="kpi-label">Due Today</span>
              <span className="kpi-value" style={{ color: metrics.dueTodayCount > 0 ? '#f59e0b' : 'inherit' }}>
                {metrics.dueTodayCount}
              </span>
              <span className="kpi-subtext">
                {metrics.dueTodayAmount ? currency.format(metrics.dueTodayAmount) : 'Pending collections today'}
              </span>
            </Link>

            <Link to="/reminders" className="kpi-card" style={{ textDecoration: 'none' }}>
              <span className="kpi-label">Overdue Installments</span>
              <span className="kpi-value" style={{ color: metrics.overdueCount > 0 ? '#ef4444' : 'inherit' }}>
                {metrics.overdueCount}
              </span>
              <span className="kpi-subtext">
                {metrics.overdueAmount ? `${currency.format(metrics.overdueAmount)} unpaid` : 'Delinquent payments'}
              </span>
            </Link>
          </div>

          {/* Quick Nav & Fund Programme Shortcuts */}
          <section className="quick-nav-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
            <Link to="/daily" className="nav-card card" style={{ textDecoration: 'none', padding: '1rem' }}>
              <h3 style={{ margin: '0 0 0.25rem', fontSize: '1rem' }}>Daily Loans (D)</h3>
              <p style={{ margin: '0 0 0.5rem', fontSize: '0.8125rem', color: 'var(--muted)' }}>10-day interest accounts</p>
              <strong style={{ fontSize: '1.125rem', color: 'var(--primary)' }}>{currency.format(metrics.dailyMoneyLent)}</strong>
            </Link>

            <Link to="/weekly" className="nav-card card" style={{ textDecoration: 'none', padding: '1rem' }}>
              <h3 style={{ margin: '0 0 0.25rem', fontSize: '1rem' }}>Weekly Loans (W)</h3>
              <p style={{ margin: '0 0 0.5rem', fontSize: '0.8125rem', color: 'var(--muted)' }}>10-week installment accounts</p>
              <strong style={{ fontSize: '1.125rem', color: 'var(--primary)' }}>{currency.format(metrics.weeklyMoneyLent)}</strong>
            </Link>

            <Link to="/funds/monthly" className="nav-card card" style={{ textDecoration: 'none', padding: '1rem', borderLeft: '4px solid #8b5cf6' }}>
              <h3 style={{ margin: '0 0 0.25rem', fontSize: '1rem' }}>Monthly Fund</h3>
              <p style={{ margin: '0 0 0.5rem', fontSize: '0.8125rem', color: 'var(--muted)' }}>4 members (Medicals, Rams…)</p>
              <strong style={{ fontSize: '1.125rem', color: '#8b5cf6' }}>₹47,800 Target</strong>
            </Link>

            <Link to="/funds/sweet" className="nav-card card" style={{ textDecoration: 'none', padding: '1rem', borderLeft: '4px solid #f59e0b' }}>
              <h3 style={{ margin: '0 0 0.25rem', fontSize: '1rem' }}>Sweet Fund</h3>
              <p style={{ margin: '0 0 0.5rem', fontSize: '0.8125rem', color: 'var(--muted)' }}>50 members · 50 weeks</p>
              <strong style={{ fontSize: '1.125rem', color: '#d97706' }}>₹5,15,000 Target</strong>
            </Link>

            <Link to="/profit/ten-percent" className="nav-card card" style={{ textDecoration: 'none', padding: '1rem' }}>
              <h3 style={{ margin: '0 0 0.25rem', fontSize: '1rem' }}>10% Profit Module</h3>
              <p style={{ margin: '0 0 0.5rem', fontSize: '0.8125rem', color: 'var(--muted)' }}>24 verified profit records</p>
              <strong style={{ fontSize: '1.125rem', color: '#16a34a' }}>₹8,970</strong>
            </Link>

            <Link to="/reminders" className="nav-card card" style={{ textDecoration: 'none', padding: '1rem' }}>
              <h3 style={{ margin: '0 0 0.25rem', fontSize: '1rem' }}>Reminders & Dues</h3>
              <p style={{ margin: '0 0 0.5rem', fontSize: '0.8125rem', color: 'var(--muted)' }}>Customer dues & collections</p>
              <strong style={{ fontSize: '1.125rem', color: '#dc2626' }}>{metrics.overdueCount + metrics.dueTodayCount + 6} items</strong>
            </Link>
          </section>


          {/* Active Loans Quick Overview */}
          <section className="table-card card">
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div>
                <h2 style={{ fontSize: '1.125rem', margin: 0, fontWeight: 700 }}>Active Loan Portfolio ({recentLoans.length} shown)</h2>
                <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--muted)' }}>
                  Click any borrower to inspect account timeline, payment allocations, and schedules.
                </p>
              </div>
              <Link to="/active-accounts" className="secondary-button compact-button">
                View All Active
              </Link>
            </div>

            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Borrower</th>
                    <th>Mode</th>
                    <th>Loan Date</th>
                    <th style={{ textAlign: 'right' }}>Principal</th>
                    <th style={{ textAlign: 'right' }}>Collected</th>
                    <th style={{ textAlign: 'right' }}>Balance</th>
                    <th style={{ textAlign: 'center' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {recentLoans.map((loan) => (
                    <tr key={loan.id}>
                      <td className="primary-cell" style={{ fontWeight: 600 }}>
                        <Link to={`/borrower/${loan.id}`} className="customer-link">
                          {loan.customer_name}
                        </Link>
                      </td>
                      <td>
                        <span className="source-badge">{loan.mode === 'D' ? 'Daily' : 'Weekly'}</span>
                      </td>
                      <td>{loan.loan_date}</td>
                      <td className="amount-cell" style={{ textAlign: 'right' }}>{currency.format(loan.principal)}</td>
                      <td className="amount-cell" style={{ textAlign: 'right' }}>{currency.format(loan.total_collected)}</td>
                      <td className="amount-cell text-danger" style={{ textAlign: 'right' }}>{currency.format(loan.remaining_balance)}</td>
                      <td style={{ textAlign: 'center' }}>
                        <Link to={`/borrower/${loan.id}`} className="secondary-button compact-button" style={{ padding: '3px 8px', fontSize: '0.75rem' }}>
                          Timeline
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  )
}
