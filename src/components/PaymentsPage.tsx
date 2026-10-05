import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { financeApi } from '../lib/financeApi'
import { formatDateISO } from '../lib/financeLogic'
import type { ModeKind, Payment } from '../types'

const currency = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })

export function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)
  const [modeFilter, setModeFilter] = useState<ModeKind | 'ALL'>('ALL')
  const [search, setSearch] = useState('')
  const [dateFilter, setDateFilter] = useState<'ALL' | 'TODAY' | 'WEEK' | 'MONTH'>('ALL')

  const loadData = () => {
    setLoading(true)
    const mode = modeFilter === 'ALL' ? undefined : modeFilter
    financeApi
      .listPayments({ mode, search })
      .then((data) => setPayments(data))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadData()
  }, [modeFilter, search])

  const todayStr = formatDateISO(new Date())

  const filteredPayments = payments.filter((p) => {
    if (dateFilter === 'TODAY' && p.payment_date !== todayStr) return false
    if (dateFilter === 'WEEK') {
      const pTime = new Date(p.payment_date).getTime()
      const tTime = new Date(todayStr).getTime()
      const diffDays = (tTime - pTime) / (1000 * 60 * 60 * 24)
      if (diffDays < 0 || diffDays > 7) return false
    }
    if (dateFilter === 'MONTH') {
      if (p.payment_date.slice(0, 7) !== todayStr.slice(0, 7)) return false
    }
    return true
  })

  const totalAmount = filteredPayments.reduce((sum, p) => sum + p.amount, 0)

  return (
    <>
      <header className="page-header">
        <div>
          <p className="eyebrow">Transaction Records</p>
          <h1>Payment History</h1>
          <p className="page-description">Complete audit log of all repayments and interest collected.</p>
        </div>
      </header>

      <section className="search-bar-card filters-row">
        <input
          type="search"
          placeholder="Search by customer name or Main Sheet No…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <div className="filter-group">
          <select value={modeFilter} onChange={(e) => setModeFilter(e.target.value as ModeKind | 'ALL')}>
            <option value="ALL">All Modes</option>
            <option value="D">Daily Loans</option>
            <option value="W">Weekly Loans</option>
          </select>

          <select value={dateFilter} onChange={(e) => setDateFilter(e.target.value as any)}>
            <option value="ALL">All Dates</option>
            <option value="TODAY">Today</option>
            <option value="WEEK">This Week</option>
            <option value="MONTH">This Month</option>
          </select>
        </div>
      </section>

      <section className="table-card">
        <div className="table-heading">
          <div>
            <h2>Payments ({filteredPayments.length})</h2>
            <p>Total Collected: {currency.format(totalAmount)}</p>
          </div>
        </div>

        {loading ? (
          <div className="empty-state">Loading payment records…</div>
        ) : filteredPayments.length === 0 ? (
          <div className="empty-state">
            <strong>No payments found</strong>
            <span>Try clearing or changing your filters.</span>
          </div>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Payment ID</th>
                  <th>Customer Name</th>
                  <th>Mode</th>
                  <th>Main Sheet No</th>
                  <th>Payment Date</th>
                  <th className="amount-cell">Amount</th>
                  <th>Payment Type</th>
                  <th>Note / Remark</th>
                </tr>
              </thead>
              <tbody>
                {filteredPayments.map((pay) => (
                  <tr key={pay.id}>
                    <td>
                      <code className="code-id">{pay.id}</code>
                    </td>
                    <td className="primary-cell">
                      <Link to={`/borrower/${pay.loan_id}`} className="customer-link">
                        {pay.customer_name}
                      </Link>
                    </td>
                    <td>
                      <span className="source-badge">{pay.mode === 'D' ? 'Daily' : 'Weekly'}</span>
                    </td>
                    <td>#{pay.main_sheet_no}</td>
                    <td>{pay.payment_date}</td>
                    <td className="amount-cell primary-cell">{currency.format(pay.amount)}</td>
                    <td>
                      <span className="source-badge">{pay.payment_type}</span>
                    </td>
                    <td>{pay.note || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  )
}
