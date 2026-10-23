import { useEffect, useState } from 'react'
import { financeApi } from '../lib/financeApi'
import { formatDateISO } from '../lib/financeLogic'
import type {
  SweetFundInstallment,
  SweetFundMember,
  SweetFundPayment,
  SweetFundProgramme,
} from '../types'

const currency = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
})

export function SweetFundPage() {
  const [programme, setProgramme] = useState<SweetFundProgramme | null>(null)
  const [members, setMembers] = useState<SweetFundMember[]>([])
  const [payments, setPayments] = useState<SweetFundPayment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  // Member drawer / schedule view
  const [selectedMember, setSelectedMember] = useState<SweetFundMember | null>(null)
  const [memberInstallments, setMemberInstallments] = useState<SweetFundInstallment[]>([])
  const [loadingInstallments, setLoadingInstallments] = useState(false)

  // Payment recording state
  const [payingInstallment, setPayingInstallment] = useState<SweetFundInstallment | null>(null)
  const [paymentAmount, setPaymentAmount] = useState<number>(200)
  const [paymentDate, setPaymentDate] = useState(() => formatDateISO(new Date()))
  const [paymentNote, setPaymentNote] = useState('')
  const [savingPayment, setSavingPayment] = useState(false)

  // Add Member Modal
  const [showAddMemberModal, setShowAddMemberModal] = useState(false)
  const [newMemberName, setNewMemberName] = useState('')
  const [newMemberPhone, setNewMemberPhone] = useState('')
  const [savingMember, setSavingMember] = useState(false)

  // Programme Config Modal
  const [showConfigModal, setShowConfigModal] = useState(false)
  const [configStartDate, setConfigStartDate] = useState('2026-11-01')
  const [configDiwaliDate, setConfigDiwaliDate] = useState('2027-10-20')
  const [configW1Amt, setConfigW1Amt] = useState(500)
  const [configWRegAmt, setConfigWRegAmt] = useState(200)
  const [savingConfig, setSavingConfig] = useState(false)

  // Excel / CSV Importer Modal
  const [showImportModal, setShowImportModal] = useState(false)
  const [csvText, setCsvText] = useState('')
  const [importPreview, setImportPreview] = useState<Array<{ name: string; phone?: string }>>([])
  const [importing, setImporting] = useState(false)

  // Search
  const [searchQuery, setSearchQuery] = useState('')

  const loadData = () => {
    setLoading(true)
    setError('')
    Promise.all([
      financeApi.getSweetFundProgramme(),
      financeApi.listSweetFundMembers(),
      financeApi.listSweetFundPayments(),
    ])
      .then(([prog, mList, pList]) => {
        setProgramme(prog)
        setMembers(mList)
        setPayments(pList)
        setConfigStartDate(prog.start_date || '2026-11-01')
        setConfigDiwaliDate(prog.target_end_date || '2027-10-20')
        setConfigW1Amt(prog.week_1_amount || 500)
        setConfigWRegAmt(prog.week_regular_amount || 200)
      })
      .catch((err) => {
        console.error('Failed to load sweet fund data:', err)
        setError(err instanceof Error ? err.message : 'Unable to load Sweet Fund records.')
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleOpenMemberSchedule = async (member: SweetFundMember) => {
    setSelectedMember(member)
    setLoadingInstallments(true)
    try {
      const insts = await financeApi.listSweetFundInstallments(member.id)
      setMemberInstallments(insts)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to load installment schedule.')
    } finally {
      setLoadingInstallments(false)
    }
  }

  const handleOpenPayment = (inst: SweetFundInstallment) => {
    setPayingInstallment(inst)
    const dueAmount = inst.expected_amount - inst.paid_amount
    setPaymentAmount(dueAmount > 0 ? dueAmount : inst.expected_amount)
    setPaymentDate(formatDateISO(new Date()))
    setPaymentNote('')
  }

  const handleSavePayment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedMember || !payingInstallment || savingPayment) return

    const amt = Number(paymentAmount)
    if (isNaN(amt) || amt <= 0) {
      alert('Please enter a valid payment amount greater than zero.')
      return
    }

    setSavingPayment(true)
    try {
      await financeApi.recordSweetFundPayment({
        member_id: selectedMember.id,
        installment_id: payingInstallment.id,
        amount: amt,
        payment_date: paymentDate,
        note: paymentNote.trim() || undefined,
      })

      setNotice(
        `Recorded ${currency.format(amt)} for ${selectedMember.member_name} (Week ${payingInstallment.week_number}).`
      )
      setPayingInstallment(null)

      // Refresh schedule
      const insts = await financeApi.listSweetFundInstallments(selectedMember.id)
      setMemberInstallments(insts)

      // Refresh parent data
      loadData()
      setTimeout(() => setNotice(''), 4000)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to record payment.')
    } finally {
      setSavingPayment(false)
    }
  }

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMemberName.trim() || savingMember) return

    setSavingMember(true)
    try {
      const added = await financeApi.addSweetFundMember({
        member_name: newMemberName.trim(),
        phone: newMemberPhone.trim() || undefined,
      })
      setNotice(`Added participant #${added.member_number} ${added.member_name} with 50-week schedule.`)
      setShowAddMemberModal(false)
      setNewMemberName('')
      setNewMemberPhone('')
      loadData()
      setTimeout(() => setNotice(''), 4000)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to add member.')
    } finally {
      setSavingMember(false)
    }
  }

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault()
    if (savingConfig) return

    setSavingConfig(true)
    try {
      const totalPerMember = configW1Amt + 49 * configWRegAmt
      const totalPlanned = 50 * totalPerMember

      const updated = await financeApi.updateSweetFundProgramme({
        start_date: configStartDate,
        target_end_date: configDiwaliDate,
        week_1_amount: configW1Amt,
        week_regular_amount: configWRegAmt,
        target_per_member: totalPerMember,
        total_target: totalPlanned,
      })
      setProgramme(updated)
      setShowConfigModal(false)
      setNotice('Updated Sweet Fund programme configuration and deadline parameters.')
      setTimeout(() => setNotice(''), 4000)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update programme.')
    } finally {
      setSavingConfig(false)
    }
  }

  // Parse CSV Preview
  const handleParseCsv = () => {
    const lines = csvText.split('\n').map((l) => l.trim()).filter(Boolean)
    const parsed: Array<{ name: string; phone?: string }> = []
    lines.forEach((line) => {
      const parts = line.split(',').map((p) => p.trim())
      if (parts[0] && !parts[0].toLowerCase().includes('name')) {
        parsed.push({
          name: parts[0],
          phone: parts[1] || undefined,
        })
      }
    })
    setImportPreview(parsed)
  }

  const handleCommitImport = async () => {
    if (importPreview.length === 0 || importing) return
    setImporting(true)
    try {
      for (const p of importPreview) {
        await financeApi.addSweetFundMember({
          member_name: p.name,
          phone: p.phone,
        })
      }
      setNotice(`Successfully imported ${importPreview.length} participants into Sweet Fund.`)
      setShowImportModal(false)
      setCsvText('')
      setImportPreview([])
      loadData()
      setTimeout(() => setNotice(''), 4000)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Import failed.')
    } finally {
      setImporting(false)
    }
  }

  // Schedule deadline analysis
  const startDate = new Date(programme?.start_date || '2026-11-01')
  const projectedEndDate = new Date(startDate)
  projectedEndDate.setDate(projectedEndDate.getDate() + 50 * 7)
  const configuredDiwali = new Date(programme?.target_end_date || '2027-10-20')
  const diffDays = Math.round(
    (projectedEndDate.getTime() - configuredDiwali.getTime()) / (1000 * 60 * 60 * 24)
  )

  // Accounting figures
  const plannedTotalTarget = (programme?.total_members || 50) * (programme?.target_per_member || 10300)
  const actualCollectedTotal = members.reduce((sum, m) => sum + m.total_paid, 0)
  const outstandingRemaining = Math.max(0, plannedTotalTarget - actualCollectedTotal)
  const completedMembersCount = members.filter((m) => m.status === 'completed' || m.remaining_balance === 0).length

  const filteredMembers = members.filter((m) => {
    if (!searchQuery.trim()) return true
    const q = searchQuery.toLowerCase()
    return m.member_name.toLowerCase().includes(q) || String(m.member_number).includes(q)
  })

  return (
    <div className="page-shell">
      <header className="page-header">
        <div>
          <p className="eyebrow">50-Member Weekly Scheme</p>
          <h1 className="page-title">Sweet Fund (Diwali Scheme)</h1>
          <p className="page-subtitle">
            50-week contribution programme. Week 1: ₹500, Weeks 2–50: ₹200. Target: ₹10,300/member (Total: ₹5,15,000 for 50 members).
          </p>
        </div>
        <div className="header-actions">
          <button className="secondary-button" type="button" onClick={() => setShowConfigModal(true)}>
            ⚙️ Programme Settings
          </button>
          <button className="secondary-button" type="button" onClick={() => setShowImportModal(true)}>
            📥 Import Excel/CSV
          </button>
          <button className="primary-button" type="button" onClick={() => setShowAddMemberModal(true)}>
            + Add Participant
          </button>
        </div>
      </header>

      {/* Reconciled KPI Grid */}
      <div className="kpi-grid">
        <div className="kpi-card highlight-card">
          <span className="kpi-label">Planned Scheme Target</span>
          <span className="kpi-value">{currency.format(plannedTotalTarget)}</span>
          <span className="kpi-subtext">50 members × ₹10,300 per target</span>
        </div>
        <div className="kpi-card success-card">
          <span className="kpi-label">Actual Receipts Collected</span>
          <span className="kpi-value text-positive">{currency.format(actualCollectedTotal)}</span>
          <span className="kpi-subtext">{payments.length} verified weekly receipts</span>
        </div>
        <div className="kpi-card danger-card">
          <span className="kpi-label">Outstanding Contributions</span>
          <span className="kpi-value text-danger">{currency.format(outstandingRemaining)}</span>
          <span className="kpi-subtext">Remaining balance across participants</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-label">Enrolled Participants</span>
          <span className="kpi-value">{members.length} / 50</span>
          <span className="kpi-subtext">{completedMembersCount} completed full target</span>
        </div>
      </div>

      {/* Deadline Reconciliation Warning if mismatch */}
      {Math.abs(diffDays) > 0 && (
        <div
          className="card"
          style={{
            marginBottom: '1.25rem',
            background: '#fff8d8',
            borderLeft: '4px solid #df7b08',
            color: '#78350f',
          }}
        >
          <strong>📅 Schedule & Diwali Deadline Alignment:</strong>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.8125rem' }}>
            The 50-week schedule starting {formatDateISO(startDate)} reaches completion on{' '}
            <strong>{formatDateISO(projectedEndDate)}</strong>. Configured Diwali target date is{' '}
            <strong>{formatDateISO(configuredDiwali)}</strong> ({Math.abs(diffDays)} days {diffDays > 0 ? 'later' : 'earlier'}).
            Per accounting rules, payment schedules are preserved without artificial compression.
          </p>
        </div>
      )}

      {notice && (
        <div
          className="card"
          style={{
            marginBottom: '1.25rem',
            background: '#ecfdf5',
            borderLeft: '4px solid #10b981',
            color: '#065f46',
          }}
        >
          ✓ {notice}
        </div>
      )}

      {error && (
        <div
          className="card"
          style={{
            marginBottom: '1.25rem',
            background: '#fef2f2',
            borderLeft: '4px solid #ef4444',
            color: '#991b1b',
          }}
        >
          {error}
        </div>
      )}

      {/* Participant Roster */}
      <section className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="card-header">
          <div>
            <h2 style={{ fontSize: '1.125rem', margin: 0, fontWeight: 700 }}>
              Participant Roster ({filteredMembers.length})
            </h2>
            <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--muted)' }}>
              Individual contribution ledgers and 50-week installment schedules.
            </p>
          </div>
          <input
            type="search"
            placeholder="Search participant name or #..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ padding: '0.375rem 0.75rem', width: '240px', borderRadius: '6px', border: '1px solid var(--line)' }}
          />
        </div>

        {loading ? (
          <div className="loading-state">Loading Sweet Fund participants…</div>
        ) : members.length === 0 ? (
          <div className="empty-state">
            <p><strong>No participants enrolled yet.</strong></p>
            <p style={{ fontSize: '0.8125rem', color: 'var(--muted)' }}>
              The Sweet Fund workbook has not yet been uploaded. Use "+ Add Participant" or "📥 Import Excel/CSV" once the workbook is available.
            </p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: '60px' }}>#</th>
                  <th>Participant Name</th>
                  <th>Phone</th>
                  <th style={{ textAlign: 'right' }}>Target (₹)</th>
                  <th style={{ textAlign: 'right' }}>Paid (₹)</th>
                  <th style={{ textAlign: 'right' }}>Remaining (₹)</th>
                  <th style={{ width: '160px' }}>Progress</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'center' }}>Schedule</th>
                </tr>
              </thead>
              <tbody>
                {filteredMembers.map((m) => {
                  const target = programme?.target_per_member || 10300
                  const pct = target > 0 ? Math.min(100, Math.round((m.total_paid / target) * 100)) : 0
                  const isCompleted = m.status === 'completed' || m.remaining_balance === 0

                  return (
                    <tr key={m.id}>
                      <td style={{ fontWeight: 700, color: 'var(--muted)' }}>#{m.member_number}</td>
                      <td style={{ fontWeight: 700 }}>{m.member_name}</td>
                      <td style={{ color: 'var(--muted)' }}>{m.phone || '—'}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>{currency.format(target)}</td>
                      <td style={{ textAlign: 'right', color: 'var(--positive)', fontWeight: 700 }}>
                        {currency.format(m.total_paid)}
                      </td>
                      <td
                        style={{ textAlign: 'right', fontWeight: 700 }}
                        className={m.remaining_balance > 0 ? 'text-danger' : 'text-positive'}
                      >
                        {currency.format(m.remaining_balance)}
                      </td>
                      <td>
                        <div style={{ background: '#e2e8f0', borderRadius: '999px', height: '8px', overflow: 'hidden' }}>
                          <div style={{ background: isCompleted ? '#10b981' : '#f59e0b', width: `${pct}%`, height: '100%' }} />
                        </div>
                        <span style={{ fontSize: '0.6875rem', color: 'var(--muted)' }}>{pct}%</span>
                      </td>
                      <td>
                        <span className={`pill ${isCompleted ? 'pill-green' : 'pill-gold'}`}>
                          {isCompleted ? 'Completed' : 'Active'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          type="button"
                          className="secondary-button compact-button"
                          style={{ padding: '4px 10px', fontSize: '0.8125rem' }}
                          onClick={() => handleOpenMemberSchedule(m)}
                        >
                          View Schedule
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Member Schedule Modal */}
      {selectedMember && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ maxWidth: '780px', width: '95%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>
                  #{selectedMember.member_number} {selectedMember.member_name} — 50-Week Installment Schedule
                </h2>
                <p style={{ margin: '0.25rem 0 0', fontSize: '0.8125rem', color: 'var(--muted)' }}>
                  Total Paid: <strong>{currency.format(selectedMember.total_paid)}</strong> | Remaining:{' '}
                  <strong>{currency.format(selectedMember.remaining_balance)}</strong>
                </p>
              </div>
              <button
                type="button"
                className="secondary-button compact-button"
                onClick={() => setSelectedMember(null)}
              >
                ✕ Close
              </button>
            </div>

            {loadingInstallments ? (
              <div className="loading-state">Loading schedule…</div>
            ) : (
              <div className="table-responsive" style={{ maxHeight: '420px', overflowY: 'auto' }}>
                <table className="data-table">
                  <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: '#f8fafc' }}>
                    <tr>
                      <th>Wk</th>
                      <th>Due Date</th>
                      <th style={{ textAlign: 'right' }}>Expected</th>
                      <th style={{ textAlign: 'right' }}>Paid</th>
                      <th>Status</th>
                      <th>Paid Date</th>
                      <th style={{ textAlign: 'center' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {memberInstallments.map((inst) => {
                      const isPaid = inst.status === 'Paid'
                      return (
                        <tr key={inst.id} style={{ background: isPaid ? 'rgba(234, 247, 238, 0.4)' : undefined }}>
                          <td style={{ fontWeight: 700 }}>W{inst.week_number}</td>
                          <td>{inst.due_date}</td>
                          <td style={{ textAlign: 'right', fontWeight: 600 }}>{currency.format(inst.expected_amount)}</td>
                          <td style={{ textAlign: 'right', fontWeight: 700, color: isPaid ? 'var(--positive)' : undefined }}>
                            {currency.format(inst.paid_amount)}
                          </td>
                          <td>
                            <span className={`pill ${isPaid ? 'pill-green' : inst.status === 'Partial' ? 'pill-gold' : 'pill-gray'}`}>
                              {inst.status}
                            </span>
                          </td>
                          <td style={{ fontSize: '0.8125rem', color: 'var(--muted)' }}>{inst.paid_date || '—'}</td>
                          <td style={{ textAlign: 'center' }}>
                            {!isPaid && (
                              <button
                                type="button"
                                className="primary-button compact-button"
                                style={{ padding: '3px 8px', fontSize: '0.75rem' }}
                                onClick={() => handleOpenPayment(inst)}
                              >
                                + Pay
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
          </div>
        </div>
      )}

      {/* Record Payment Sub-Modal */}
      {payingInstallment && selectedMember && (
        <div className="modal-backdrop" style={{ zIndex: 110 }}>
          <div className="modal-card" style={{ maxWidth: '400px', width: '90%' }}>
            <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.125rem', fontWeight: 700 }}>
              Record Week {payingInstallment.week_number} Payment
            </h3>
            <p style={{ margin: '0 0 1rem', fontSize: '0.8125rem', color: 'var(--muted)' }}>
              Member: <strong>{selectedMember.member_name}</strong> | Due:{' '}
              <strong>{currency.format(payingInstallment.expected_amount - payingInstallment.paid_amount)}</strong>
            </p>

            <form onSubmit={handleSavePayment}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.375rem' }}>
                  Payment Amount (₹)
                </label>
                <input
                  type="number"
                  required
                  min={1}
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(Number(e.target.value))}
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--line)', borderRadius: '6px' }}
                />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.375rem' }}>
                  Payment Date
                </label>
                <input
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--line)', borderRadius: '6px' }}
                />
              </div>

              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.375rem' }}>
                  Notes / Voucher (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Cash collected"
                  value={paymentNote}
                  onChange={(e) => setPaymentNote(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--line)', borderRadius: '6px' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setPayingInstallment(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="primary-button"
                  disabled={savingPayment}
                >
                  {savingPayment ? 'Saving…' : 'Confirm Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Member Modal */}
      {showAddMemberModal && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ maxWidth: '420px', width: '90%' }}>
            <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.125rem', fontWeight: 700 }}>
              Add Sweet Fund Participant
            </h2>
            <p style={{ margin: '0 0 1rem', fontSize: '0.8125rem', color: 'var(--muted)' }}>
              Automatically generates a 50-week installment schedule for this member.
            </p>

            <form onSubmit={handleAddMember}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.375rem' }}>
                  Participant Full Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. BALAN"
                  value={newMemberName}
                  onChange={(e) => setNewMemberName(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--line)', borderRadius: '6px' }}
                />
              </div>

              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.375rem' }}>
                  Phone Number (Optional)
                </label>
                <input
                  type="tel"
                  placeholder="e.g. 9876543210"
                  value={newMemberPhone}
                  onChange={(e) => setNewMemberPhone(e.target.value)}
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
                  {savingMember ? 'Saving…' : 'Enroll Participant'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Programme Settings Modal */}
      {showConfigModal && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ maxWidth: '450px', width: '90%' }}>
            <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.125rem', fontWeight: 700 }}>
              Sweet Fund Programme Settings
            </h2>
            <p style={{ margin: '0 0 1rem', fontSize: '0.8125rem', color: 'var(--muted)' }}>
              Configure start date, Diwali deadline, and weekly installment parameters.
            </p>

            <form onSubmit={handleSaveConfig}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.375rem' }}>
                  Programme Start Date
                </label>
                <input
                  type="date"
                  value={configStartDate}
                  onChange={(e) => setConfigStartDate(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--line)', borderRadius: '6px' }}
                />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.375rem' }}>
                  Target Diwali Completion Date
                </label>
                <input
                  type="date"
                  value={configDiwaliDate}
                  onChange={(e) => setConfigDiwaliDate(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--line)', borderRadius: '6px' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.25rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.375rem' }}>
                    Week 1 Amount (₹)
                  </label>
                  <input
                    type="number"
                    value={configW1Amt}
                    onChange={(e) => setConfigW1Amt(Number(e.target.value))}
                    style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--line)', borderRadius: '6px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.375rem' }}>
                    Weeks 2–50 Amount (₹)
                  </label>
                  <input
                    type="number"
                    value={configWRegAmt}
                    onChange={(e) => setConfigWRegAmt(Number(e.target.value))}
                    style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--line)', borderRadius: '6px' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setShowConfigModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="primary-button"
                  disabled={savingConfig}
                >
                  {savingConfig ? 'Saving…' : 'Save Settings'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Excel / CSV Importer Modal */}
      {showImportModal && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ maxWidth: '520px', width: '90%' }}>
            <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.125rem', fontWeight: 700 }}>
              Sweet Fund Participant Importer
            </h2>
            <p style={{ margin: '0 0 1rem', fontSize: '0.8125rem', color: 'var(--muted)' }}>
              Paste participant records or CSV lines (Format: <code>Name, Phone</code>).
            </p>

            <textarea
              rows={5}
              placeholder="e.g.&#10;RAMESH, 9876543210&#10;KUMAR, 9845612340&#10;SURESH"
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--line)', borderRadius: '6px', marginBottom: '0.75rem' }}
            />

            <button
              type="button"
              className="secondary-button compact-button"
              onClick={handleParseCsv}
              style={{ marginBottom: '1rem' }}
            >
              🔍 Preview {importPreview.length > 0 ? `(${importPreview.length} detected)` : 'Entries'}
            </button>

            {importPreview.length > 0 && (
              <div style={{ maxHeight: '180px', overflowY: 'auto', marginBottom: '1rem', border: '1px solid var(--line)', borderRadius: '6px' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Parsed Name</th>
                      <th>Phone</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importPreview.map((p, idx) => (
                      <tr key={idx}>
                        <td>{idx + 1}</td>
                        <td style={{ fontWeight: 600 }}>{p.name}</td>
                        <td>{p.phone || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="secondary-button"
                onClick={() => { setShowImportModal(false); setImportPreview([]); setCsvText(''); }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="primary-button"
                disabled={importPreview.length === 0 || importing}
                onClick={handleCommitImport}
              >
                {importing ? 'Importing…' : `Confirm Import (${importPreview.length})`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
