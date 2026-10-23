import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { financeApi } from '../lib/financeApi'
import { formatDateISO } from '../lib/financeLogic'
import type { ModeKind, Payment, PaymentType } from '../types'

const currency = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })

export function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)
  const [modeFilter, setModeFilter] = useState<ModeKind | 'ALL'>('ALL')
  const [typeFilter, setTypeFilter] = useState<PaymentType | 'ALL'>('ALL')
  const [search, setSearch] = useState('')
  const [dateFilter, setDateFilter] = useState<'ALL' | 'TODAY' | 'WEEK' | 'MONTH' | 'CUSTOM'>('ALL')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [sortBy, setSortBy] = useState<'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc'>('date-desc')

  const loadData = useCallback(() => {
    setLoading(true)
    const mode = modeFilter === 'ALL' ? undefined : modeFilter
    financeApi
      .listPayments({ mode })
      .then((data) => setPayments(data))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false))
  }, [modeFilter])

  useEffect(() => {
    loadData()
  }, [loadData])

  const todayStr = formatDateISO(new Date())

  const filteredPayments = payments
    .filter((p) => {
      // Type filter
      if (typeFilter !== 'ALL' && p.payment_type !== typeFilter) return false

      // Search filter across person, note, id, sheet number
      if (search.trim()) {
        const q = search.toLowerCase()
        const matchesName = p.customer_name.toLowerCase().includes(q)
        const matchesNote = (p.note || '').toLowerCase().includes(q)
        const matchesId = p.id.toLowerCase().includes(q)
        const matchesNo = String(p.main_sheet_no || '').includes(q)
        if (!matchesName && !matchesNote && !matchesId && !matchesNo) return false
      }

      // Date filters
      const pDate = p.payment_date ? p.payment_date.slice(0, 10) : ''
      if (dateFilter === 'TODAY' && pDate !== todayStr) return false
      if (dateFilter === 'WEEK') {
        const pTime = new Date(pDate).getTime()
        const tTime = new Date(todayStr).getTime()
        const diffDays = (tTime - pTime) / (1000 * 60 * 60 * 24)
        if (diffDays < 0 || diffDays > 7) return false
      }
      if (dateFilter === 'MONTH') {
        if (pDate.slice(0, 7) !== todayStr.slice(0, 7)) return false
      }
      if (dateFilter === 'CUSTOM') {
        if (startDate && pDate < startDate) return false
        if (endDate && pDate > endDate) return false
      }

      return true
    })
    .sort((a, b) => {
      if (sortBy === 'date-desc') return (b.payment_date || '').localeCompare(a.payment_date || '')
      if (sortBy === 'date-asc') return (a.payment_date || '').localeCompare(b.payment_date || '')
      if (sortBy === 'amount-desc') return (b.amount || 0) - (a.amount || 0)
      if (sortBy === 'amount-asc') return (a.amount || 0) - (b.amount || 0)
      return 0
    })

  // Summary figures strictly computed from filtered results
  const totalAmount = filteredPayments.reduce((sum, p) => sum + (p.amount || 0), 0)
  const totalInterestAllocated = filteredPayments.reduce((sum, p) => sum + (p.interest_allocation || (p.payment_type === 'Interest' ? p.amount : 0)), 0)
  const totalPrincipalAllocated = filteredPayments.reduce((sum, p) => sum + (p.principal_allocation || (p.payment_type === 'Principal' ? p.amount : 0)), 0)

  return (
    <div className="page-shell">
      <header className="page-header">
        <div>
          <p className="eyebrow">Transaction Records & Ledger</p>
          <h1 className="page-title">Payment & Collection Ledger</h1>
          <p className="page-subtitle">
            Auditable receipt log with multi-field search, date range filtering, and atomic allocations.
          </p>
        </div>
      </header>

      {/* Filtered Summary KPIs */}
      <div className="kpi-grid">
        <div className="kpi-card highlight-card">
          <span className="kpi-label">Filtered Collections</span>
          <span className="kpi-value">{currency.format(totalAmount)}</span>
          <span className="kpi-subtext">{filteredPayments.length} transactions matched</span>
        </div>
        <div className="kpi-card success-card">
          <span className="kpi-label">Interest Allocated</span>
          <span className="kpi-value">{currency.format(totalInterestAllocated)}</span>
          <span className="kpi-subtext">Earnings portion</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-label">Principal Returned</span>
          <span className="kpi-value">{currency.format(totalPrincipalAllocated)}</span>
          <span className="kpi-subtext">Capital recovery portion</span>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <section className="search-bar-card card" style={{ marginBottom: '1.25rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', marginBottom: '0.75rem' }}>
          <input
            type="search"
            placeholder="Search borrower, note, A/C #, ID…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ padding: '0.5rem 0.75rem', border: '1px solid var(--line)', borderRadius: '6px' }}
          />

          <select
            value={modeFilter}
            onChange={(e) => setModeFilter(e.target.value as ModeKind | 'ALL')}
            style={{ padding: '0.5rem 0.75rem', border: '1px solid var(--line)', borderRadius: '6px' }}
          >
            <option value="ALL">All Modes (Daily & Weekly)</option>
            <option value="D">Daily Loans (D)</option>
            <option value="W">Weekly Loans (W)</option>
          </select>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as PaymentType | 'ALL')}
            style={{ padding: '0.5rem 0.75rem', border: '1px solid var(--line)', borderRadius: '6px' }}
          >
            <option value="ALL">All Payment Types</option>
            <option value="Interest">Interest Only</option>
            <option value="Principal">Principal Return</option>
            <option value="Weekly Installment">Weekly Installment</option>
            <option value="Interest + Principal">Interest + Principal</option>
          </select>

          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value as any)}
            style={{ padding: '0.5rem 0.75rem', border: '1px solid var(--line)', borderRadius: '6px' }}
          >
            <option value="ALL">All Dates</option>
            <option value="TODAY">Today</option>
            <option value="WEEK">Past 7 Days</option>
            <option value="MONTH">This Month</option>
            <option value="CUSTOM">Custom Range</option>
          </select>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            style={{ padding: '0.5rem 0.75rem', border: '1px solid var(--line)', borderRadius: '6px' }}
          >
            <option value="date-desc">Date (Newest First)</option>
            <option value="date-asc">Date (Oldest First)</option>
            <option value="amount-desc">Amount (Highest First)</option>
            <option value="amount-asc">Amount (Lowest First)</option>
          </select>
        </div>

        {dateFilter === 'CUSTOM' && (
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', paddingTop: '0.5rem', borderTop: '1px solid var(--line)' }}>
            <label style={{ fontSize: '0.8125rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              From:
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={{ padding: '0.375rem', border: '1px solid var(--line)', borderRadius: '4px' }} />
            </label>
            <label style={{ fontSize: '0.8125rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              To:
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={{ padding: '0.375rem', border: '1px solid var(--line)', borderRadius: '4px' }} />
            </label>
            {(startDate || endDate) && (
              <button
                type="button"
                className="secondary-button compact-button"
                onClick={() => { setStartDate(''); setEndDate('') }}
                style={{ fontSize: '0.75rem' }}
              >
                Clear Dates
              </button>
            )}
          </div>
        )}
      </section>

      {/* Payments Table */}
      <section className="table-card card">
        <div className="card-header" style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ fontSize: '1.125rem', margin: 0, fontWeight: 700 }}>Payments ({filteredPayments.length})</h2>
            <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--muted)' }}>
              Total of matching entries: {currency.format(totalAmount)}
            </p>
          </div>
        </div>

        {loading ? (
          <div className="loading-state">Loading payment records…</div>
        ) : filteredPayments.length === 0 ? (
          <div className="empty-state">
            <strong>No payments found matching criteria</strong>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.8125rem', color: 'var(--muted)' }}>Try resetting filters or adjusting search keywords.</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Receipt Ref</th>
                  <th>Borrower</th>
                  <th>Mode</th>
                  <th>Payment Date</th>
                  <th style={{ textAlign: 'right' }}>Amount</th>
                  <th>Allocation / Type</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {filteredPayments.map((pay) => (
                  <tr key={pay.id}>
                    <td>
                      <code className="code-id" style={{ fontSize: '0.75rem' }}>{pay.id}</code>
                    </td>
                    <td className="primary-cell" style={{ fontWeight: 600 }}>
                      <Link to={`/borrower/${pay.loan_id}`} className="customer-link">
                        {pay.customer_name}
                      </Link>
                    </td>
                    <td>
                      <span className="source-badge">{pay.mode === 'D' ? 'Daily' : 'Weekly'}</span>
                    </td>
                    <td>{pay.payment_date}</td>
                    <td className="amount-cell primary-cell" style={{ textAlign: 'right' }}>
                      {currency.format(pay.amount)}
                    </td>
                    <td>
                      <span className="source-badge">{pay.payment_type}</span>
                      {(pay.principal_allocation !== undefined || pay.interest_allocation !== undefined) && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '2px' }}>
                          {pay.interest_allocation ? `Int: ₹${pay.interest_allocation.toLocaleString('en-IN')}` : ''}
                          {pay.interest_allocation && pay.principal_allocation ? ' • ' : ''}
                          {pay.principal_allocation ? `Prin: ₹${pay.principal_allocation.toLocaleString('en-IN')}` : ''}
                        </div>
                      )}
                    </td>
                    <td style={{ fontSize: '0.8125rem' }}>{pay.note || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
