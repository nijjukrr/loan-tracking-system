import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { financeApi } from '../lib/financeApi'
import type { Customer, DueReceivableEntry, Loan } from '../types'

export function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loans, setLoans] = useState<Loan[]>([])
  const [dues, setDues] = useState<DueReceivableEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [newCustomer, setNewCustomer] = useState({ name: '', phone: '', address: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const loadData = async () => {
    setLoading(true)
    try {
      const [custs, allLoans, allDues] = await Promise.all([
        financeApi.listPeople(),
        financeApi.listLoans(),
        financeApi.listDues(),
      ])
      setCustomers(custs)
      setLoans(allLoans)
      setDues(allDues)
    } catch (err) {
      console.error('Failed to load customers:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadData()
  }, [])

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newCustomer.name.trim()) {
      setError('Customer name is required.')
      return
    }
    setSaving(true)
    setError('')
    try {
      await financeApi.createCustomer(newCustomer)
      setShowAddModal(false)
      setNewCustomer({ name: '', phone: '', address: '' })
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save customer.')
    } finally {
      setSaving(false)
    }
  }

  // Derive unique customer representations from both Customer entries and distinct loan borrowers
  const customerMap = new Map<string, {
    id: string
    name: string
    phone?: string | null
    address?: string | null
    activeLoans: Loan[]
    closedLoans: Loan[]
    linkedDues: DueReceivableEntry[]
    totalPrincipal: number
    totalRemaining: number
  }>()

  // First seed from customers
  for (const c of customers) {
    customerMap.set(c.name.toLowerCase().trim(), {
      id: c.id,
      name: c.name,
      phone: c.phone,
      address: c.address,
      activeLoans: [],
      closedLoans: [],
      linkedDues: [],
      totalPrincipal: 0,
      totalRemaining: 0,
    })
  }

  // Next seed/enrich from loans
  for (const l of loans) {
    const key = l.customer_name.toLowerCase().trim()
    let record = customerMap.get(key)
    if (!record) {
      record = {
        id: l.customer_id || l.id,
        name: l.customer_name,
        phone: null,
        address: null,
        activeLoans: [],
        closedLoans: [],
        linkedDues: [],
        totalPrincipal: 0,
        totalRemaining: 0,
      }
      customerMap.set(key, record)
    }
    if (l.status === 'active') {
      record.activeLoans.push(l)
    } else {
      record.closedLoans.push(l)
    }
    record.totalPrincipal += l.principal
    record.totalRemaining += l.remaining_balance
  }

  // Seed/enrich from dues
  for (const d of dues) {
    const key = d.borrower_name.toLowerCase().trim()
    let record = customerMap.get(key)
    if (!record) {
      record = {
        id: d.id,
        name: d.borrower_name,
        phone: null,
        address: null,
        activeLoans: [],
        closedLoans: [],
        linkedDues: [],
        totalPrincipal: 0,
        totalRemaining: 0,
      }
      customerMap.set(key, record)
    }
    record.linkedDues.push(d)
  }

  const allRecords = [...customerMap.values()].filter((item) => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return item.name.toLowerCase().includes(q) || (item.phone && item.phone.includes(q))
  })

  const formatINR = (val: number) => `₹${Math.round(val).toLocaleString('en-IN')}`

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <h1 className="page-title">Borrowers & Customers</h1>
          <p className="page-subtitle">Manage customer profiles, lending history, and active obligations.</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="primary-button" type="button" onClick={() => setShowAddModal(true)}>
            + Add Borrower
          </button>
        </div>
      </div>

      {/* Summary KPI row */}
      <div className="kpi-grid" style={{ marginBottom: '1.5rem' }}>
        <div className="card kpi-card">
          <span className="kpi-label">Total Borrowers</span>
          <strong className="kpi-value">{customerMap.size}</strong>
          <span className="kpi-subtext">Active & historical accounts</span>
        </div>
        <div className="card kpi-card">
          <span className="kpi-label">Active Borrowers</span>
          <strong className="kpi-value text-accent">
            {[...customerMap.values()].filter((c) => c.activeLoans.length > 0).length}
          </strong>
          <span className="kpi-subtext">Currently holding open loans</span>
        </div>
        <div className="card kpi-card">
          <span className="kpi-label">Total Principal Borrowed</span>
          <strong className="kpi-value">
            {formatINR([...customerMap.values()].reduce((sum, c) => sum + c.totalPrincipal, 0))}
          </strong>
          <span className="kpi-subtext">Cumulative loan capital</span>
        </div>
        <div className="card kpi-card">
          <span className="kpi-label">Outstanding Balances</span>
          <strong className="kpi-value text-gold">
            {formatINR([...customerMap.values()].reduce((sum, c) => sum + c.totalRemaining, 0))}
          </strong>
          <span className="kpi-subtext">Principal & fees receivable</span>
        </div>
      </div>

      {/* Search Bar */}
      <div className="card" style={{ marginBottom: '1.25rem', padding: '0.75rem 1rem' }}>
        <input
          type="text"
          className="search-input"
          placeholder="Search borrowers by name or phone…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--line)', borderRadius: '6px' }}
        />
      </div>

      {loading ? (
        <div className="card loading-state">Loading borrowers…</div>
      ) : allRecords.length === 0 ? (
        <div className="card empty-state">
          <p>No borrowers found matching your search.</p>
        </div>
      ) : (
        <div className="card">
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Borrower Name</th>
                  <th>Contact Details</th>
                  <th style={{ textAlign: 'center' }}>Active Loans</th>
                  <th style={{ textAlign: 'center' }}>Closed Loans</th>
                  <th style={{ textAlign: 'right' }}>Total Borrowed</th>
                  <th style={{ textAlign: 'right' }}>Remaining Balance</th>
                  <th style={{ textAlign: 'right' }}>Unpaid Dues</th>
                  <th style={{ textAlign: 'center' }}>Portfolio Actions</th>
                </tr>
              </thead>
              <tbody>
                {allRecords.map((c) => {
                  const representativeLoanId = c.activeLoans[0]?.id || c.closedLoans[0]?.id
                  const dueSum = c.linkedDues.reduce((sum, d) => sum + d.remaining_amount, 0)
                  return (
                    <tr key={c.id}>
                      <td style={{ fontWeight: 600 }}>
                        {representativeLoanId ? (
                          <Link to={`/borrower/${representativeLoanId}`} style={{ color: 'var(--ink)', textDecoration: 'none' }}>
                            {c.name}
                          </Link>
                        ) : (
                          c.name
                        )}
                      </td>
                      <td style={{ fontSize: '0.8125rem', color: 'var(--muted)' }}>
                        {c.phone || c.address ? [c.phone, c.address].filter(Boolean).join(' • ') : '—'}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {c.activeLoans.length > 0 ? (
                          <span className="pill pill-green">{c.activeLoans.length} Active</span>
                        ) : (
                          <span className="pill pill-gray">0</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {c.closedLoans.length > 0 ? (
                          <span className="pill pill-gray">{c.closedLoans.length} Closed</span>
                        ) : (
                          '0'
                        )}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatINR(c.totalPrincipal)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600, color: c.totalRemaining > 0 ? 'var(--warning)' : 'inherit' }}>
                        {formatINR(c.totalRemaining)}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600, color: dueSum > 0 ? 'var(--danger)' : 'var(--muted)' }}>
                        {dueSum > 0 ? formatINR(dueSum) : '—'}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {representativeLoanId && (
                          <Link to={`/borrower/${representativeLoanId}`} className="button-secondary" style={{ padding: '4px 10px', fontSize: '0.8125rem' }}>
                            View Portfolio →
                          </Link>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Borrower Modal */}
      {showAddModal && (
        <div className="modal-backdrop" onClick={() => setShowAddModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '440px' }}>
            <h2 style={{ marginTop: 0 }}>Add New Borrower</h2>
            {error && <div className="error-banner" style={{ marginBottom: '1rem' }}>{error}</div>}
            <form onSubmit={handleCreateCustomer}>
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.25rem' }}>Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ramesh Kumar"
                  value={newCustomer.name}
                  onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--line)', borderRadius: '6px' }}
                />
              </div>

              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.25rem' }}>Phone Number</label>
                <input
                  type="text"
                  placeholder="10-digit mobile number"
                  value={newCustomer.phone}
                  onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--line)', borderRadius: '6px' }}
                />
              </div>

              <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.25rem' }}>Address / Notes</label>
                <input
                  type="text"
                  placeholder="Area, street, or borrower remarks"
                  value={newCustomer.address}
                  onChange={(e) => setNewCustomer({ ...newCustomer, address: e.target.value })}
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--line)', borderRadius: '6px' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                <button type="button" className="button-secondary" onClick={() => setShowAddModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="primary-button" disabled={saving}>
                  {saving ? 'Saving…' : 'Create Profile'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
