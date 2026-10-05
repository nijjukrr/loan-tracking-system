import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { financeApi } from '../lib/financeApi'
import { calculateTenPercentProfit, hasValidationErrors, validateTenPercentEntry } from '../lib/financeLogic'
import { isSupabaseConfigured } from '../lib/supabase'
import type { MainTransaction, NewTenPercentEntry, TenPercentEntry } from '../types'

const emptyForm: NewTenPercentEntry = {
  entry_date: new Date().toISOString().slice(0, 10), particulars: '', amount: 0, main_sheet_no: null, notes: null,
}

const currency = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 })
const friendlyDate = (value: string) => new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(`${value}T00:00:00`))

export function TenPercentPage() {
  const [entries, setEntries] = useState<TenPercentEntry[]>([])
  const [mainTransactions, setMainTransactions] = useState<MainTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)
  const [showTagPanel, setShowTagPanel] = useState(false)
  const [form, setForm] = useState<NewTenPercentEntry>(emptyForm)
  const [validation, setValidation] = useState<ReturnType<typeof validateTenPercentEntry>>({})
  const totalProfit = useMemo(() => calculateTenPercentProfit(entries), [entries])

  useEffect(() => {
    Promise.all([financeApi.listTenPercentEntries(), financeApi.listUntaggedMainTransactions()])
      .then(([entryRows, mainRows]) => { setEntries(entryRows); setMainTransactions(mainRows) })
      .catch((requestError: unknown) => setError(requestError instanceof Error ? requestError.message : 'Unable to load finance data.'))
      .finally(() => setLoading(false))
  }, [])

  async function handleAdd(event: FormEvent) {
    event.preventDefault()
    const errors = validateTenPercentEntry(form)
    setValidation(errors)
    if (hasValidationErrors(errors)) return
    setSaving(true); setError('')
    try {
      const created = await financeApi.addTenPercentEntry({ ...form, particulars: form.particulars.trim(), notes: form.notes?.trim() || null })
      setEntries((current) => [created, ...current])
      setForm({ ...emptyForm, entry_date: new Date().toISOString().slice(0, 10) })
      setShowAddForm(false); setNotice('10% entry added.')
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to save the entry.')
    } finally { setSaving(false) }
  }

  async function handleTag(transaction: MainTransaction) {
    if (!window.confirm(`Tag MAIN #${transaction.main_sheet_no} (${transaction.particulars}) as 10%? This is an explicit manual classification.`)) return
    setSaving(true); setError('')
    try {
      const created = await financeApi.tagMainTransaction(transaction.id)
      setEntries((current) => [created, ...current.filter((entry) => entry.main_transaction_id !== transaction.id)])
      setMainTransactions((current) => current.filter((item) => item.id !== transaction.id))
      setNotice(`MAIN #${transaction.main_sheet_no} tagged as 10%.`)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to tag the transaction.')
    } finally { setSaving(false) }
  }

  return (
    <>
        <header className="page-header">
          <div><p className="eyebrow">Profit entries</p><h1>10% Profit</h1><p className="page-description">Only manually added or explicitly tagged transactions appear here.</p></div>
          <div className="header-actions"><button className="secondary-button" type="button" onClick={() => setShowTagPanel(true)}>Tag MAIN transaction</button><button className="primary-button" type="button" onClick={() => setShowAddForm(true)}>+ Add 10% Entry</button></div>
        </header>

        {!isSupabaseConfigured && <div className="config-note">Preview mode stores entries only in this browser. Add Supabase environment variables for shared private data.</div>}
        {error && <div className="form-message error-message">{error}</div>}
        {notice && <div className="form-message success-message">{notice}</div>}
        <section className="profit-card" aria-label="Total 10 percent profit"><span>Total 10% Profit</span><strong>{currency.format(totalProfit)}</strong><small>{entries.length} {entries.length === 1 ? 'entry' : 'entries'}</small></section>

        <section className="table-card">
          <div className="table-heading"><div><h2>Entries</h2><p>Manual records and transactions explicitly tagged from MAIN.</p></div></div>
          {loading ? <div className="empty-state">Loading entries…</div> : entries.length === 0 ? <div className="empty-state"><strong>No 10% entries yet</strong><span>Current imported profit is {currency.format(0)}.</span></div> : (
            <div className="table-scroll"><table><thead><tr><th>Date</th><th>Particulars</th><th>Main Sheet No</th><th>Source</th><th className="amount-cell">Amount</th><th>Notes</th></tr></thead><tbody>{entries.map((entry) => <tr key={entry.id}><td>{friendlyDate(entry.entry_date)}</td><td className="primary-cell">{entry.particulars}</td><td>{entry.main_sheet_no ?? '—'}</td><td><span className="source-badge">{entry.source_kind === 'main_tag' ? 'MAIN tag' : 'Manual'}</span></td><td className="amount-cell">{currency.format(entry.amount)}</td><td>{entry.notes || '—'}</td></tr>)}</tbody></table></div>
          )}
        </section>
      {showAddForm && <div className="modal-backdrop" role="presentation" onMouseDown={() => !saving && setShowAddForm(false)}><form className="modal" onSubmit={handleAdd} onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-header"><div><p className="eyebrow">New record</p><h2>Add 10% Entry</h2></div><button className="icon-button" type="button" aria-label="Close" onClick={() => setShowAddForm(false)}>×</button></div>
        <div className="form-grid">
          <label>Date<input type="date" value={form.entry_date} onChange={(event) => setForm({ ...form, entry_date: event.target.value })} />{validation.entry_date && <span className="field-error">{validation.entry_date}</span>}</label>
          <label>Name / Particulars<input value={form.particulars} onChange={(event) => setForm({ ...form, particulars: event.target.value })} placeholder="Customer or transaction name" />{validation.particulars && <span className="field-error">{validation.particulars}</span>}</label>
          <label>Amount<input type="number" min="0.01" step="0.01" value={form.amount} onChange={(event) => setForm({ ...form, amount: Number(event.target.value) })} />{validation.amount && <span className="field-error">{validation.amount}</span>}</label>
          <label>Main Sheet No <span className="optional">Optional</span><input type="number" min="1" step="1" value={form.main_sheet_no ?? ''} onChange={(event) => setForm({ ...form, main_sheet_no: event.target.value ? Number(event.target.value) : null })} />{validation.main_sheet_no && <span className="field-error">{validation.main_sheet_no}</span>}</label>
          <label className="full-span">Notes <span className="optional">Optional</span><textarea rows={3} value={form.notes ?? ''} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder="Add a short note" /></label>
        </div>
        <div className="modal-actions"><button className="secondary-button" type="button" onClick={() => setShowAddForm(false)}>Cancel</button><button className="primary-button" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save entry'}</button></div>
      </form></div>}

      {showTagPanel && <div className="modal-backdrop" role="presentation" onMouseDown={() => !saving && setShowTagPanel(false)}><section className="modal tag-modal" onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-header"><div><p className="eyebrow">Explicit classification</p><h2>Tag MAIN transaction</h2><p>Nothing is classified automatically.</p></div><button className="icon-button" type="button" aria-label="Close" onClick={() => setShowTagPanel(false)}>×</button></div>
        {mainTransactions.length === 0 ? <div className="empty-state"><strong>No untagged MAIN transactions available</strong><span>Imported MAIN records will appear here when available.</span></div> : <div className="tag-list">{mainTransactions.map((transaction) => <div className="tag-row" key={transaction.id}><div><strong>#{transaction.main_sheet_no} · {transaction.particulars}</strong><span>{transaction.transaction_date ? friendlyDate(transaction.transaction_date) : 'No date'} · Credit {currency.format(transaction.credit)}</span></div><button className="secondary-button" type="button" disabled={saving} onClick={() => void handleTag(transaction)}>Tag as 10%</button></div>)}</div>}
      </section></div>}
    </>
  )
}
