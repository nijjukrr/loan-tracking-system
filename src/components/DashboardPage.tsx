import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { financeApi } from '../lib/financeApi'
import type { DashboardMetrics, Loan } from '../types'

const currency = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })

type Props = {
  onOpenNewLoan: () => void
}

export function DashboardPage({ onOpenNewLoan }: Props) {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null)
  const [recentLoans, setRecentLoans] = useState<Loan[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadData = () => {
    setLoading(true)
    setError('')
    Promise.all([financeApi.getDashboardMetrics(), financeApi.listLoans({ status: 'active' })])
      .then(([mRes, lRes]) => {
        setMetrics(mRes)
        setRecentLoans(lRes.slice(0, 5))
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
    <>
      <header className="page-header">
        <div>
          <p className="eyebrow">Finance Overview</p>
          <h1>Main Dashboard</h1>
          <p className="page-description">Real-time statistics computed from imported Excel and live transactions.</p>
        </div>
        <div className="header-actions">
          <button className="primary-button" type="button" onClick={onOpenNewLoan}>
            + New Loan
          </button>
        </div>
      </header>

      {error && (
        <div className="form-message error-message" style={{ marginBottom: '1.5rem' }}>
          <strong>Error:</strong> {error}
          <button className="secondary-button compact-button" style={{ marginLeft: '1rem' }} onClick={loadData}>
            Retry
          </button>
        </div>
      )}

      {loading || !metrics ? (
        <section className="metrics-grid main-metrics-grid">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div className="metric-card skeleton-card" key={i} style={{ opacity: 0.6, minHeight: '110px' }}>
              <span className="skeleton-line" style={{ display: 'inline-block', width: '60%', height: '14px', background: 'var(--border-color, #e2e8f0)', borderRadius: '4px' }}></span>
              <strong className="skeleton-line" style={{ display: 'block', width: '80%', height: '28px', margin: '12px 0 8px', background: 'var(--border-color, #e2e8f0)', borderRadius: '4px' }}></strong>
              <small className="skeleton-line" style={{ display: 'inline-block', width: '40%', height: '12px', background: 'var(--border-color, #e2e8f0)', borderRadius: '4px' }}></small>
            </div>
          ))}
        </section>
      ) : (
        <>
          {/* Main KPI Grid */}
          <section className="metrics-grid main-metrics-grid">
            <div className="metric-card highlight-card">
              <span>Total Money Lent</span>
              <strong>{currency.format(metrics.totalMoneyLent)}</strong>
              <small>
                Daily: {currency.format(metrics.dailyMoneyLent)} · Weekly: {currency.format(metrics.weeklyMoneyLent)}
              </small>
            </div>

            <div className="metric-card">
              <span>Total Collected</span>
              <strong>{currency.format(metrics.totalCollected)}</strong>
              <small>All repayments & collections</small>
            </div>

            <div className="metric-card success-card">
              <span>Total Realized Profit</span>
              <strong>{currency.format(metrics.totalProfit)}</strong>
              <small>
                Daily: {currency.format(metrics.dailyProfit)} · Weekly: {currency.format(metrics.weeklyProfit)} · 10%:{' '}
                {currency.format(metrics.tenPercentProfit)}
              </small>
            </div>

            <div className="metric-card">
              <span>Active Accounts</span>
              <strong>{metrics.activeAccounts}</strong>
              <small>Closed Accounts: {metrics.closedAccounts}</small>
            </div>

            <div className="metric-card warning-card">
              <span>Due Today</span>
              <strong>{metrics.dueTodayCount}</strong>
              <small>Payments due today</small>
            </div>

            <div className="metric-card danger-card">
              <span>Overdue Payments</span>
              <strong>{metrics.overdueCount}</strong>
              <small>Requires immediate collection</small>
            </div>
          </section>

          {/* Quick Navigation Cards */}
          <section className="quick-nav-grid">
            <Link to="/daily" className="nav-card">
              <div>
                <h3>Daily Loans</h3>
                <p>10-day interest cycle accounts</p>
              </div>
              <strong>{currency.format(metrics.dailyMoneyLent)}</strong>
            </Link>

            <Link to="/weekly" className="nav-card">
              <div>
                <h3>Weekly Loans</h3>
                <p>10-week installment accounts</p>
              </div>
              <strong>{currency.format(metrics.weeklyMoneyLent)}</strong>
            </Link>

            <Link to="/profit/ten-percent" className="nav-card">
              <div>
                <h3>10% Profit</h3>
                <p>Confirmed profit entries & tagging</p>
              </div>
              <strong>{currency.format(metrics.tenPercentProfit)}</strong>
            </Link>

            <Link to="/reminders" className="nav-card">
              <div>
                <h3>Reminders</h3>
                <p>Due Today & Overdue lists</p>
              </div>
              <strong className="text-danger">{metrics.overdueCount + metrics.dueTodayCount} items</strong>
            </Link>
          </section>

          {/* Active Loans Quick Overview */}
          <section className="table-card">
            <div className="table-heading">
              <div>
                <h2>Active Loans Summary ({recentLoans.length})</h2>
                <p>Click any borrower to inspect detailed account & payment timeline</p>
              </div>
              <Link to="/active-accounts" className="secondary-button compact-button">
                View All Active
              </Link>
            </div>

            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Customer Name</th>
                    <th>Mode</th>
                    <th>Main Sheet No</th>
                    <th>Loan Date</th>
                    <th className="amount-cell">Principal</th>
                    <th className="amount-cell">Collected</th>
                    <th className="amount-cell">Remaining Balance</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {recentLoans.map((loan) => (
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
                      <td>{loan.loan_date}</td>
                      <td className="amount-cell">{currency.format(loan.principal)}</td>
                      <td className="amount-cell">{currency.format(loan.total_collected)}</td>
                      <td className="amount-cell text-highlight">{currency.format(loan.remaining_balance)}</td>
                      <td>
                        <Link to={`/borrower/${loan.id}`} className="secondary-button compact-button">
                          Details
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
    </>
  )
}

