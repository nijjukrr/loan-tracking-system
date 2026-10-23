import { useEffect, useState } from 'react'
import { financeApi } from '../lib/financeApi'
import { DomainValidationError, validateInvestmentInput } from '../lib/domainValidators'
import { formatDateISO } from '../lib/financeLogic'
import { WORKBOOK_REFERENCE_TARGETS } from '../lib/reconciliation'
import type { InvestmentEntry, NewInvestmentInput } from '../types'

const currency = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })

export function InvestmentsPage() {
  const [investments, setInvestments] = useState<InvestmentEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<NewInvestmentInput>({
    entry_date: formatDateISO(new Date()),
    investor_name: '',
    amount: 10000,
    notes: '',
  })
  const [search, setSearch] = useState('')

  const loadData = () => {
    setLoading(true)
    setError('')
    financeApi
      .listInvestments()
      .then((data) => setInvestments(data))
      .catch((err) => {
        console.error('Failed to load investments:', err)
        setError(err instanceof Error ? err.message : 'Unable to load investment ledger.')
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadData()
  }, [])

  const totalInvestment = investments.reduce((sum, item) => sum + Number(item.amount || 0), 0)
  const targetVariance = totalInvestment - WORKBOOK_REFERENCE_TARGETS.investmentReceived
  const isTargetReconciled = totalInvestment === WORKBOOK_REFERENCE_TARGETS.investmentReceived

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (saving) return

    setSaving(true)
    setError('')

    try {
      const payload: NewInvestmentInput = {
        entry_date: form.entry_date,
        investor_name: form.investor_name.trim(),
        amount: Number(form.amount),
        notes: form.notes?.trim() || undefined,
      }
      validateInvestmentInput(payload)
      await financeApi.addInvestment(payload)
      setShowAddModal(false)
      setForm({
        entry_date: formatDateISO(new Date()),
        investor_name: '',
        amount: 10000,
        notes: '',
      })
      loadData()
    } catch (err) {
      if (err instanceof DomainValidationError) {
        setError(`Validation error (${err.field}): ${err.message}`)
      } else {
        setError(err instanceof Error ? err.message : 'Failed to save investment.')
      }
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string, name: string, amount: number) => {
    if (!window.confirm(`Are you sure you want to delete investment of ${currency.format(amount)} from ${name}?`)) {
      return
    }
    try {
      await financeApi.deleteInvestment(id)
      loadData()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete investment.')
    }
  }

  const filteredInvestments = investments.filter((inv) => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return inv.investor_name.toLowerCase().includes(q) || (inv.notes && inv.notes.toLowerCase().includes(q))
  })

  return (
    <div className="page-shell">
      <header className="page-header">
        <div>
          <h1 className="page-title">Investment Management</h1>
          <p className="page-subtitle">
            Partner capital injections and equity funds. Distinct from profit and interest.
          </p>
        </div>
        <button className="primary-button" type="button" onClick={() => setShowAddModal(true)}>
          + Record Investment
        </button>
      </header>

      {error && <div className="form-message error-message" style={{ marginBottom: '1rem' }}>{error}</div>}

      {/* KPI Cards */}
      <div className="kpi-grid" style={{ marginBottom: '1.5rem' }}>
        <div className="card kpi-card" style={{ borderLeft: '4px solid var(--accent)' }}>
          <span className="kpi-label">Total Capital Injected</span>
          <strong className="kpi-value text-accent">{currency.format(totalInvestment)}</strong>
          <span className="kpi-subtext">{investments.length} partner capital records</span>
        </div>

        <div className="card kpi-card">
          <span className="kpi-label">Workbook Target Reference</span>
          <strong className="kpi-value">{currency.format(WORKBOOK_REFERENCE_TARGETS.investmentReceived)}</strong>
          <span className="kpi-subtext">8 partners (SEP&OCT sheet Cols P-S)</span>
        </div>

        <div className="card kpi-card">
          <span className="kpi-label">Reconciliation Status</span>
          <strong className={`kpi-value ${isTargetReconciled ? 'text-positive' : 'text-danger'}`}>
            {isTargetReconciled ? '✓ Reconciled' : `Variance: ${currency.format(targetVariance)}`}
          </strong>
          <span className="kpi-subtext">
            {isTargetReconciled ? 'Matches ₹1,85,000 ledger exactly' : 'Review entries against workbook source'}
          </span>
        </div>
      </div>

      {/* Accounting Notice */}
      <div className="card" style={{ marginBottom: '1.5rem', background: '#f8fafc', borderLeft: '4px solid #3b82f6' }}>
        <h3 style={{ margin: '0 0 0.375rem', fontSize: '0.9375rem', fontWeight: 700, color: '#1e40af' }}>
          🛡️ Fundamental Accounting Distinction: Capital vs Profit
        </h3>
        <p style={{ margin: 0, fontSize: '0.8125rem', color: '#334155', lineHeight: '1.5' }}>
          Investments represent capital contributed to finance lending operations (e.g. Ponniyan ₹27k, Rathika ₹50k, Gurusamy ₹30k).
          They are credits into the business bank/cash, but they are <strong>NEVER revenue or 10% profit</strong>.
          Treating investment credits as profit was the cause of the prior ₹161,010 error.
        </p>
      </div>

      {/* Search Bar */}
      <div className="card" style={{ marginBottom: '1.25rem', padding: '0.75rem 1rem' }}>
        <input
          type="search"
          placeholder="Search investments by investor name or notes…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--line)', borderRadius: '6px' }}
        />
      </div>

      {loading ? (
        <div className="card loading-state">Loading investment ledger…</div>
      ) : filteredInvestments.length === 0 ? (
        <div className="card empty-state">
          <p>No investment entries recorded yet.</p>
        </div>
      ) : (
        <div className="card">
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Investor Name</th>
                  <th>Entry Date</th>
                  <th style={{ textAlign: 'right' }}>Capital Contributed</th>
                  <th>Source Reference</th>
                  <th>Notes</th>
                  <th style={{ textAlign: 'center' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredInvestments.map((inv) => (
                  <tr key={inv.id}>
                    <td style={{ fontWeight: 600 }}>{inv.investor_name}</td>
                    <td>{inv.entry_date}</td>
                    <td className="amount-cell primary-cell" style={{ textAlign: 'right' }}>
                      {currency.format(inv.amount)}
                    </td>
                    <td style={{ fontSize: '0.8125rem', color: 'var(--muted)' }}>
                      {inv.source_reference || 'SEP&OCT (Cols P-S)'}
                    </td>
                    <td style={{ fontSize: '0.8125rem' }}>{inv.notes || '—'}</td>
                    <td style={{ textAlign: 'center' }}>
                      <button
                        type="button"
                        className="button-secondary"
                        style={{ padding: '3px 8px', fontSize: '0.75rem', color: 'var(--danger)' }}
                        onClick={() => handleDelete(inv.id, inv.investor_name, inv.amount)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Investment Modal */}
      {showAddModal && (
        <div className="modal-backdrop" onClick={() => !saving && setShowAddModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '440px' }}>
            <h2 style={{ marginTop: 0 }}>Record Investment Entry</h2>
            <form onSubmit={handleAddSubmit}>
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.25rem' }}>Investor / Partner Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ponniyan / Rathika"
                  value={form.investor_name}
                  onChange={(e) => setForm({ ...form, investor_name: e.target.value })}
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--line)', borderRadius: '6px' }}
                />
              </div>

              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.25rem' }}>Entry Date *</label>
                <input
                  type="date"
                  required
                  value={form.entry_date}
                  onChange={(e) => setForm({ ...form, entry_date: e.target.value })}
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--line)', borderRadius: '6px' }}
                />
              </div>

              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.25rem' }}>Capital Amount (₹) *</label>
                <input
                  type="number"
                  required
                  min="1"
                  step="500"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })}
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--line)', borderRadius: '6px' }}
                />
              </div>

              <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.25rem' }}>Notes / Remarks</label>
                <input
                  type="text"
                  placeholder="Payment mode or reference"
                  value={form.notes || ''}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--line)', borderRadius: '6px' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                <button type="button" className="button-secondary" onClick={() => setShowAddModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="primary-button" disabled={saving}>
                  {saving ? 'Saving…' : 'Save Investment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
