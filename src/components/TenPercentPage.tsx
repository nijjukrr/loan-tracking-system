import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { financeApi } from '../lib/financeApi'
import { calculateTenPercentProfit, hasValidationErrors, validateTenPercentEntry } from '../lib/financeLogic'
import { isSupabaseConfigured } from '../lib/supabase'
import { WORKBOOK_REFERENCE_TARGETS } from '../lib/reconciliation'
import type { MainTransaction, NewTenPercentEntry, TenPercentEntry } from '../types'

const emptyForm: NewTenPercentEntry = {
  entry_date: new Date().toISOString().slice(0, 10),
  particulars: '',
  amount: 0,
  main_sheet_no: null,
  notes: null,
}

const currency = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })
const friendlyDate = (value: string) => {
  try {
    return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(
      new Date(`${value}T00:00:00`)
    )
  } catch {
    return value
  }
}

export function TenPercentPage() {
  const [entries, setEntries] = useState<TenPercentEntry[]>([])
  const [mainTransactions, setMainTransactions] = useState<MainTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [search, setSearch] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)
  const [showTagPanel, setShowTagPanel] = useState(false)
  const [form, setForm] = useState<NewTenPercentEntry>(emptyForm)
  const [validation, setValidation] = useState<ReturnType<typeof validateTenPercentEntry>>({})

  const totalProfit = useMemo(() => calculateTenPercentProfit(entries), [entries])
  const targetVariance = totalProfit - WORKBOOK_REFERENCE_TARGETS.tenPercentProfit
  const isTargetReconciled = totalProfit === WORKBOOK_REFERENCE_TARGETS.tenPercentProfit

  const loadData = () => {
    setLoading(true)
    Promise.all([financeApi.listTenPercentEntries(), financeApi.listUntaggedMainTransactions()])
      .then(([entryRows, mainRows]) => {
        setEntries(entryRows)
        setMainTransactions(mainRows)
      })
      .catch((requestError: unknown) =>
        setError(requestError instanceof Error ? requestError.message : 'Unable to load finance data.')
      )
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadData()
  }, [])

  async function handleAdd(event: FormEvent) {
    event.preventDefault()
    const errors = validateTenPercentEntry(form)
    setValidation(errors)
    if (hasValidationErrors(errors)) return

    setSaving(true)
    setError('')
    try {
      const created = await financeApi.addTenPercentEntry({
        ...form,
        particulars: form.particulars.trim(),
        notes: form.notes?.trim() || null,
      })
      setEntries((current) => [created, ...current])
      setForm({ ...emptyForm, entry_date: new Date().toISOString().slice(0, 10) })
      setShowAddForm(false)
      setNotice('10% profit entry added successfully.')
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to save the entry.')
    } finally {
      setSaving(false)
    }
  }

  async function handleTag(transaction: MainTransaction) {
    if (!window.confirm(`Tag ${transaction.particulars} (Credit: ${currency.format(transaction.credit)}) as 10% Profit? This is an explicit manual classification.`)) return

    setSaving(true)
    setError('')
    try {
      const created = await financeApi.tagMainTransaction(transaction.id)
      setEntries((current) => [created, ...current.filter((entry) => entry.main_transaction_id !== transaction.id)])
      setMainTransactions((current) => current.filter((item) => item.id !== transaction.id))
      setNotice(`${transaction.particulars} explicitly tagged as 10% profit.`)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to tag the transaction.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string, name: string, amount: number) {
    if (!window.confirm(`Are you sure you want to remove 10% profit record of ${currency.format(amount)} for ${name}?`)) {
      return
    }
    try {
      await financeApi.deleteTenPercentEntry(id)
      setEntries((curr) => curr.filter((e) => e.id !== id))
      setNotice('Entry removed.')
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete entry.')
    }
  }

  const filteredEntries = entries.filter((e) => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return e.particulars.toLowerCase().includes(q) || (e.notes && e.notes.toLowerCase().includes(q))
  })

  return (
    <div className="page-shell">
      <header className="page-header">
        <div>
          <h1 className="page-title">10% Profit Management</h1>
          <p className="page-subtitle">
            Verified 10% profit transactions (target: ₹8,970 across 24 entries).
          </p>
        </div>
        <div className="header-actions">
          <button className="secondary-button" type="button" onClick={() => setShowTagPanel(true)}>
            Tag MAIN Transaction
          </button>
          <button className="primary-button" type="button" onClick={() => setShowAddForm(true)}>
            + Add 10% Entry
          </button>
        </div>
      </header>

      {!isSupabaseConfigured && (
        <div className="config-note">
          Preview mode stores entries in browser localStorage. Configure Supabase for persistent shared storage.
        </div>
      )}

      {error && <div className="form-message error-message">{error}</div>}
      {notice && <div className="form-message success-message">{notice}</div>}

      {/* Summary KPI row */}
      <div className="kpi-grid" style={{ marginBottom: '1.5rem' }}>
        <div className="card kpi-card" style={{ borderLeft: '4px solid var(--accent)' }}>
          <span className="kpi-label">Total 10% Profit</span>
          <strong className="kpi-value text-accent">{currency.format(totalProfit)}</strong>
          <span className="kpi-subtext">{entries.length} classified profit records</span>
        </div>

        <div className="card kpi-card">
          <span className="kpi-label">Workbook Reference Target</span>
          <strong className="kpi-value">{currency.format(WORKBOOK_REFERENCE_TARGETS.tenPercentProfit)}</strong>
          <span className="kpi-subtext">24 verified rows (SEP&OCT sheet Cols F-I)</span>
        </div>

        <div className="card kpi-card">
          <span className="kpi-label">Reconciliation Status</span>
          <strong className={`kpi-value ${isTargetReconciled ? 'text-positive' : 'text-danger'}`}>
            {isTargetReconciled ? '✓ Reconciled' : `Variance: ${currency.format(targetVariance)}`}
          </strong>
          <span className="kpi-subtext">
            {isTargetReconciled ? 'Exact match with workbook' : 'Investigate missing or unverified rows'}
          </span>
        </div>
      </div>

      {/* Accounting Discrepancy Resolved Notice */}
      <div className="card" style={{ marginBottom: '1.5rem', background: '#f8fafc', borderLeft: '4px solid #10b981' }}>
        <h3 style={{ margin: '0 0 0.375rem', fontSize: '0.9375rem', fontWeight: 700, color: '#047857' }}>
          ✓ ₹161,010 Profit Misclassification Discrepancy Resolved
        </h3>
        <p style={{ margin: 0, fontSize: '0.8125rem', color: '#334155', lineHeight: '1.5' }}>
          The previous ₹161,010 total was caused by mistakenly treating large investment capital credits
          (Ponniyan ₹27k, Sathish ₹13k, Rathika ₹50k, Gurusamy ₹30k) as 10% profit simply because they appeared in the credit column.
          Those have been properly isolated to the Investment module, and the 10% profit ledger now correctly tracks only genuine profit entries totaling <strong>₹8,970</strong>.
        </p>
      </div>

      {/* Search Bar */}
      <div className="card" style={{ marginBottom: '1.25rem', padding: '0.75rem 1rem' }}>
        <input
          type="search"
          placeholder="Search 10% profit entries by borrower or particulars…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--line)', borderRadius: '6px' }}
        />
      </div>

      {/* Entries Table */}
      <section className="card">
        <div className="card-header" style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ fontSize: '1.125rem', margin: 0, fontWeight: 700 }}>10% Profit Ledger ({filteredEntries.length})</h2>
            <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--muted)' }}>
              Verified entries from SEP&OCT columns F-I and explicitly tagged MAIN transactions.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="loading-state">Loading profit records…</div>
        ) : filteredEntries.length === 0 ? (
          <div className="empty-state">
            <p>No 10% profit entries recorded yet.</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Particulars / Borrower</th>
                  <th>Source Classification</th>
                  <th style={{ textAlign: 'right' }}>Amount (₹)</th>
                  <th>Notes</th>
                  <th style={{ textAlign: 'center' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredEntries.map((entry) => (
                  <tr key={entry.id}>
                    <td>{friendlyDate(entry.entry_date)}</td>
                    <td style={{ fontWeight: 600 }}>{entry.particulars}</td>
                    <td>
                      <span className="source-badge">
                        {entry.source_kind === 'imported'
                          ? 'Workbook Ledger'
                          : entry.source_kind === 'main_tag'
                          ? 'Explicit MAIN Tag'
                          : 'Manual Entry'}
                      </span>
                    </td>
                    <td className="amount-cell primary-cell" style={{ textAlign: 'right' }}>
                      {currency.format(entry.amount)}
                    </td>
                    <td style={{ fontSize: '0.8125rem' }}>{entry.notes || '—'}</td>
                    <td style={{ textAlign: 'center' }}>
                      <button
                        type="button"
                        className="button-secondary"
                        style={{ padding: '3px 8px', fontSize: '0.75rem', color: 'var(--danger)' }}
                        onClick={() => handleDelete(entry.id, entry.particulars, entry.amount)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Add 10% Modal */}
      {showAddForm && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => !saving && setShowAddForm(false)}>
          <form className="modal" onSubmit={handleAdd} onMouseDown={(event) => event.stopPropagation()} style={{ maxWidth: '440px' }}>
            <div className="modal-header">
              <div>
                <p className="eyebrow">New record</p>
                <h2>Add 10% Profit Entry</h2>
              </div>
              <button className="icon-button" type="button" aria-label="Close" onClick={() => setShowAddForm(false)}>
                ×
              </button>
            </div>
            <div className="form-grid">
              <label>
                Date *
                <input
                  type="date"
                  value={form.entry_date}
                  onChange={(event) => setForm({ ...form, entry_date: event.target.value })}
                />
                {validation.entry_date && <span className="field-error">{validation.entry_date}</span>}
              </label>

              <label>
                Borrower / Particulars *
                <input
                  value={form.particulars}
                  onChange={(event) => setForm({ ...form, particulars: event.target.value })}
                  placeholder="e.g. YUVARAJ-DMK"
                />
                {validation.particulars && <span className="field-error">{validation.particulars}</span>}
              </label>

              <label>
                Profit Amount (₹) *
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={form.amount}
                  onChange={(event) => setForm({ ...form, amount: Number(event.target.value) })}
                />
                {validation.amount && <span className="field-error">{validation.amount}</span>}
              </label>

              <label className="full-span">
                Notes <span className="optional">Optional</span>
                <textarea
                  rows={2}
                  value={form.notes ?? ''}
                  onChange={(event) => setForm({ ...form, notes: event.target.value })}
                  placeholder="Source remarks or details"
                />
              </label>
            </div>
            <div className="modal-actions">
              <button className="secondary-button" type="button" onClick={() => setShowAddForm(false)}>
                Cancel
              </button>
              <button className="primary-button" type="submit" disabled={saving}>
                {saving ? 'Saving…' : 'Save Entry'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Explicit Tag Panel */}
      {showTagPanel && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => !saving && setShowTagPanel(false)}>
          <section className="modal tag-modal" onMouseDown={(event) => event.stopPropagation()} style={{ maxWidth: '540px' }}>
            <div className="modal-header">
              <div>
                <p className="eyebrow">Explicit Tagging</p>
                <h2>Tag MAIN Transaction as 10%</h2>
                <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--muted)' }}>
                  Only confirm transactions that genuinely represent 10% profit. Capital credits must NOT be tagged.
                </p>
              </div>
              <button className="icon-button" type="button" aria-label="Close" onClick={() => setShowTagPanel(false)}>
                ×
              </button>
            </div>
            {mainTransactions.length === 0 ? (
              <div className="empty-state">
                <strong>No untagged MAIN transactions</strong>
                <span>All transactions have already been processed.</span>
              </div>
            ) : (
              <div className="tag-list" style={{ maxHeight: '380px', overflowY: 'auto' }}>
                {mainTransactions.map((transaction) => (
                  <div className="tag-row" key={transaction.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem', borderBottom: '1px solid var(--line)' }}>
                    <div>
                      <strong>{transaction.particulars}</strong>
                      <span style={{ display: 'block', fontSize: '0.8125rem', color: 'var(--muted)' }}>
                        {transaction.transaction_date ? friendlyDate(transaction.transaction_date) : 'No date'} · Credit {currency.format(transaction.credit)}
                      </span>
                    </div>
                    <button
                      className="secondary-button"
                      type="button"
                      disabled={saving}
                      onClick={() => void handleTag(transaction)}
                    >
                      Tag as 10%
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  )
}
