import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { financeApi } from '../lib/financeApi'
import type { Loan, ModeKind } from '../types'
import { MarkPaidModal } from './MarkPaidModal'

const currency = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })

type Props = {
  onOpenNewLoan: () => void
}

export function ActiveAccountsPage({ onOpenNewLoan }: Props) {
  const [loans, setLoans] = useState<Loan[]>([])
  const [loading, setLoading] = useState(true)
  const [modeFilter, setModeFilter] = useState<ModeKind | 'ALL'>('ALL')
  const [search, setSearch] = useState('')
  const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null)
  const [showPayModal, setShowPayModal] = useState(false)

  const loadData = useCallback(() => {
    setLoading(true)
    const mode = modeFilter === 'ALL' ? undefined : modeFilter
    financeApi
      .listLoans({ mode, search })
      .then((data) => setLoans(data))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false))
  }, [modeFilter, search])

  useEffect(() => {
    loadData()
  }, [loadData])

  return (
    <>
      <header className="page-header">
        <div>
          <p className="eyebrow">Portfolio</p>
          <h1>Loan Accounts</h1>
          <p className="page-description">Each debit entry is shown separately, including multiple entries for the same person. Green means cleared in the source ledger.</p>
        </div>
        <div className="header-actions">
          <button className="primary-button" type="button" onClick={onOpenNewLoan}>
            + New Loan
          </button>
        </div>
      </header>

      <section className="search-bar-card filters-row">
          <input
          type="search"
          placeholder="Search accounts by Person…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <select value={modeFilter} onChange={(e) => setModeFilter(e.target.value as ModeKind | 'ALL')}>
          <option value="ALL">All Modes</option>
          <option value="D">Daily Loans</option>
          <option value="W">Weekly Loans</option>
        </select>
      </section>

      <section className="table-card">
        <div className="table-heading">
          <div>
            <h2>Individual Debit Entries ({loans.length})</h2>
            <p>Total of listed entries: {currency.format(loans.reduce((sum, l) => sum + l.principal, 0))}</p>
          </div>
        </div>

        {loading ? (
          <div className="empty-state">Loading active accounts…</div>
        ) : loans.length === 0 ? (
          <div className="empty-state">No active accounts found.</div>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Person Name</th>
                  <th className="amount-cell">Principal</th>
                  <th>Loan Date</th>
                  <th className="amount-cell">Collected</th>
                  <th>Ledger Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {loans.map((loan) => {
                  const isCleared = loan.source_paid || loan.status === 'closed'

                  return (
                    <tr key={loan.id}>
                      <td className="primary-cell">
                        <Link to={`/borrower/${loan.id}`} className="customer-link">
                          {loan.customer_name}
                        </Link>
                      </td>
                      <td className="amount-cell">{currency.format(loan.principal)}</td>
                      <td>{loan.loan_date}</td>
                      <td className="amount-cell">{currency.format(loan.total_collected)}</td>
                      <td><span className={`status-badge ${isCleared ? 'paid' : 'active'}`}>{isCleared ? 'CLEARED' : 'OUTSTANDING'}</span></td>
                      <td>
                        {isCleared ? <span className="text-success">✓ Paid</span> : <button type="button" className="secondary-button compact-button" onClick={() => { setSelectedLoan(loan); setShowPayModal(true) }}>Mark Paid</button>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {showPayModal && selectedLoan && (
        <MarkPaidModal
          isOpen={showPayModal}
          loan={selectedLoan}
          onClose={() => {
            setShowPayModal(false)
            setSelectedLoan(null)
          }}
          onSuccess={loadData}
        />
      )}
    </>
  )
}
