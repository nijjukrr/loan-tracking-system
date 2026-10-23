import { useEffect, useState } from 'react'
import { financeApi } from '../lib/financeApi'
import { formatDateISO } from '../lib/financeLogic'
import { WORKBOOK_REFERENCE_TARGETS } from '../lib/reconciliation'
import type { DueReceivableEntry, NewDueInput } from '../types'

const currency = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })

export function DuePage() {
  const [dues, setDues] = useState<DueReceivableEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'UNPAID' | 'SETTLED'>('ALL')

  // Add Due Modal
  const [showAddModal, setShowAddModal] = useState(false)
  const [savingDue, setSavingDue] = useState(false)
  const [addForm, setAddForm] = useState<NewDueInput>({
    due_date: formatDateISO(new Date()),
    borrower_name: '',
    amount: 2000,
    notes: '',
  })

  // Settle Due Modal
  const [selectedDue, setSelectedDue] = useState<DueReceivableEntry | null>(null)
  const [settleAmount, setSettleAmount] = useState<number>(0)
  const [settling, setSettling] = useState(false)

  const loadData = () => {
    setLoading(true)
    setError('')
    financeApi
      .listDues()
      .then((data) => setDues(data))
      .catch((err) => {
        console.error('Failed to load dues:', err)
        setError(err instanceof Error ? err.message : 'Unable to load dues ledger.')
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadData()
  }, [])

  const totalOriginalAmount = dues.reduce((sum, d) => sum + Number(d.amount || 0), 0)
  const totalSettledAmount = dues.reduce((sum, d) => sum + Number(d.settled_amount || 0), 0)
  const totalOutstandingDue = dues.reduce((sum, d) => sum + Number(d.remaining_amount ?? d.amount ?? 0), 0)
  const isReferenceReconciled = totalOutstandingDue === WORKBOOK_REFERENCE_TARGETS.outstandingDues

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!addForm.borrower_name.trim() || Number(addForm.amount) <= 0) {
      setError('Please provide a valid borrower name and amount greater than 0.')
      return
    }

    setSavingDue(true)
    setError('')
    try {
      await financeApi.addDue({
        due_date: addForm.due_date,
        borrower_name: addForm.borrower_name.trim(),
        amount: Number(addForm.amount),
        notes: addForm.notes?.trim() || undefined,
      })
      setShowAddModal(false)
      setAddForm({
        due_date: formatDateISO(new Date()),
        borrower_name: '',
        amount: 2000,
        notes: '',
      })
      setNotice('Due record created successfully.')
      loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add due record.')
    } finally {
      setSavingDue(false)
    }
  }

  const handleDelete = async (id: string, name: string, amount: number) => {
    if (!window.confirm(`Are you sure you want to delete the due receivable of ${currency.format(amount)} for ${name}? This action is auditable.`)) {
      return
    }
    try {
      await financeApi.deleteDue(id)
      setNotice(`Due for ${name} deleted successfully.`)
      loadData()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete due.')
    }
  }

  const handleOpenSettle = (due: DueReceivableEntry) => {
    setSelectedDue(due)
    setSettleAmount(due.remaining_amount)
  }

  const handleSettleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedDue) return
    if (settleAmount <= 0 || settleAmount > selectedDue.remaining_amount) {
      alert(`Settlement amount must be between ₹1 and ${currency.format(selectedDue.remaining_amount)}.`)
      return
    }

    setSettling(true)
    try {
      await financeApi.settleDue(selectedDue.id, settleAmount)
      setSelectedDue(null)
      setNotice(`Settlement of ${currency.format(settleAmount)} recorded for ${selectedDue.borrower_name}.`)
      loadData()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to record settlement.')
    } finally {
      setSettling(false)
    }
  }

  const filteredDues = dues.filter((due) => {
    if (statusFilter === 'UNPAID' && due.remaining_amount <= 0) return false
    if (statusFilter === 'SETTLED' && due.remaining_amount > 0) return false
    if (search.trim()) {
      const q = search.toLowerCase()
      return (
        due.borrower_name.toLowerCase().includes(q) ||
        (due.notes && due.notes.toLowerCase().includes(q)) ||
        (due.source_reference && due.source_reference.toLowerCase().includes(q))
      )
    }
    return true
  })

  return (
    <div className="page-shell">
      <header className="page-header">
        <div>
          <p className="eyebrow">Customer Receivables Ledger</p>
          <h1 className="page-title">Due Ledger</h1>
          <p className="page-subtitle">
            Manage customer receivables. Verified reference total:{' '}
            <strong style={{ color: '#dc2626' }}>₹12,000</strong> (6 historical source receivables).
          </p>
        </div>
        <div className="header-actions">
          <button className="primary-button" type="button" onClick={() => setShowAddModal(true)}>
            + Add Due
          </button>
        </div>
      </header>

      {notice && (
        <div className="card" style={{ marginBottom: '1.25rem', background: '#ecfdf5', borderLeft: '4px solid #10b981', color: '#065f46' }}>
          {notice}
        </div>
      )}

      {error && (
        <div className="card" style={{ marginBottom: '1.25rem', background: '#fef2f2', borderLeft: '4px solid #ef4444' }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* KPI Cards */}
      <div className="kpi-grid" style={{ marginBottom: '1.5rem' }}>
        <div className="kpi-card danger-card">
          <span className="kpi-label">OUTSTANDING DUES (UNCOLLECTED)</span>
          <span className="kpi-value text-danger">{currency.format(totalOutstandingDue)}</span>
          <span className="kpi-subtext">
            {isReferenceReconciled ? '✓ Exactly reconciles to ₹12,000' : `${currency.format(totalOutstandingDue)} outstanding`}
          </span>
        </div>

        <div className="kpi-card">
          <span className="kpi-label">TOTAL ORIGINAL DUES</span>
          <span className="kpi-value">{currency.format(totalOriginalAmount)}</span>
          <span className="kpi-subtext">{dues.length} total receivable records</span>
        </div>

        <div className="kpi-card accent-card">
          <span className="kpi-label">SETTLED / PAID PORTION</span>
          <span className="kpi-value" style={{ color: '#047857' }}>{currency.format(totalSettledAmount)}</span>
          <span className="kpi-subtext">{dues.filter((d) => d.status === 'settled' || d.remaining_amount === 0).length} accounts settled</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              type="button"
              className={statusFilter === 'ALL' ? 'primary-button compact-button' : 'secondary-button compact-button'}
              onClick={() => setStatusFilter('ALL')}
            >
              All Dues ({dues.length})
            </button>
            <button
              type="button"
              className={statusFilter === 'UNPAID' ? 'primary-button compact-button' : 'secondary-button compact-button'}
              onClick={() => setStatusFilter('UNPAID')}
            >
              Unpaid ({dues.filter((d) => d.remaining_amount > 0).length})
            </button>
            <button
              type="button"
              className={statusFilter === 'SETTLED' ? 'primary-button compact-button' : 'secondary-button compact-button'}
              onClick={() => setStatusFilter('SETTLED')}
            >
              Settled ({dues.filter((d) => d.remaining_amount === 0).length})
            </button>
          </div>

          <div style={{ minWidth: '240px' }}>
            <input
              type="search"
              className="text-input"
              placeholder="Search borrower, notes…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: '100%', margin: 0 }}
            />
          </div>
        </div>

        {loading ? (
          <p style={{ textAlign: 'center', padding: '2rem', color: 'var(--muted)' }}>Loading due entries…</p>
        ) : filteredDues.length === 0 ? (
          <p style={{ textAlign: 'center', padding: '2rem', color: 'var(--muted)' }}>No due records found.</p>
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Due Date</th>
                  <th>Borrower / Customer</th>
                  <th style={{ textAlign: 'right' }}>Original Amount</th>
                  <th style={{ textAlign: 'right' }}>Settled</th>
                  <th style={{ textAlign: 'right' }}>Remaining Due</th>
                  <th>Status</th>
                  <th>Source Reference</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredDues.map((item, idx) => (
                  <tr key={item.id}>
                    <td style={{ color: 'var(--muted)', fontSize: '0.8125rem' }}>{idx + 1}</td>
                    <td>{item.due_date || '—'}</td>
                    <td>
                      <strong>{item.borrower_name}</strong>
                    </td>
                    <td style={{ textAlign: 'right' }}>{currency.format(item.amount)}</td>
                    <td style={{ textAlign: 'right', color: '#047857' }}>{currency.format(item.settled_amount || 0)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: item.remaining_amount > 0 ? '#dc2626' : '#047857' }}>
                      {currency.format(item.remaining_amount)}
                    </td>
                    <td>
                      <span
                        style={{
                          fontSize: '0.6875rem',
                          fontWeight: 700,
                          padding: '2px 6px',
                          borderRadius: '4px',
                          background: item.remaining_amount === 0 ? '#ecfdf5' : '#fef2f2',
                          color: item.remaining_amount === 0 ? '#047857' : '#dc2626',
                        }}
                      >
                        {item.remaining_amount === 0 ? 'SETTLED' : item.settled_amount > 0 ? 'PARTIAL' : 'UNPAID'}
                      </span>
                    </td>
                    <td style={{ color: 'var(--muted)', fontSize: '0.75rem' }}>
                      {item.source_reference || item.notes || 'Manual Entry'}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '0.375rem' }}>
                        {item.remaining_amount > 0 && (
                          <button
                            type="button"
                            className="primary-button compact-button"
                            onClick={() => handleOpenSettle(item)}
                            title="Record payment towards this due"
                          >
                            Settle
                          </button>
                        )}
                        <button
                          type="button"
                          className="secondary-button compact-button"
                          style={{ color: '#ef4444' }}
                          onClick={() => handleDelete(item.id, item.borrower_name, item.amount)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: '#f8fafc', fontWeight: 700 }}>
                  <td colSpan={3} style={{ textAlign: 'right' }}>
                    Total:
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {currency.format(filteredDues.reduce((sum, item) => sum + item.amount, 0))}
                  </td>
                  <td style={{ textAlign: 'right', color: '#047857' }}>
                    {currency.format(filteredDues.reduce((sum, item) => sum + (item.settled_amount || 0), 0))}
                  </td>
                  <td style={{ textAlign: 'right', color: '#dc2626', fontSize: '1rem' }}>
                    {currency.format(filteredDues.reduce((sum, item) => sum + item.remaining_amount, 0))}
                  </td>
                  <td colSpan={3} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Add Due Modal */}
      {showAddModal && (
        <div className="modal-backdrop" onClick={() => setShowAddModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <h2 style={{ margin: '0 0 1rem' }}>Add Customer Due</h2>
            <form onSubmit={handleAddSubmit}>
              <div style={{ marginBottom: '0.75rem' }}>
                <label className="input-label" htmlFor="due-date-input">Due Date</label>
                <input
                  id="due-date-input"
                  type="date"
                  className="text-input"
                  required
                  value={addForm.due_date}
                  onChange={(e) => setAddForm({ ...addForm, due_date: e.target.value })}
                />
              </div>

              <div style={{ marginBottom: '0.75rem' }}>
                <label className="input-label" htmlFor="due-borrower-input">Borrower / Customer Name</label>
                <input
                  id="due-borrower-input"
                  type="text"
                  className="text-input"
                  required
                  placeholder="e.g. SENTHIL"
                  value={addForm.borrower_name}
                  onChange={(e) => setAddForm({ ...addForm, borrower_name: e.target.value })}
                />
              </div>

              <div style={{ marginBottom: '0.75rem' }}>
                <label className="input-label" htmlFor="due-amount-input">Amount (₹)</label>
                <input
                  id="due-amount-input"
                  type="number"
                  min="1"
                  step="any"
                  className="text-input"
                  required
                  value={addForm.amount || ''}
                  onChange={(e) => setAddForm({ ...addForm, amount: e.target.value === '' ? 0 : Number(e.target.value) })}
                />
              </div>

              <div style={{ marginBottom: '1.25rem' }}>
                <label className="input-label" htmlFor="due-notes-input">Notes (Optional)</label>
                <input
                  id="due-notes-input"
                  type="text"
                  className="text-input"
                  placeholder="e.g. Balance from previous loan"
                  value={addForm.notes || ''}
                  onChange={(e) => setAddForm({ ...addForm, notes: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                <button type="button" className="secondary-button" onClick={() => setShowAddModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="primary-button" disabled={savingDue}>
                  {savingDue ? 'Saving…' : 'Save Due'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Settle Due Modal */}
      {selectedDue && (
        <div className="modal-backdrop" onClick={() => setSelectedDue(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '440px' }}>
            <h2 style={{ margin: '0 0 0.5rem' }}>Settle Due</h2>
            <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: 'var(--muted)' }}>
              Recording settlement for <strong>{selectedDue.borrower_name}</strong> (Outstanding:{' '}
              <strong style={{ color: '#dc2626' }}>{currency.format(selectedDue.remaining_amount)}</strong>)
            </p>

            <form onSubmit={handleSettleSubmit}>
              <div style={{ marginBottom: '1rem' }}>
                <label className="input-label" htmlFor="settle-amount-input">Amount Received (₹)</label>
                <input
                  id="settle-amount-input"
                  type="number"
                  min="1"
                  max={selectedDue.remaining_amount}
                  step="1"
                  className="text-input"
                  required
                  value={settleAmount}
                  onChange={(e) => setSettleAmount(Number(e.target.value))}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                <button type="button" className="secondary-button" onClick={() => setSelectedDue(null)}>
                  Cancel
                </button>
                <button type="submit" className="primary-button" disabled={settling}>
                  {settling ? 'Recording…' : 'Record Settlement'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
