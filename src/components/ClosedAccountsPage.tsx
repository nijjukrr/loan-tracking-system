import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { financeApi } from '../lib/financeApi'
import type { Loan } from '../types'

const currency = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })

export function ClosedAccountsPage() {
  const [loans, setLoans] = useState<Loan[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const loadData = () => {
    setLoading(true)
    financeApi
      .listLoans({ status: 'closed', search })
      .then((data) => setLoans(data))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadData()
  }, [search])

  return (
    <>
      <header className="page-header">
        <div>
          <p className="eyebrow">Archive</p>
          <h1>Closed Accounts</h1>
          <p className="page-description">
            Historical loan records and completed repayments. Historical data is preserved permanently.
          </p>
        </div>
      </header>

      <section className="search-bar-card">
        <input
          type="search"
          placeholder="Search closed accounts by customer or Main Sheet No…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </section>

      <section className="table-card">
        <div className="table-heading">
          <div>
            <h2>Closed Accounts ({loans.length})</h2>
            <p>Completed Loans History</p>
          </div>
        </div>

        {loading ? (
          <div className="empty-state">Loading closed accounts…</div>
        ) : loans.length === 0 ? (
          <div className="empty-state">No closed accounts found.</div>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Customer Name</th>
                  <th>Mode</th>
                  <th>Main Sheet No</th>
                  <th className="amount-cell">Principal</th>
                  <th>Start Date</th>
                  <th>Closed Date</th>
                  <th className="amount-cell">Total Collected</th>
                  <th className="amount-cell">Realized Profit</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {loans.map((loan) => {
                  const profit = Math.max(0, loan.total_collected - loan.principal)
                  return (
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
                      <td className="amount-cell">{currency.format(loan.principal)}</td>
                      <td>{loan.loan_date}</td>
                      <td>{loan.closed_at?.slice(0, 10) || loan.loan_date}</td>
                      <td className="amount-cell">{currency.format(loan.total_collected)}</td>
                      <td className="amount-cell text-success">{currency.format(profit)}</td>
                      <td>
                        <Link to={`/borrower/${loan.id}`} className="secondary-button compact-button">
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
    </>
  )
}
