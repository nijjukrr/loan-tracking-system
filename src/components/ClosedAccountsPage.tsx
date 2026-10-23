import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { financeApi } from '../lib/financeApi'
import type { Loan, ModeKind } from '../types'

const currency = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })

export function ClosedAccountsPage() {
  const [loans, setLoans] = useState<Loan[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [modeFilter, setModeFilter] = useState<ModeKind | 'ALL'>('ALL')

  const loadData = useCallback(() => {
    setLoading(true)
    const mode = modeFilter === 'ALL' ? undefined : modeFilter
    financeApi
      .listLoans({ status: 'closed', mode, search })
      .then((data) => setLoans(data))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false))
  }, [modeFilter, search])

  useEffect(() => {
    loadData()
  }, [loadData])

  const totalPrincipal = loans.reduce((sum, l) => sum + (l.principal || 0), 0)
  const totalCollected = loans.reduce((sum, l) => sum + (l.total_collected || 0), 0)
  const totalProfit = loans.reduce((sum, l) => sum + Math.max(0, (l.total_collected || 0) - (l.principal || 0)), 0)
  const zeroBalanceCount = loans.filter((l) => (l.principal || 0) === 0).length

  return (
    <div className="page-shell">
      <header className="page-header">
        <div>
          <p className="eyebrow">Archive & Historical Ledger</p>
          <h1 className="page-title">Closed Accounts</h1>
          <p className="page-subtitle">
            Permanently archived loan records, completed settlements, and zero-amount historical closure rows.
          </p>
        </div>
      </header>

      {/* KPI Cards */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <span className="kpi-label">Closed Accounts</span>
          <span className="kpi-value">{loans.length}</span>
          <span className="kpi-subtext">
            {zeroBalanceCount > 0 ? `${zeroBalanceCount} zero-principal historical rows` : 'Fully preserved history'}
          </span>
        </div>
        <div className="kpi-card">
          <span className="kpi-label">Historical Principal</span>
          <span className="kpi-value">{currency.format(totalPrincipal)}</span>
          <span className="kpi-subtext">Capital safely returned</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-label">Total Historical Collections</span>
          <span className="kpi-value">{currency.format(totalCollected)}</span>
          <span className="kpi-subtext">Principal + returns collected</span>
        </div>
        <div className="kpi-card accent-card">
          <span className="kpi-label">Realized Profit</span>
          <span className="kpi-value">{currency.format(totalProfit)}</span>
          <span className="kpi-subtext">Net earnings from closed portfolio</span>
        </div>
      </div>

      {/* Archival Policy Notice */}
      <div className="card" style={{ marginBottom: '1.25rem', background: '#f8fafc', borderLeft: '4px solid #64748b' }}>
        <h3 style={{ margin: '0 0 0.375rem', fontSize: '0.9375rem', fontWeight: 700, color: '#334155' }}>
          🛡️ Preserved Historical Integrity & Audit Safety
        </h3>
        <p style={{ margin: 0, fontSize: '0.8125rem', color: '#475569', lineHeight: '1.5' }}>
          Closed accounts and historical zero-amount workbook rows (e.g. Prakash, Pattani) are retained indefinitely.
          Their existence never triggers automated disbursements, and viewing them preserves original remarks, dates, and full audit trails.
        </p>
      </div>

      {/* Filters */}
      <section className="search-bar-card filters-row" style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem' }}>
        <input
          type="search"
          placeholder="Search closed accounts by borrower name or remarks…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ flex: 1, padding: '0.5rem 0.75rem', border: '1px solid var(--line)', borderRadius: '6px' }}
        />
        <select
          value={modeFilter}
          onChange={(e) => setModeFilter(e.target.value as ModeKind | 'ALL')}
          style={{ padding: '0.5rem 0.75rem', border: '1px solid var(--line)', borderRadius: '6px' }}
        >
          <option value="ALL">All Modes</option>
          <option value="D">Daily Loans</option>
          <option value="W">Weekly Loans</option>
        </select>
      </section>

      {/* Table */}
      <section className="table-card card">
        <div className="card-header" style={{ marginBottom: '1rem' }}>
          <h2 style={{ fontSize: '1.125rem', margin: 0, fontWeight: 700 }}>
            Closed Loan Records ({loans.length})
          </h2>
          <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--muted)' }}>
            Showing all finalized accounts with settlement dates and closure notes.
          </p>
        </div>

        {loading ? (
          <div className="loading-state">Loading closed accounts…</div>
        ) : loans.length === 0 ? (
          <div className="empty-state">
            <p>No closed accounts found matching the filter.</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Borrower / Account</th>
                  <th>Mode</th>
                  <th style={{ textAlign: 'right' }}>Principal</th>
                  <th>Start Date</th>
                  <th>Closed Date</th>
                  <th style={{ textAlign: 'right' }}>Collected</th>
                  <th style={{ textAlign: 'right' }}>Realized Gain</th>
                  <th>Closure Remarks</th>
                  <th style={{ textAlign: 'center' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {loans.map((loan) => {
                  const isZeroPrincipal = (loan.principal || 0) === 0
                  const gain = Math.max(0, (loan.total_collected || 0) - (loan.principal || 0))
                  return (
                    <tr key={loan.id}>
                      <td className="primary-cell" style={{ fontWeight: 600 }}>
                        <Link to={`/borrower/${loan.id}`} className="customer-link">
                          {loan.customer_name}
                        </Link>
                        {loan.ac_no && (
                          <span style={{ fontSize: '0.75rem', color: 'var(--muted)', display: 'block' }}>
                            A/C #{loan.ac_no}
                          </span>
                        )}
                      </td>
                      <td>
                        <span className="source-badge">
                          {loan.mode === 'D' ? 'Daily' : 'Weekly'}
                        </span>
                      </td>
                      <td className="amount-cell" style={{ textAlign: 'right' }}>
                        {isZeroPrincipal ? (
                          <span className="source-badge" style={{ background: '#f1f5f9', color: '#64748b' }}>
                            ₹0 (Settled)
                          </span>
                        ) : (
                          currency.format(loan.principal)
                        )}
                      </td>
                      <td>{loan.loan_date}</td>
                      <td>{loan.closed_at ? loan.closed_at.slice(0, 10) : loan.loan_date}</td>
                      <td className="amount-cell" style={{ textAlign: 'right' }}>
                        {currency.format(loan.total_collected || 0)}
                      </td>
                      <td className="amount-cell text-success" style={{ textAlign: 'right', color: '#16a34a' }}>
                        {currency.format(gain)}
                      </td>
                      <td style={{ fontSize: '0.8125rem' }}>
                        {loan.source_remarks ? (
                          <span title={loan.source_remarks}>{loan.source_remarks}</span>
                        ) : (
                          <span style={{ color: 'var(--muted)' }}>Standard settlement</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <Link to={`/borrower/${loan.id}`} className="secondary-button compact-button" style={{ padding: '4px 8px', fontSize: '0.75rem' }}>
                          View History
                        </Link>
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
  )
}
