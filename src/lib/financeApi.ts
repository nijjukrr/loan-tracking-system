import importedData from '../data/imported-finance.json'
import {
  calculateNextDueDate,
  computeDashboardMetrics,
  formatDateISO,
  generateDailyInstallments,
  generateWeeklyInstallments,
  getInstallmentStatus,
} from './financeLogic'
import { supabase } from './supabase'
import type {
  DashboardMetrics,
  Installment,
  InstallmentStatus,
  Loan,
  MainTransaction,
  ModeKind,
  NewLoanInput,
  NewPaymentInput,
  NewTenPercentEntry,
  Payment,
  TenPercentEntry,
} from '../types'

export interface FinanceApi {
  listLoans(filter?: { mode?: ModeKind; status?: 'active' | 'closed'; search?: string }): Promise<Loan[]>
  getLoanDetail(id: string): Promise<{ loan: Loan; installments: Installment[]; payments: Payment[] } | null>
  createLoan(input: NewLoanInput): Promise<Loan>
  recordPayment(input: NewPaymentInput): Promise<{ loan: Loan; payment: Payment; installments: Installment[] }>
  closeLoan(id: string): Promise<Loan>
  listPayments(filter?: { mode?: ModeKind; search?: string }): Promise<Payment[]>
  listInstallments(filter?: { status?: InstallmentStatus; due_date?: string }): Promise<Array<Installment & { loan?: Loan }>>
  getDashboardMetrics(): Promise<DashboardMetrics>
  listTenPercentEntries(): Promise<TenPercentEntry[]>
  addTenPercentEntry(entry: NewTenPercentEntry): Promise<TenPercentEntry>
  listUntaggedMainTransactions(): Promise<MainTransaction[]>
  tagMainTransaction(transactionId: string): Promise<TenPercentEntry>
}

const STORAGE_KEY_LOANS = 'finance-tracker-loans-v3'
const STORAGE_KEY_INSTALLMENTS = 'finance-tracker-installments-v3'
const STORAGE_KEY_PAYMENTS = 'finance-tracker-payments-v3'
const STORAGE_KEY_TEN_PERCENT = 'finance-tracker-ten-percent-v3'
const STORAGE_KEY_MAIN_TX = 'finance-tracker-main-tx-v3'

function buildInitialData() {
  const loans: Loan[] = []
  const installments: Installment[] = []
  const payments: Payment[] = []

  const rawLoans = importedData.loans || []
  const todayStr = formatDateISO(new Date())

  rawLoans.forEach((raw) => {

    const loanId = `loan-${raw.mainSheetNo}`
    const isDaily = raw.mode === 'D'
    const principal = Number(raw.principal)
    const sourceCredit = Number(raw.sourceCredit || 0)
    const remarks = raw.sourceRemarks || ''

    let interestAmount = 0
    let weeklyPayment = 0
    let totalExpected = principal

    if (isDaily) {
      interestAmount = Math.round((principal * 0.03)) // 3% per 10-day cycle standard
      totalExpected = principal + interestAmount * 6
    } else {
      weeklyPayment = 3000
      totalExpected = 30000
    }

    const isClosed = sourceCredit >= principal && remarks.includes('AMT RECD')
    const status = isClosed ? 'closed' : 'active'
    const totalCollected = sourceCredit

    const loan: Loan = {
      id: loanId,
      main_sheet_no: raw.mainSheetNo,
      customer_name: raw.customerName,
      mode: raw.mode as ModeKind,
      loan_date: raw.loanDate,
      principal,
      interest_amount: interestAmount,
      weekly_payment: weeklyPayment,
      total_expected: totalExpected,
      total_collected: totalCollected,
      remaining_balance: Math.max(0, totalExpected - totalCollected),
      status,
      closed_at: isClosed ? raw.loanDate : null,
      source_remarks: remarks || null,
      created_at: new Date(raw.loanDate).toISOString(),
      updated_at: new Date().toISOString(),
    }
    loans.push(loan)

    // Generate installments
    let loanInsts: Installment[] = []
    if (isDaily) {
      loanInsts = generateDailyInstallments(loanId, raw.loanDate, undefined, interestAmount)
    } else {
      loanInsts = generateWeeklyInstallments(loanId, raw.loanDate, undefined, weeklyPayment)
    }

    // Process initial payment if present in remarks or credit
    if (sourceCredit > 0) {
      const pId = `pay-init-${raw.mainSheetNo}`
      const paymentDate = remarks.match(/\d{1,2}\/\d{1,2}\/\d{2,4}/)
        ? raw.loanDate
        : raw.loanDate

      const pType = isClosed ? 'Principal' : isDaily ? 'Interest' : 'Weekly Installment'
      payments.push({
        id: pId,
        loan_id: loanId,
        installment_id: loanInsts[0]?.id,
        customer_name: raw.customerName,
        main_sheet_no: raw.mainSheetNo,
        mode: raw.mode as ModeKind,
        payment_date: paymentDate,
        amount: sourceCredit,
        payment_type: pType,
        note: remarks || 'Imported from Excel MAIN sheet',
        created_at: new Date().toISOString(),
      })

      if (loanInsts[0]) {
        loanInsts[0].paid_date = paymentDate
        loanInsts[0].paid_amount = sourceCredit
      }
    }

    // Update statuses
    loanInsts.forEach((inst) => {
      inst.status = getInstallmentStatus(inst.due_date, inst.paid_date, inst.paid_amount, inst.expected_amount, todayStr)
    })

    installments.push(...loanInsts)
  })

  const mainTransactions: MainTransaction[] = (importedData.mainTransactions || []).map((mt) => ({
    id: `mt-${mt.mainSheetNo}`,
    main_sheet_no: mt.mainSheetNo,
    transaction_date: mt.date,
    particulars: mt.particulars,
    credit: mt.credit,
    category: mt.category as '10PCT' | null,
  }))

  const tenPercentEntries: TenPercentEntry[] = ((importedData.tenPercentEntries || []) as Array<{ date: string; particulars: string; amount: number; mainSheetNo: number }>).map((tp, i) => ({
    id: `tp-${i + 1}`,
    entry_date: tp.date,
    particulars: tp.particulars,
    amount: tp.amount,
    main_sheet_no: tp.mainSheetNo,
    notes: null,
    source_kind: 'main_tag',
    main_transaction_id: null,
    created_at: new Date().toISOString(),
  }))


  return { loans, installments, payments, mainTransactions, tenPercentEntries }
}

function getLocalStore() {
  const initial = buildInitialData()

  const storedLoans = localStorage.getItem(STORAGE_KEY_LOANS)
  const storedInstallments = localStorage.getItem(STORAGE_KEY_INSTALLMENTS)
  const storedPayments = localStorage.getItem(STORAGE_KEY_PAYMENTS)
  const storedTenPercent = localStorage.getItem(STORAGE_KEY_TEN_PERCENT)
  const storedMainTx = localStorage.getItem(STORAGE_KEY_MAIN_TX)

  const loans: Loan[] = storedLoans ? JSON.parse(storedLoans) : initial.loans
  const installments: Installment[] = storedInstallments ? JSON.parse(storedInstallments) : initial.installments
  const payments: Payment[] = storedPayments ? JSON.parse(storedPayments) : initial.payments
  const tenPercentEntries: TenPercentEntry[] = storedTenPercent ? JSON.parse(storedTenPercent) : initial.tenPercentEntries
  const mainTransactions: MainTransaction[] = storedMainTx ? JSON.parse(storedMainTx) : initial.mainTransactions

  if (!storedLoans) localStorage.setItem(STORAGE_KEY_LOANS, JSON.stringify(loans))
  if (!storedInstallments) localStorage.setItem(STORAGE_KEY_INSTALLMENTS, JSON.stringify(installments))
  if (!storedPayments) localStorage.setItem(STORAGE_KEY_PAYMENTS, JSON.stringify(payments))
  if (!storedTenPercent) localStorage.setItem(STORAGE_KEY_TEN_PERCENT, JSON.stringify(tenPercentEntries))
  if (!storedMainTx) localStorage.setItem(STORAGE_KEY_MAIN_TX, JSON.stringify(mainTransactions))

  return { loans, installments, payments, tenPercentEntries, mainTransactions }
}

function saveLocalStore(data: {
  loans?: Loan[]
  installments?: Installment[]
  payments?: Payment[]
  tenPercentEntries?: TenPercentEntry[]
  mainTransactions?: MainTransaction[]
}) {
  if (data.loans) localStorage.setItem(STORAGE_KEY_LOANS, JSON.stringify(data.loans))
  if (data.installments) localStorage.setItem(STORAGE_KEY_INSTALLMENTS, JSON.stringify(data.installments))
  if (data.payments) localStorage.setItem(STORAGE_KEY_PAYMENTS, JSON.stringify(data.payments))
  if (data.tenPercentEntries) localStorage.setItem(STORAGE_KEY_TEN_PERCENT, JSON.stringify(data.tenPercentEntries))
  if (data.mainTransactions) localStorage.setItem(STORAGE_KEY_MAIN_TX, JSON.stringify(data.mainTransactions))
}

class LocalPreviewFinanceApi implements FinanceApi {
  async listLoans(filter?: { mode?: ModeKind; status?: 'active' | 'closed'; search?: string }) {
    const { loans } = getLocalStore()
    return loans.filter((l) => {
      if (filter?.mode && l.mode !== filter.mode) return false
      if (filter?.status && l.status !== filter.status) return false
      if (filter?.search) {
        const query = filter.search.toLowerCase()
        const matchesName = l.customer_name.toLowerCase().includes(query)
        const matchesNo = String(l.main_sheet_no).includes(query)
        if (!matchesName && !matchesNo) return false
      }
      return true
    })
  }

  async getLoanDetail(id: string) {
    const { loans, installments, payments } = getLocalStore()
    const loan = loans.find((l) => l.id === id || String(l.main_sheet_no) === id)
    if (!loan) return null
    const loanInsts = installments
      .filter((inst) => inst.loan_id === loan.id)
      .sort((a, b) => a.installment_number - b.installment_number)
    const loanPayments = payments
      .filter((p) => p.loan_id === loan.id)
      .sort((a, b) => new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime())
    return { loan, installments: loanInsts, payments: loanPayments }
  }

  async createLoan(input: NewLoanInput) {
    const store = getLocalStore()
    const maxSheetNo = store.loans.reduce((max, l) => Math.max(max, l.main_sheet_no), 0)
    const mainSheetNo = input.main_sheet_no || maxSheetNo + 1

    const isDaily = input.mode === 'D'
    const principal = Number(input.principal)
    const interestAmount = isDaily ? (input.interest_amount || Math.round(principal * 0.03)) : 0
    const weeklyPayment = !isDaily ? (input.weekly_payment || 3000) : 0
    const totalExpected = isDaily ? principal + interestAmount * 6 : weeklyPayment * 10

    const newLoan: Loan = {
      id: `loan-${mainSheetNo}-${Date.now()}`,
      main_sheet_no: mainSheetNo,
      customer_name: input.customer_name.trim(),
      mode: input.mode,
      loan_date: input.loan_date,
      principal,
      interest_amount: interestAmount,
      weekly_payment: weeklyPayment,
      total_expected: totalExpected,
      total_collected: 0,
      remaining_balance: totalExpected,
      status: 'active',
      closed_at: null,
      source_remarks: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    const newInsts = isDaily
      ? generateDailyInstallments(newLoan.id, input.loan_date, input.first_due_date, interestAmount)
      : generateWeeklyInstallments(newLoan.id, input.loan_date, input.first_due_date, weeklyPayment)

    const updatedLoans = [newLoan, ...store.loans]
    const updatedInsts = [...store.installments, ...newInsts]
    saveLocalStore({ loans: updatedLoans, installments: updatedInsts })

    return newLoan
  }

  async recordPayment(input: NewPaymentInput) {
    const store = getLocalStore()
    const loanIndex = store.loans.findIndex((l) => l.id === input.loan_id)
    if (loanIndex === -1) throw new Error('Loan not found.')

    const loan = store.loans[loanIndex]
    const loanInsts = store.installments
      .filter((i) => i.loan_id === loan.id)
      .sort((a, b) => a.installment_number - b.installment_number)

    // Find installment to pay
    let targetInst = input.installment_id
      ? loanInsts.find((i) => i.id === input.installment_id)
      : loanInsts.find((i) => i.status !== 'Paid') || loanInsts[0]

    const paymentAmount = Number(input.amount)
    const newPayment: Payment = {
      id: `pay-${Date.now()}`,
      loan_id: loan.id,
      installment_id: targetInst?.id || null,
      customer_name: loan.customer_name,
      main_sheet_no: loan.main_sheet_no,
      mode: loan.mode,
      payment_date: input.paid_date,
      amount: paymentAmount,
      payment_type: input.payment_type,
      note: input.note?.trim() || null,
      created_at: new Date().toISOString(),
    }

    // Update target installment
    if (targetInst) {
      targetInst.paid_date = input.paid_date
      targetInst.paid_amount += paymentAmount
      targetInst.status = getInstallmentStatus(targetInst.due_date, targetInst.paid_date, targetInst.paid_amount, targetInst.expected_amount)
      targetInst.updated_at = new Date().toISOString()
    }

    // Recalculate next due date for subsequent unpaid installments based on actual paid date
    const nextDueDate = calculateNextDueDate(loan.mode, input.paid_date)
    let nextInstIndex = loanInsts.findIndex((i) => i.id === targetInst?.id) + 1
    if (nextInstIndex > 0 && nextInstIndex < loanInsts.length) {
      loanInsts[nextInstIndex].due_date = nextDueDate
      loanInsts[nextInstIndex].status = getInstallmentStatus(
        nextDueDate,
        loanInsts[nextInstIndex].paid_date,
        loanInsts[nextInstIndex].paid_amount,
        loanInsts[nextInstIndex].expected_amount
      )
    }

    // Update loan totals
    loan.total_collected += paymentAmount
    loan.remaining_balance = Math.max(0, loan.total_expected - loan.total_collected)
    if (loan.remaining_balance === 0) {
      loan.status = 'closed'
      loan.closed_at = new Date().toISOString()
    }
    loan.updated_at = new Date().toISOString()

    store.loans[loanIndex] = loan
    const updatedPayments = [newPayment, ...store.payments]

    saveLocalStore({ loans: store.loans, installments: store.installments, payments: updatedPayments })
    return { loan, payment: newPayment, installments: loanInsts }
  }

  async closeLoan(id: string) {
    const store = getLocalStore()
    const loan = store.loans.find((l) => l.id === id)
    if (!loan) throw new Error('Loan not found.')
    loan.status = 'closed'
    loan.closed_at = new Date().toISOString()
    loan.updated_at = new Date().toISOString()
    saveLocalStore({ loans: store.loans })
    return loan
  }

  async listPayments(filter?: { mode?: ModeKind; search?: string }) {
    const { payments } = getLocalStore()
    return payments.filter((p) => {
      if (filter?.mode && p.mode !== filter.mode) return false
      if (filter?.search) {
        const q = filter.search.toLowerCase()
        const matchesName = p.customer_name.toLowerCase().includes(q)
        const matchesNo = String(p.main_sheet_no).includes(q)
        if (!matchesName && !matchesNo) return false
      }
      return true
    })
  }

  async listInstallments(filter?: { status?: InstallmentStatus; due_date?: string }) {
    const { installments, loans } = getLocalStore()
    const todayStr = formatDateISO(new Date())

    const loansMap = new Map(loans.map((l) => [l.id, l]))
    const result: Array<Installment & { loan?: Loan }> = []

    installments.forEach((inst) => {
      const loan = loansMap.get(inst.loan_id)
      if (!loan || loan.status === 'closed') return

      const currentStatus = getInstallmentStatus(inst.due_date, inst.paid_date, inst.paid_amount, inst.expected_amount, todayStr)
      const instItem = { ...inst, status: currentStatus, loan }

      if (filter?.status && currentStatus !== filter.status) return
      if (filter?.due_date && inst.due_date !== filter.due_date) return

      result.push(instItem)
    })

    return result
  }

  async getDashboardMetrics() {
    const { loans, installments, payments, tenPercentEntries } = getLocalStore()
    return computeDashboardMetrics(loans, installments, payments, tenPercentEntries)
  }

  async listTenPercentEntries() {
    const { tenPercentEntries } = getLocalStore()
    return tenPercentEntries
  }

  async addTenPercentEntry(entry: NewTenPercentEntry) {
    const store = getLocalStore()
    const record: TenPercentEntry = {
      id: crypto.randomUUID(),
      ...entry,
      source_kind: 'manual',
      main_transaction_id: null,
      created_at: new Date().toISOString(),
    }
    const updated = [record, ...store.tenPercentEntries]
    saveLocalStore({ tenPercentEntries: updated })
    return record
  }

  async listUntaggedMainTransactions() {
    const { mainTransactions } = getLocalStore()
    return mainTransactions.filter((tx) => tx.category === null && tx.credit > 0)
  }

  async tagMainTransaction(transactionId: string) {
    const store = getLocalStore()
    const tx = store.mainTransactions.find((m) => m.id === transactionId)
    if (!tx) throw new Error('MAIN transaction not found.')
    tx.category = '10PCT'

    const entry: TenPercentEntry = {
      id: crypto.randomUUID(),
      entry_date: tx.transaction_date || formatDateISO(new Date()),
      particulars: tx.particulars,
      amount: tx.credit,
      main_sheet_no: tx.main_sheet_no,
      notes: 'Tagged from MAIN transaction',
      source_kind: 'main_tag',
      main_transaction_id: tx.id,
      created_at: new Date().toISOString(),
    }
    const updatedEntries = [entry, ...store.tenPercentEntries]
    saveLocalStore({ mainTransactions: store.mainTransactions, tenPercentEntries: updatedEntries })
    return entry
  }
}

class SupabaseFinanceApi implements FinanceApi {
  async listLoans(filter?: { mode?: ModeKind; status?: 'active' | 'closed'; search?: string }) {
    let query = supabase!.from('loans').select('*').order('loan_date', { ascending: false })
    if (filter?.mode) query = query.eq('mode', filter.mode)
    if (filter?.status) query = query.eq('status', filter.status)
    if (filter?.search) query = query.ilike('customer_name', `%${filter.search}%`)
    const { data, error } = await query
    if (error) throw error
    return (data || []) as Loan[]
  }

  async getLoanDetail(id: string) {
    const { data: loan, error: loanErr } = await supabase!.from('loans').select('*').eq('id', id).single()
    if (loanErr || !loan) return null

    const { data: installments } = await supabase!
      .from('installments')
      .select('*')
      .eq('loan_id', id)
      .order('installment_number', { ascending: true })

    const { data: payments } = await supabase!
      .from('payments')
      .select('*')
      .eq('loan_id', id)
      .order('payment_date', { ascending: false })

    return {
      loan: loan as Loan,
      installments: (installments || []) as Installment[],
      payments: (payments || []) as Payment[],
    }
  }

  async createLoan(input: NewLoanInput) {
    const localFallback = new LocalPreviewFinanceApi()
    return localFallback.createLoan(input)
  }

  async recordPayment(input: NewPaymentInput) {
    const localFallback = new LocalPreviewFinanceApi()
    return localFallback.recordPayment(input)
  }

  async closeLoan(id: string) {
    const { data, error } = await supabase!.from('loans').update({ status: 'closed', closed_at: new Date().toISOString() }).eq('id', id).select().single()
    if (error) throw error
    return data as Loan
  }

  async listPayments(filter?: { mode?: ModeKind; search?: string }) {
    let query = supabase!.from('payments').select('*').order('payment_date', { ascending: false })
    if (filter?.mode) query = query.eq('mode', filter.mode)
    if (filter?.search) query = query.ilike('customer_name', `%${filter.search}%`)
    const { data, error } = await query
    if (error) throw error
    return (data || []) as Payment[]
  }

  async listInstallments(filter?: { status?: InstallmentStatus; due_date?: string }) {
    let query = supabase!.from('installments').select('*, loan:loans(*)')
    if (filter?.status) query = query.eq('status', filter.status)
    if (filter?.due_date) query = query.eq('due_date', filter.due_date)
    const { data, error } = await query
    if (error) throw error
    return (data || []) as Array<Installment & { loan?: Loan }>
  }

  async getDashboardMetrics() {
    const localFallback = new LocalPreviewFinanceApi()
    return localFallback.getDashboardMetrics()
  }

  async listTenPercentEntries() {
    const { data, error } = await supabase!
      .from('ten_percent_entries')
      .select('*')
      .order('entry_date', { ascending: false })
    if (error) throw error
    return (data || []) as TenPercentEntry[]
  }

  async addTenPercentEntry(entry: NewTenPercentEntry) {
    const { data, error } = await supabase!
      .from('ten_percent_entries')
      .insert({ ...entry, source_kind: 'manual' })
      .select('*')
      .single()
    if (error) throw error
    return data as TenPercentEntry
  }

  async listUntaggedMainTransactions() {
    const { data, error } = await supabase!
      .from('main_transactions')
      .select('*')
      .is('category', null)
      .order('main_sheet_no', { ascending: true })
    if (error) throw error
    return (data || []) as MainTransaction[]
  }

  async tagMainTransaction(transactionId: string) {
    const { data, error } = await supabase!
      .rpc('tag_main_transaction_as_ten_percent', { p_transaction_id: transactionId })
    if (error) throw error
    return data as TenPercentEntry
  }
}

export const financeApi: FinanceApi = supabase ? new SupabaseFinanceApi() : new LocalPreviewFinanceApi()
