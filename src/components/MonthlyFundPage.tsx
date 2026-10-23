import { useEffect, useState } from 'react'
import { financeApi } from '../lib/financeApi'
import { formatDateISO } from '../lib/financeLogic'
import type { MonthlyFundCollection, MonthlyFundMember } from '../types'

const currency = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })

export function MonthlyFundPage() {
  const [members, setMembers] = useState<MonthlyFundMember[]>([])
  const [collections, setCollections] = useState<MonthlyFundCollection[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  // Collection modal / form state
  const [selectedMember, setSelectedMember] = useState<MonthlyFundMember | null>(null)
  const [collectionAmount, setCollectionAmount] = useState<number>(300)
  const [customAmountStr, setCustomAmountStr] = useState<string>('')
  const [collectionDate, setCollectionDate] = useState(() => formatDateISO(new Date()))
  const [collectionNote, setCollectionNote] = useState('')
  const [savingCollection, setSavingCollection] = useState(false)

  // Add 5th Member modal / form state
  const [showAddMemberModal, setShowAddMemberModal] = useState(false)
  const [newMemberName, setNewMemberName] = useState('')
  const [newMemberTarget, setNewMemberTarget] = useState<number>(10000)
  const [newMemberNotes, setNewMemberNotes] = useState('')
  const [savingMember, setSavingMember] = useState(false)

  // Filter state
  const [selectedMemberFilter, setSelectedMemberFilter] = useState<string>('ALL')

  const loadData = () => {
    setLoading(true)
    setError('')
    Promise.all([
      financeApi.listMonthlyFundMembers(),
      financeApi.listMonthlyFundCollections(),
    ])
      .then(([mList, cList]) => {
        setMembers(mList)
        setCollections(cList)
      })
      .catch((err) => {
        console.error('Failed to load monthly fund:', err)
        setError(err instanceof Error ? err.message : 'Unable to load Monthly Fund records.')
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadData()
  }, [])

  // Reconciled Totals
  const totalTarget = members.reduce((sum, m) => sum + m.target_amount, 0)
  const totalCollected = members.reduce((sum, m) => sum + m.total_collected, 0)
  const totalRemaining = members.reduce((sum, m) => sum + m.remaining_amount, 0)
  const completedCount = members.filter((m) => m.status === 'completed' || m.remaining_amount === 0).length

  // Handlers
  const handleOpenCollection = (member: MonthlyFundMember) => {
    setSelectedMember(member)
    // If remaining amount is less than 300, default to exact remaining
    const defaultAmt = member.remaining_amount < 300 ? member.remaining_amount : 300
    setCollectionAmount(defaultAmt)
    setCustomAmountStr('')
    setCollectionNote('')
    setCollectionDate(formatDateISO(new Date()))
  }

  const handleSaveCollection = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedMember || savingCollection) return

    const effectiveAmount = customAmountStr ? Number(customAmountStr) : collectionAmount
    if (isNaN(effectiveAmount) || effectiveAmount <= 0) {
      alert('Please enter a valid collection amount greater than 0.')
      return
    }

    if (effectiveAmount > selectedMember.remaining_amount) {
      const confirmExcess = window.confirm(
        `The amount ${currency.format(effectiveAmount)} exceeds the member's remaining target of ${currency.format(selectedMember.remaining_amount)}. Do you wish to collect and cap at exact target balance?`
      )
      if (!confirmExcess) return
    }

    setSavingCollection(true)
    try {
      await financeApi.recordMonthlyFundCollection({
        member_id: selectedMember.id,
        amount: Math.min(effectiveAmount, selectedMember.remaining_amount),
        date: collectionDate,
        note: collectionNote.trim() || undefined,
      })
      setNotice(`Recorded collection of ${currency.format(effectiveAmount)} for ${selectedMember.name}.`)
      setSelectedMember(null)
      loadData()
      setTimeout(() => setNotice(''), 4000)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to record collection.')
    } finally {
      setSavingCollection(false)
    }
  }

  const handleAddMemberSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMemberName.trim() || savingMember) return

    setSavingMember(true)
    try {
      const added = await financeApi.addMonthlyFundMember({
        name: newMemberName.trim(),
        target_amount: Number(newMemberTarget),
        notes: newMemberNotes.trim() || undefined,
      })
      setNotice(`Added new fund member ${added.name} with target ${currency.format(added.target_amount)}.`)
      setShowAddMemberModal(false)
      setNewMemberName('')
      setNewMemberTarget(10000)
      setNewMemberNotes('')
      loadData()
      setTimeout(() => setNotice(''), 4000)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to add member.')
    } finally {
      setSavingMember(false)
    }
  }

  const filteredCollections = collections.filter((c) => {
    if (selectedMemberFilter !== 'ALL' && c.member_id !== selectedMemberFilter) return false
    return true
  })

  return (
    <div className="page-shell">
      <header className="page-header">
        <div>
          <p className="eyebrow">Dedicated Fund Programme</p>
          <h1 className="page-title">Monthly Fund Management</h1>
          <p className="page-subtitle">
            Daily fixed collections (₹300 / ₹500 / custom) tracking towards individual targets. Capped upon completion.
          </p>
        </div>
        <div className="header-actions">
          <button className="primary-button" type="button" onClick={() => setShowAddMemberModal(true)}>
            + Add 5th Member
          </button>
        </div>
      </header>

      {/* Reconciled KPI Grid */}
      <div className="kpi-grid">
        <div className="kpi-card highlight-card">
          <span className="kpi-label">Total Fund Target</span>
          <span className="kpi-value">{currency.format(totalTarget)}</span>
          <span className="kpi-subtext">{members.length} members ({completedCount} completed)</span>
        </div>
        <div className="kpi-card success-card">
          <span className="kpi-label">Actual Collected</span>
          <span className="kpi-value text-positive">{currency.format(totalCollected)}</span>
          <span className="kpi-subtext">Verified fund receipts</span>
        </div>
        <div className="kpi-card danger-card">
          <span className="kpi-label">Remaining to Collect</span>
          <span className="kpi-value text-danger">{currency.format(totalRemaining)}</span>
          <span className="kpi-subtext">Unfinished member targets</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-label">Programme Status</span>
          <span className="kpi-value">
            {totalTarget > 0 ? `${Math.round((totalCollected / totalTarget) * 100)}%` : '0%'}
          </span>
          <span className="kpi-subtext">Fund completion progress</span>
        </div>
      </div>

      {notice && (
        <div className="card" style={{ marginBottom: '1.25rem', background: '#ecfdf5', borderLeft: '4px solid #10b981', color: '#065f46' }}>
          ✓ {notice}
        </div>
      )}

      {error && (
        <div className="card" style={{ marginBottom: '1.25rem', background: '#fef2f2', borderLeft: '4px solid #ef4444', color: '#991b1b' }}>
          {error}
        </div>
      )}

      {/* Target Members Grid */}
      <section className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="card-header" style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ fontSize: '1.125rem', margin: 0, fontWeight: 700 }}>Member Target Progress</h2>
            <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--muted)' }}>
              Individual ledger showing target, received amount, and completion status.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="loading-state">Loading monthly fund members…</div>
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Member Name</th>
                  <th style={{ textAlign: 'right' }}>Target Amount</th>
                  <th style={{ textAlign: 'right' }}>Collected</th>
                  <th style={{ textAlign: 'right' }}>Remaining</th>
                  <th style={{ width: '180px' }}>Progress</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'center' }}>Daily Collection</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => {
                  const pct = m.target_amount > 0 ? Math.min(100, Math.round((m.total_collected / m.target_amount) * 100)) : 0
                  const isCompleted = m.status === 'completed' || m.remaining_amount === 0

                  return (
                    <tr key={m.id}>
                      <td style={{ fontWeight: 700, fontSize: '0.9375rem' }}>{m.name}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>{currency.format(m.target_amount)}</td>
                      <td style={{ textAlign: 'right', color: 'var(--positive)', fontWeight: 700 }}>
                        {currency.format(m.total_collected)}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }} className={m.remaining_amount > 0 ? 'text-danger' : 'text-positive'}>
                        {currency.format(m.remaining_amount)}
                      </td>
                      <td>
                        <div style={{ background: '#e2e8f0', borderRadius: '999px', height: '10px', overflow: 'hidden', width: '100%' }}>
                          <div style={{ background: isCompleted ? '#10b981' : '#8b5cf6', width: `${pct}%`, height: '100%' }} />
                        </div>
                        <span style={{ fontSize: '0.6875rem', color: 'var(--muted)' }}>{pct}% complete</span>
                      </td>
                      <td>
                        <span className={`pill ${isCompleted ? 'pill-green' : 'pill-gold'}`}>
                          {isCompleted ? 'Completed' : 'Collecting'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {isCompleted ? (
                          <span style={{ fontSize: '0.8125rem', color: 'var(--muted)', fontStyle: 'italic' }}>
                            Target Reached ✓
                          </span>
                        ) : (
                          <button
                            type="button"
                            className="primary-button compact-button"
                            style={{ padding: '4px 10px', fontSize: '0.8125rem' }}
                            onClick={() => handleOpenCollection(m)}
                          >
                            + Collect
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Collection History Table */}
      <section className="card">
        <div className="card-header" style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ fontSize: '1.125rem', margin: 0, fontWeight: 700 }}>Daily Collection Receipts ({filteredCollections.length})</h2>
            <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--muted)' }}>
              Verified cash receipts logged per visit. Kept separate from loan revenue.
            </p>
          </div>
          <select
            value={selectedMemberFilter}
            onChange={(e) => setSelectedMemberFilter(e.target.value)}
            style={{ padding: '0.375rem 0.75rem', border: '1px solid var(--line)', borderRadius: '6px' }}
          >
            <option value="ALL">All Members</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </div>

        {filteredCollections.length === 0 ? (
          <div className="empty-state">
            <p>No collection receipts recorded yet.</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Receipt Date</th>
                  <th>Member Name</th>
                  <th style={{ textAlign: 'right' }}>Amount Received</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {filteredCollections.map((c) => (
                  <tr key={c.id}>
                    <td>{c.collection_date}</td>
                    <td style={{ fontWeight: 600 }}>{c.member_name}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--positive)' }}>
                      {currency.format(c.amount)}
                    </td>
                    <td style={{ fontSize: '0.8125rem', color: 'var(--muted)' }}>{c.note || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Collection Entry Modal */}
      {selectedMember && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ maxWidth: '420px', width: '90%' }}>
            <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.125rem', fontWeight: 700 }}>
              Collect for {selectedMember.name}
            </h2>
            <p style={{ margin: '0 0 1rem', fontSize: '0.8125rem', color: 'var(--muted)' }}>
              Remaining target: <strong>{currency.format(selectedMember.remaining_amount)}</strong>
            </p>

            <form onSubmit={handleSaveCollection}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.375rem' }}>
                  Quick Amount Presets
                </label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    type="button"
                    className={collectionAmount === 300 && !customAmountStr ? 'primary-button' : 'secondary-button'}
                    style={{ flex: 1, padding: '8px' }}
                    onClick={() => { setCollectionAmount(300); setCustomAmountStr(''); }}
                  >
                    ₹300
                  </button>
                  <button
                    type="button"
                    className={collectionAmount === 500 && !customAmountStr ? 'primary-button' : 'secondary-button'}
                    style={{ flex: 1, padding: '8px' }}
                    onClick={() => { setCollectionAmount(500); setCustomAmountStr(''); }}
                  >
                    ₹500
                  </button>
                  {selectedMember.remaining_amount < 500 && selectedMember.remaining_amount > 0 && (
                    <button
                      type="button"
                      className={collectionAmount === selectedMember.remaining_amount && !customAmountStr ? 'primary-button' : 'secondary-button'}
                      style={{ flex: 1, padding: '8px' }}
                      onClick={() => { setCollectionAmount(selectedMember.remaining_amount); setCustomAmountStr(''); }}
                    >
                      Exact (₹{selectedMember.remaining_amount})
                    </button>
                  )}
                </div>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.375rem' }}>
                  Or Custom Amount (₹)
                </label>
                <input
                  type="number"
                  placeholder="e.g. 400"
                  value={customAmountStr}
                  onChange={(e) => setCustomAmountStr(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--line)', borderRadius: '6px' }}
                />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.375rem' }}>
                  Collection Date
                </label>
                <input
                  type="date"
                  value={collectionDate}
                  onChange={(e) => setCollectionDate(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--line)', borderRadius: '6px' }}
                />
              </div>

              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.375rem' }}>
                  Note / Remarks (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Morning visit collection"
                  value={collectionNote}
                  onChange={(e) => setCollectionNote(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--line)', borderRadius: '6px' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setSelectedMember(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="primary-button"
                  disabled={savingCollection}
                >
                  {savingCollection ? 'Saving…' : 'Record Collection'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add 5th Member Modal */}
      {showAddMemberModal && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ maxWidth: '440px', width: '90%' }}>
            <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.125rem', fontWeight: 700 }}>
              Add 5th Monthly Fund Member
            </h2>
            <p style={{ margin: '0 0 1rem', fontSize: '0.8125rem', color: 'var(--muted)' }}>
              Enter the 5th member's name and agreed target amount.
            </p>

            <form onSubmit={handleAddMemberSubmit}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.375rem' }}>
                  Member Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. SENTHIL"
                  value={newMemberName}
                  onChange={(e) => setNewMemberName(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--line)', borderRadius: '6px' }}
                />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.375rem' }}>
                  Target Amount (₹)
                </label>
                <input
                  type="number"
                  required
                  min={1}
                  step="any"
                  value={newMemberTarget || ''}
                  onChange={(e) => setNewMemberTarget(e.target.value === '' ? 0 : Number(e.target.value))}
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--line)', borderRadius: '6px' }}
                />
              </div>

              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.375rem' }}>
                  Notes
                </label>
                <input
                  type="text"
                  placeholder="Optional notes"
                  value={newMemberNotes}
                  onChange={(e) => setNewMemberNotes(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--line)', borderRadius: '6px' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setShowAddMemberModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="primary-button"
                  disabled={savingMember}
                >
                  {savingMember ? 'Saving…' : 'Add Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
