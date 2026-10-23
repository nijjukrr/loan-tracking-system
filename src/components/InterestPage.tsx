import { useEffect, useState } from 'react'
import { financeApi } from '../lib/financeApi'
import { DomainValidationError, validateInterestInput } from '../lib/domainValidators'
import { formatDateISO } from '../lib/financeLogic'
import { WORKBOOK_REFERENCE_TARGETS } from '../lib/reconciliation'
import type { InterestEntry, NewInterestInput } from '../types'

const currency = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })

export function InterestPage() {
  const [interests, setInterests] = useState<InterestEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<NewInterestInput>({
    entry_date: formatDateISO(new Date()),
    customer_name: '',
    ac_no: undefined,
    amount: 500,
    notes: '',
  })
  const [search, setSearch] = useState('')

  const loadData = () => {
    setLoading(true)
    setError('')
    financeApi
      .listInterests()
      .then((data) => setInterests(data))
      .catch((err) => {
        console.error('Failed to load interest entries:', err)
        setError(err instanceof Error ? err.message : 'Unable to load interest ledger.')
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadData()
  }, [])

  const totalInterest = interests.reduce((sum, item) => sum + Number(item.amount || 0), 0)

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (saving) return

    setSaving(true)
    setError('')

    try {
      const payload: NewInterestInput = {
        entry_date: form.entry_date,
        customer_name: form.customer_name.trim(),
        ac_no: form.ac_no ? Number(form.ac_no) : undefined,
        amount: Number(form.amount),
        notes: form.notes?.trim() || undefined,
      }
      validateInterestInput(payload)
      await financeApi.addInterest(payload)
      setShowAddModal(false)
      setForm({
        entry_date: formatDateISO(new Date()),
        customer_name: '',
        ac_no: undefined,
        amount: 500,
        notes: '',
      })
      loadData()
    } catch (err) {
      if (err instanceof DomainValidationError) {
        setError(`Validation error (${err.field}): ${err.message}`)
      } else {
        setError(err instanceof Error ? err.message : 'Failed to save interest entry.')
      }
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string, name: string, amount: number) => {
    if (!window.confirm(`Are you sure you want to delete interest entry of ${currency.format(amount)} from ${name}?`)) {
      return
    }
    try {
      await financeApi.deleteInterest(id)
      loadData()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete interest entry.')
    }
  }

  const filteredInterests = interests.filter((item) => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (
      item.customer_name.toLowerCase().includes(q) ||
      (item.notes && item.notes.toLowerCase().includes(q)) ||
      (item.ac_no && String(item.ac_no).includes(q))
    )
  })

  return (
    <div className="page-shell">
      <header className="page-header">
        <div>
          <h1 className="page-title">Interest Collection Tracking</h1>
          <p className="page-subtitle">
            Interest income physically received from borrowers (reconciling to ₹4,950 target).
          </p>
        </div>
        <button className="primary-button" type="button" onClick={() => setShowAddModal(true)}>
          + Record Interest
        </button>
      </header>

      {error && <div className="form-message error-message" style={{ marginBottom: '1rem' }}>{error}</div>}

      {/* KPI Cards */}
      <div className="kpi-grid" style={{ marginBottom: '1.5rem' }}>
        <div className="card kpi-card" style={{ borderLeft: '4px solid var(--accent)' }}>
          <span className="kpi-label">Total Interest Collected</span>
          <strong className="kpi-value text-accent">{currency.format(totalInterest)}</strong>
          <span className="kpi-subtext">{interests.length} verified interest receipts</span>
        </div>

        <div className="card kpi-card">
          <span className="kpi-label">Workbook Target Reference</span>
          <strong className="kpi-value">{currency.format(WORKBOOK_REFERENCE_TARGETS.interestReceived)}</strong>
          <span className="kpi-subtext">9 entries (SEP&OCT sheet Cols K-N)</span>
        </div>
      </div>

      {/* Search Bar */}
      <div className="card" style={{ marginBottom: '1.25rem', padding: '0.75rem 1rem' }}>
        <input
          type="search"
          placeholder="Search by customer name, account number or notes…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--line)', borderRadius: '6px' }}
        />
      </div>

      {loading ? (
        <div className="card loading-state">Loading interest receipts…</div>
      ) : filteredInterests.length === 0 ? (
        <div className="card empty-state">
          <p>No interest collection records found.</p>
        </div>
      ) : (
        <div className="card">
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Customer Name</th>
                  <th>Receipt Date</th>
                  <th style={{ textAlign: 'center' }}>Account #</th>
                  <th style={{ textAlign: 'right' }}>Interest Received</th>
                  <th>Notes</th>
                  <th style={{ textAlign: 'center' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredInterests.map((item) => (
                  <tr key={item.id}>
                    <td style={{ fontWeight: 600 }}>{item.customer_name}</td>
                    <td>{item.entry_date}</td>
                    <td style={{ textAlign: 'center' }}>
                      {item.ac_no ? <span className="pill pill-gray">#{item.ac_no}</span> : '—'}
                    </td>
                    <td className="amount-cell primary-cell" style={{ textAlign: 'right' }}>
                      {currency.format(item.amount)}
                    </td>
                    <td style={{ fontSize: '0.8125rem' }}>{item.notes || '—'}</td>
                    <td style={{ textAlign: 'center' }}>
                      <button
                        type="button"
                        className="button-secondary"
                        style={{ padding: '3px 8px', fontSize: '0.75rem', color: 'var(--danger)' }}
                        onClick={() => handleDelete(item.id, item.customer_name, item.amount)}
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

      {/* Add Interest Modal */}
      {showAddModal && (
        <div className="modal-backdrop" onClick={() => !saving && setShowAddModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '440px' }}>
            <h2 style={{ marginTop: 0 }}>Record Interest Collection</h2>
            <form onSubmit={handleAddSubmit}>
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.25rem' }}>Customer / Borrower Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Yuvaraj-DMK / Prakash"
                  value={form.customer_name}
                  onChange={(e) => setForm({ ...form, customer_name: e.target.value })}
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--line)', borderRadius: '6px' }}
                />
              </div>

              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.25rem' }}>Receipt Date *</label>
                <input
                  type="date"
                  required
                  value={form.entry_date}
                  onChange={(e) => setForm({ ...form, entry_date: e.target.value })}
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--line)', borderRadius: '6px' }}
                />
              </div>

              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.25rem' }}>Account / Sheet No</label>
                <input
                  type="number"
                  placeholder="e.g. 5 (optional)"
                  value={form.ac_no || ''}
                  onChange={(e) => setForm({ ...form, ac_no: e.target.value ? Number(e.target.value) : undefined })}
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--line)', borderRadius: '6px' }}
                />
              </div>

              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.25rem' }}>Interest Amount (₹) *</label>
                <input
                  type="number"
                  required
                  min="1"
                  step="any"
                  value={form.amount || ''}
                  onChange={(e) => setForm({ ...form, amount: e.target.value === '' ? 0 : Number(e.target.value) })}
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--line)', borderRadius: '6px' }}
                />
              </div>

              <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.25rem' }}>Notes / Remarks</label>
                <input
                  type="text"
                  placeholder="Cycle or mode details"
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
                  {saving ? 'Saving…' : 'Save Interest'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
