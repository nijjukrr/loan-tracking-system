import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { financeApi } from '../lib/financeApi'
import type { DueReceivableEntry, InterestEntry, TenPercentEntry } from '../types'

const currency = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })

type IncomeTab = 'ALL' | 'DUE' | 'PROFIT' | 'INTEREST'

export function TotalIncomePage() {
  const [dues, setDues] = useState<DueReceivableEntry[]>([])
  const [profits, setProfits] = useState<TenPercentEntry[]>([])
  const [interests, setInterests] = useState<InterestEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState<IncomeTab>('ALL')

  const loadData = () => {
    setLoading(true)
    setError('')
    Promise.all([
      financeApi.listDues(),
      financeApi.listTenPercentEntries(),
      financeApi.listInterests(),
    ])
      .then(([dueData, profitData, intData]) => {
        setDues(dueData)
        setProfits(profitData)
        setInterests(intData)
      })
      .catch((err) => {
        console.error('Failed to load total income components:', err)
        setError(err instanceof Error ? err.message : 'Unable to load income records.')
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadData()
  }, [])

  const dueTotal = dues.reduce((sum, d) => sum + Number(d.remaining_amount ?? d.amount ?? 0), 0)
  const profitTotal = profits.reduce((sum, p) => sum + Number(p.amount || 0), 0)
  const interestTotal = interests.reduce((sum, i) => sum + Number(i.amount || 0), 0)
  const customTotalIncome = dueTotal + profitTotal + interestTotal

  const allItems = useMemo(() => {
    const list: Array<{
      id: string
      category: 'DUE' | 'PROFIT' | 'INTEREST'
      name: string
      date: string
      amount: number
      reference: string
      status?: string
    }> = []

    dues.forEach((d) => {
      list.push({
        id: `due-${d.id}`,
        category: 'DUE',
        name: d.borrower_name,
        date: d.due_date || '2026-10-01',
        amount: Number(d.remaining_amount ?? d.amount),
        reference: d.source_reference || 'Customer Due',
        status: d.status,
      })
    })

    profits.forEach((p) => {
      list.push({
        id: `profit-${p.id}`,
        category: 'PROFIT',
        name: p.particulars,
        date: p.entry_date,
        amount: Number(p.amount),
        reference: p.main_sheet_no ? `Sheet #${p.main_sheet_no}` : (p.notes || '10% Profit'),
      })
    })

    interests.forEach((i) => {
      list.push({
        id: `int-${i.id}`,
        category: 'INTEREST',
        name: i.customer_name,
        date: i.entry_date,
        amount: Number(i.amount),
        reference: i.ac_no ? `A/C #${i.ac_no}` : (i.source_reference || 'Interest Receipt'),
      })
    })

    return list.sort((a, b) => b.date.localeCompare(a.date))
  }, [dues, profits, interests])

  const filteredItems = useMemo(() => {
    return allItems.filter((item) => {
      if (activeTab !== 'ALL' && item.category !== activeTab) return false
      if (search.trim()) {
        const q = search.toLowerCase()
        return (
          item.name.toLowerCase().includes(q) ||
          item.reference.toLowerCase().includes(q) ||
          item.category.toLowerCase().includes(q)
        )
      }
      return true
    })
  }, [allItems, activeTab, search])

  return (
    <div className="page-shell">
      <header className="page-header">
        <div>
          <p className="eyebrow">Custom Executive Ledger Formula</p>
          <h1 className="page-title">Total Income</h1>
          <p className="page-subtitle">
            Derived ledger aggregate: <strong>Due</strong> ({currency.format(dueTotal)}) +{' '}
            <strong>Profit</strong> ({currency.format(profitTotal)}) +{' '}
            <strong>Interest</strong> ({currency.format(interestTotal)}) ={' '}
            <strong style={{ color: '#047857' }}>{currency.format(customTotalIncome)}</strong>
          </p>
        </div>
        <div className="header-actions">
          <button className="secondary-button" type="button" onClick={loadData}>
            ↻ Refresh
          </button>
        </div>
      </header>

      {error && (
        <div className="card" style={{ marginBottom: '1.5rem', background: '#fef2f2', borderLeft: '4px solid #ef4444' }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* KPI Summary Cards */}
      <div className="kpi-grid" style={{ marginBottom: '1.5rem' }}>
        <div className="kpi-card accent-card">
          <span className="kpi-label">TOTAL INCOME (CUSTOM FORMULA)</span>
          <span className="kpi-value" style={{ color: '#047857' }}>{currency.format(customTotalIncome)}</span>
          <span className="kpi-subtext">Due ({currency.format(dueTotal)}) + Profit ({currency.format(profitTotal)}) + Interest ({currency.format(interestTotal)})</span>
        </div>

        <Link to="/due" className="kpi-card danger-card" style={{ textDecoration: 'none' }}>
          <span className="kpi-label">1. OUTSTANDING DUES</span>
          <span className="kpi-value text-danger">{currency.format(dueTotal)}</span>
          <span className="kpi-subtext">{dues.length} customer receivables</span>
        </Link>

        <Link to="/profit/ten-percent" className="kpi-card highlight-card" style={{ textDecoration: 'none' }}>
          <span className="kpi-label">2. 10% PROFIT RECEIVED</span>
          <span className="kpi-value" style={{ color: '#0284c7' }}>{currency.format(profitTotal)}</span>
          <span className="kpi-subtext">{profits.length} verified ledger entries</span>
        </Link>

        <Link to="/interest" className="kpi-card highlight-card" style={{ textDecoration: 'none' }}>
          <span className="kpi-label">3. INTEREST RECEIVED</span>
          <span className="kpi-value" style={{ color: '#1d4ed8' }}>{currency.format(interestTotal)}</span>
          <span className="kpi-subtext">{interests.length} receipts verified</span>
        </Link>
      </div>

      {/* Table Section */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              className={activeTab === 'ALL' ? 'primary-button compact-button' : 'secondary-button compact-button'}
              onClick={() => setActiveTab('ALL')}
            >
              All Entries ({allItems.length})
            </button>
            <button
              type="button"
              className={activeTab === 'DUE' ? 'primary-button compact-button' : 'secondary-button compact-button'}
              onClick={() => setActiveTab('DUE')}
            >
              Dues ({dues.length} • {currency.format(dueTotal)})
            </button>
            <button
              type="button"
              className={activeTab === 'PROFIT' ? 'primary-button compact-button' : 'secondary-button compact-button'}
              onClick={() => setActiveTab('PROFIT')}
            >
              10% Profit ({profits.length} • {currency.format(profitTotal)})
            </button>
            <button
              type="button"
              className={activeTab === 'INTEREST' ? 'primary-button compact-button' : 'secondary-button compact-button'}
              onClick={() => setActiveTab('INTEREST')}
            >
              Interest ({interests.length} • {currency.format(interestTotal)})
            </button>
          </div>

          <div style={{ minWidth: '240px' }}>
            <input
              type="search"
              className="text-input"
              placeholder="Search by name, reference…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: '100%', margin: 0 }}
            />
          </div>
        </div>

        {loading ? (
          <p style={{ textAlign: 'center', padding: '2rem', color: 'var(--muted)' }}>Loading income items…</p>
        ) : filteredItems.length === 0 ? (
          <p style={{ textAlign: 'center', padding: '2rem', color: 'var(--muted)' }}>No transactions found matching your filter.</p>
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Category</th>
                  <th>Date</th>
                  <th>Payer / Particulars</th>
                  <th>Account / Reference</th>
                  <th style={{ textAlign: 'right' }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item, idx) => (
                  <tr key={item.id}>
                    <td style={{ color: 'var(--muted)', fontSize: '0.8125rem' }}>{idx + 1}</td>
                    <td>
                      <span
                        style={{
                          fontSize: '0.6875rem',
                          fontWeight: 700,
                          padding: '2px 6px',
                          borderRadius: '4px',
                          background:
                            item.category === 'DUE'
                              ? '#fef2f2'
                              : item.category === 'PROFIT'
                              ? '#f0f9ff'
                              : '#eff6ff',
                          color:
                            item.category === 'DUE'
                              ? '#dc2626'
                              : item.category === 'PROFIT'
                              ? '#0284c7'
                              : '#1d4ed8',
                        }}
                      >
                        {item.category === 'DUE' ? 'DUE (RECEIVABLE)' : item.category === 'PROFIT' ? '10% PROFIT' : 'INTEREST'}
                      </span>
                    </td>
                    <td>{item.date}</td>
                    <td>
                      <strong>{item.name}</strong>
                    </td>
                    <td style={{ color: 'var(--muted)', fontSize: '0.8125rem' }}>{item.reference}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>
                      <span
                        style={{
                          color:
                            item.category === 'DUE'
                              ? '#dc2626'
                              : item.category === 'PROFIT'
                              ? '#0284c7'
                              : '#1d4ed8',
                        }}
                      >
                        {currency.format(item.amount)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: '#f8fafc', fontWeight: 700 }}>
                  <td colSpan={5} style={{ textAlign: 'right' }}>
                    Filtered Total:
                  </td>
                  <td style={{ textAlign: 'right', color: '#047857', fontSize: '1rem' }}>
                    {currency.format(filteredItems.reduce((sum, item) => sum + item.amount, 0))}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
