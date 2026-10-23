import importedData from '../data/imported-finance.json'
import {
  calculateNextDueDate,
  computeDashboardMetrics,
  formatDateISO,
  generateDailyInstallments,
  generateWeeklyInstallments,
} from './financeLogic'
import { supabase } from './supabase'
import type {
  Customer,
  DashboardMetrics,
  DueReceivableEntry,
  FinancialLedgerTransaction,
  ImportedFinanceData,
  Installment,
  InstallmentStatus,
  InterestEntry,
  InvestmentEntry,
  Loan,
  MainTransaction,
  ModeKind,
  NewDueInput,
  NewInterestInput,
  NewInvestmentInput,
  NewLoanInput,
  NewPaymentInput,
  NewTenPercentEntry,
  Payment,
  TenPercentEntry,
} from '../types'

export interface FinanceApi {
  // People & Customer Profiles
  listPeople(search?: string): Promise<Customer[]>
  createCustomer(input: { name: string; phone?: string; address?: string }): Promise<Customer>
  getCustomerDetail(id: string): Promise<{ customer: Customer; loans: Loan[]; dues: DueReceivableEntry[] } | null>

  // Loans Lifecycle
  listLoans(filter?: { mode?: ModeKind; status?: 'active' | 'closed'; search?: string }): Promise<Loan[]>
  getLoanDetail(id: string): Promise<{ loan: Loan; installments: Installment[]; payments: Payment[] } | null>
  createLoan(input: NewLoanInput): Promise<Loan>
  closeLoan(id: string, reason?: string): Promise<Loan>
  deleteLoan(id: string): Promise<void>

  // Payments & Schedules
  recordPayment(input: NewPaymentInput): Promise<{ loan: Loan; payment: Payment; installments: Installment[] }>
  listPayments(filter?: { mode?: ModeKind; search?: string }): Promise<Payment[]>
  listInstallments(filter?: { status?: InstallmentStatus; due_date?: string }): Promise<Array<Installment & { loan?: Loan }>>

  // 10% Profit Management
  listTenPercentEntries(): Promise<TenPercentEntry[]>
  addTenPercentEntry(entry: NewTenPercentEntry): Promise<TenPercentEntry>
  deleteTenPercentEntry(id: string): Promise<void>
  listUntaggedMainTransactions(): Promise<MainTransaction[]>
  tagMainTransaction(transactionId: string): Promise<TenPercentEntry>
  untagMainTransaction(transactionId: string): Promise<void>

  // Investment Management
  listInvestments(): Promise<InvestmentEntry[]>
  addInvestment(input: NewInvestmentInput): Promise<InvestmentEntry>
  deleteInvestment(id: string): Promise<void>

  // Interest Tracking
  listInterests(): Promise<InterestEntry[]>
  addInterest(input: NewInterestInput): Promise<InterestEntry>
  deleteInterest(id: string): Promise<void>

  // Dues & Receivables
  listDues(): Promise<DueReceivableEntry[]>
  addDue(input: NewDueInput): Promise<DueReceivableEntry>
  settleDue(id: string, amount: number): Promise<DueReceivableEntry>
  deleteDue(id: string): Promise<void>

  // Unified Ledger
  listLedgerTransactions(filter?: { category?: string }): Promise<FinancialLedgerTransaction[]>

  // Dashboard & Administration
  getDashboardMetrics(): Promise<DashboardMetrics>
  importFullFinanceData(data: ImportedFinanceData): Promise<void>
  clearAllData(): Promise<void>
}

const STORAGE_KEY_LOANS = 'finance-tracker-loans-v5'
const STORAGE_KEY_INSTALLMENTS = 'finance-tracker-installments-v5'
const STORAGE_KEY_PAYMENTS = 'finance-tracker-payments-v5'
const STORAGE_KEY_TEN_PERCENT = 'finance-tracker-ten-percent-v5'
const STORAGE_KEY_MAIN_TX = 'finance-tracker-main-tx-v5'
const STORAGE_KEY_INVESTMENTS = 'finance-tracker-investments-v5'
const STORAGE_KEY_INTERESTS = 'finance-tracker-interests-v5'
const STORAGE_KEY_DUES = 'finance-tracker-dues-v5'
const STORAGE_KEY_CUSTOMERS = 'finance-tracker-customers-v5'
const STORAGE_KEY_LEDGER = 'finance-tracker-ledger-v5'

type RawImportLoan = {
  mainSheetNo: number
  sourceKey?: string
  mode: string
  principal: number
  sourceCredit?: number
  sourceRemarks?: string | null
  cleared?: boolean
  customerName: string
  loanDate: string
}

type RawImportMainTransaction = {
  mainSheetNo: number
  date: string
  particulars: string
  credit: number
  category?: string | null
}

function buildInitialData() {
  const loans: Loan[] = []
  const installments: Installment[] = []
  const payments: Payment[] = []

  const localOnly = import.meta.env.VITE_LOCAL_ONLY === 'true'
  const rawLoans: RawImportLoan[] = localOnly ? [] : (((importedData as unknown as { loans?: RawImportLoan[] }).loans) || [])

  rawLoans.forEach((raw) => {
    const loanId = `loan-${raw.mainSheetNo}-${raw.sourceKey ? String(raw.sourceKey).replace(/[^a-zA-Z0-9-]/g, '-') : 'import'}`
    const isDaily = raw.mode === 'D'
    const principal = Number(raw.principal)
    const sourceCredit = Number(raw.sourceCredit || 0)
    const remarks = raw.sourceRemarks || ''

    let interestAmount = 0
    let weeklyPayment = 0
    let totalExpected = principal

    if (isDaily) {
      interestAmount = Math.round((principal * 0.03))
      totalExpected = principal + interestAmount * 6
    } else {
      weeklyPayment = 3000
      totalExpected = 30000
    }

    const isClosed = Boolean(raw.cleared) || (sourceCredit >= principal && remarks.includes('AMT RECD'))
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
      source_paid: isClosed,
      created_at: new Date(raw.loanDate).toISOString(),
      updated_at: new Date().toISOString(),
    }
    loans.push(loan)

    let loanInsts: Installment[] = []
    if (isDaily) {
      loanInsts = generateDailyInstallments(loanId, raw.loanDate, undefined, interestAmount)
    } else {
      loanInsts = generateWeeklyInstallments(loanId, raw.loanDate, undefined, weeklyPayment)
    }

    if (sourceCredit > 0) {
      const pId = `pay-init-${raw.mainSheetNo}`
      const pType = isClosed ? 'Principal' : isDaily ? 'Interest' : 'Weekly Installment'
      payments.push({
        id: pId,
        loan_id: loanId,
        customer_name: raw.customerName,
        main_sheet_no: raw.mainSheetNo,
        mode: raw.mode as ModeKind,
        payment_date: raw.loanDate,
        amount: sourceCredit,
        payment_type: pType,
        note: remarks || 'Imported credit/settlement',
        created_at: new Date(raw.loanDate).toISOString(),
      })

      if (isClosed) {
        loanInsts.forEach((inst) => {
          inst.paid_amount = inst.expected_amount
          inst.status = 'Paid'
          inst.paid_date = raw.loanDate
        })
      } else {
        let remainingCredit = sourceCredit
        for (const inst of loanInsts) {
          if (remainingCredit <= 0) break
          const needed = inst.expected_amount - inst.paid_amount
          const alloc = Math.min(remainingCredit, needed)
          inst.paid_amount += alloc
          remainingCredit -= alloc
          if (inst.paid_amount >= inst.expected_amount) {
            inst.status = 'Paid'
            inst.paid_date = raw.loanDate
          } else {
            inst.status = 'Partial'
          }
        }
      }
    }

    installments.push(...loanInsts)
  })

  const rawMain: RawImportMainTransaction[] = localOnly ? [] : (((importedData as unknown as { mainTransactions?: RawImportMainTransaction[] }).mainTransactions) || [])
  const mainTransactions: MainTransaction[] = rawMain.map((raw, idx) => ({
    id: `tx-init-${raw.mainSheetNo || idx}`,
    main_sheet_no: raw.mainSheetNo || idx + 1,
    transaction_date: raw.date || null,
    particulars: raw.particulars,
    credit: raw.credit,
    category: (raw.category === '10PCT' ? '10PCT' : null),
  }))

  const rawTen = localOnly ? [] : (((importedData as unknown as { tenPercentEntries?: Array<{ mainSheetNo?: number | null; date?: string; particulars?: string; amount?: number }> }).tenPercentEntries) || [])
  const tenPercentEntries: TenPercentEntry[] = rawTen.map((raw, idx) => ({
    id: `ten-init-${raw.mainSheetNo || idx}`,
    entry_date: raw.date || formatDateISO(new Date()),
    particulars: raw.particulars || 'Imported 10%',
    amount: Number(raw.amount || 0),
    main_sheet_no: raw.mainSheetNo || null,
    notes: 'Imported from verified 10% profit ledger',
    source_kind: 'imported',
    main_transaction_id: null,
    created_at: new Date().toISOString(),
  }))

  return { loans, installments, payments, tenPercentEntries, mainTransactions }
}

const memoryStore = new Map<string, string>()

function getStorageItem(key: string): string | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage.getItem(key)
    }
  } catch {
    // Ignore in non-browser context
  }
  return memoryStore.get(key) ?? null
}

function setStorageItem(key: string, value: string): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(key, value)
      return
    }
  } catch {
    // Ignore in non-browser context
  }
  memoryStore.set(key, value)
}

function purgeLegacyStores() {
  if (typeof window === 'undefined' || !window.localStorage) return
  try {
    const legacyKeys = [
      'finance-tracker-loans-v1',
      'finance-tracker-loans-v2',
      'finance-tracker-loans-v3',
      'finance-tracker-loans-v4',
    ]
    for (const prefix of legacyKeys) {
      for (let i = window.localStorage.length - 1; i >= 0; i--) {
        const k = window.localStorage.key(i)
        if (k && k.startsWith(prefix)) {
          window.localStorage.removeItem(k)
        }
      }
    }
  } catch {
    // Ignore in non-browser context
  }
}

function getLocalStore() {
  purgeLegacyStores()
  const initial = buildInitialData()

  const safeParse = <T>(key: string, fallback: T): T => {
    try {
      const item = getStorageItem(key)
      return item ? JSON.parse(item) : fallback
    } catch {
      return fallback
    }
  }

  const loans = safeParse<Loan[]>(STORAGE_KEY_LOANS, initial.loans)
  const installments = safeParse<Installment[]>(STORAGE_KEY_INSTALLMENTS, initial.installments)
  const payments = safeParse<Payment[]>(STORAGE_KEY_PAYMENTS, initial.payments)
  const tenPercentEntries = safeParse<TenPercentEntry[]>(STORAGE_KEY_TEN_PERCENT, initial.tenPercentEntries)
  const mainTransactions = safeParse<MainTransaction[]>(STORAGE_KEY_MAIN_TX, initial.mainTransactions)
  const investments = safeParse<InvestmentEntry[]>(STORAGE_KEY_INVESTMENTS, [])
  const interests = safeParse<InterestEntry[]>(STORAGE_KEY_INTERESTS, [])
  const dues = safeParse<DueReceivableEntry[]>(STORAGE_KEY_DUES, [])
  const customers = safeParse<Customer[]>(STORAGE_KEY_CUSTOMERS, [])
  const ledgerTransactions = safeParse<FinancialLedgerTransaction[]>(STORAGE_KEY_LEDGER, [])

  return {
    loans,
    installments,
    payments,
    tenPercentEntries,
    mainTransactions,
    investments,
    interests,
    dues,
    customers,
    ledgerTransactions,
  }
}

function saveLocalStore(data: {
  loans?: Loan[]
  installments?: Installment[]
  payments?: Payment[]
  tenPercentEntries?: TenPercentEntry[]
  mainTransactions?: MainTransaction[]
  investments?: InvestmentEntry[]
  interests?: InterestEntry[]
  dues?: DueReceivableEntry[]
  customers?: Customer[]
  ledgerTransactions?: FinancialLedgerTransaction[]
}) {
  if (data.loans) setStorageItem(STORAGE_KEY_LOANS, JSON.stringify(data.loans))
  if (data.installments) setStorageItem(STORAGE_KEY_INSTALLMENTS, JSON.stringify(data.installments))
  if (data.payments) setStorageItem(STORAGE_KEY_PAYMENTS, JSON.stringify(data.payments))
  if (data.tenPercentEntries) setStorageItem(STORAGE_KEY_TEN_PERCENT, JSON.stringify(data.tenPercentEntries))
  if (data.mainTransactions) setStorageItem(STORAGE_KEY_MAIN_TX, JSON.stringify(data.mainTransactions))
  if (data.investments) setStorageItem(STORAGE_KEY_INVESTMENTS, JSON.stringify(data.investments))
  if (data.interests) setStorageItem(STORAGE_KEY_INTERESTS, JSON.stringify(data.interests))
  if (data.dues) setStorageItem(STORAGE_KEY_DUES, JSON.stringify(data.dues))
  if (data.customers) setStorageItem(STORAGE_KEY_CUSTOMERS, JSON.stringify(data.customers))
  if (data.ledgerTransactions) setStorageItem(STORAGE_KEY_LEDGER, JSON.stringify(data.ledgerTransactions))
}

export class LocalPreviewFinanceApi implements FinanceApi {
  async listPeople(search = ''): Promise<Customer[]> {
    const { loans, customers } = getLocalStore()
    const seen = new Map<string, Customer>()
    for (const c of customers) {
      seen.set(c.id, c)
    }
    for (const loan of loans) {
      const id = loan.customer_id || `local-${loan.customer_name.toLowerCase()}`
      if (!seen.has(id)) seen.set(id, { id, name: loan.customer_name })
    }
    const query = search.trim().toLowerCase()
    return [...seen.values()].filter((person) => !query || person.name.toLowerCase().includes(query))
  }

  async createCustomer(input: { name: string; phone?: string; address?: string }): Promise<Customer> {
    const store = getLocalStore()
    const customer: Customer = {
      id: crypto.randomUUID(),
      name: input.name.trim(),
      phone: input.phone?.trim() || null,
      address: input.address?.trim() || null,
      created_at: new Date().toISOString(),
    }
    const updated = [customer, ...store.customers]
    saveLocalStore({ customers: updated })
    return customer
  }

  async getCustomerDetail(id: string): Promise<{ customer: Customer; loans: Loan[]; dues: DueReceivableEntry[] } | null> {
    const { customers, loans, dues } = getLocalStore()
    let customer = customers.find((c) => c.id === id)
    if (!customer) {
      const matchedLoan = loans.find((l) => l.customer_id === id || l.customer_name.toLowerCase() === id.toLowerCase())
      if (matchedLoan) {
        customer = { id: matchedLoan.customer_id || id, name: matchedLoan.customer_name }
      }
    }
    if (!customer) return null

    const custLoans = loans.filter((l) => l.customer_id === customer.id || l.customer_name.toLowerCase() === customer.name.toLowerCase())
    const custDues = dues.filter((d) => d.borrower_name.toLowerCase() === customer.name.toLowerCase())
    return { customer, loans: custLoans, dues: custDues }
  }

  async listLoans(filter?: { mode?: ModeKind; status?: 'active' | 'closed'; search?: string }): Promise<Loan[]> {
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

  async getLoanDetail(id: string): Promise<{ loan: Loan; installments: Installment[]; payments: Payment[] } | null> {
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

  async createLoan(input: NewLoanInput): Promise<Loan> {
    const store = getLocalStore()
    const maxSheetNo = store.loans.reduce((max, l) => Math.max(max, l.main_sheet_no), 0)
    const mainSheetNo = input.main_sheet_no || maxSheetNo + 1

    const isDaily = input.mode === 'D'
    const principal = Number(input.principal)
    const interestAmount = isDaily ? Number(input.interest_amount) : 0
    const weeklyPayment = !isDaily ? (input.weekly_payment || 3000) : 0
    const totalExpected = isDaily ? principal + interestAmount * 6 : Number(input.total_return || weeklyPayment * 10)

    const newLoan: Loan = {
      id: `loan-${mainSheetNo}-${Date.now()}`,
      customer_id: input.customer_id || crypto.randomUUID(),
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

  async recordPayment(input: NewPaymentInput): Promise<{ loan: Loan; payment: Payment; installments: Installment[] }> {
    const store = getLocalStore()
    const loanIndex = store.loans.findIndex((l) => l.id === input.loan_id)
    if (loanIndex === -1) throw new Error('Loan not found.')

    const loan = store.loans[loanIndex]
    const loanInsts = store.installments
      .filter((i) => i.loan_id === loan.id)
      .sort((a, b) => a.installment_number - b.installment_number)

    const isPrincipalReturn = loan.mode === 'D' && (input.payment_type === 'Principal' || input.payment_type === 'Interest + Principal')
    const targetInst = isPrincipalReturn ? undefined : input.installment_id
      ? loanInsts.find((i) => i.id === input.installment_id)
      : loanInsts.find((i) => i.status !== 'Paid') || loanInsts[0]

    const effectivePaidDate = input.paid_date || input.payment_date || formatDateISO(new Date())
    const paymentAmount = Number(input.amount)

    let principalAllocation: number | undefined = input.principal_allocation
    let interestAllocation: number | undefined = input.interest_allocation

    if (input.payment_type === 'Principal') {
      principalAllocation = paymentAmount
      interestAllocation = 0
    } else if (input.payment_type === 'Interest' || input.payment_type === 'Weekly Installment') {
      interestAllocation = paymentAmount
      principalAllocation = 0
    } else if (input.payment_type === 'Interest + Principal') {
      if (interestAllocation === undefined) {
        interestAllocation = targetInst?.expected_amount || loan.interest_amount || 0
      }
      if (principalAllocation === undefined) {
        principalAllocation = Math.max(0, paymentAmount - interestAllocation)
      }
    }

    const newPayment: Payment = {
      id: `pay-${Date.now()}`,
      loan_id: loan.id,
      installment_id: targetInst?.id || null,
      customer_name: loan.customer_name,
      main_sheet_no: loan.main_sheet_no,
      mode: loan.mode,
      payment_date: effectivePaidDate,
      amount: paymentAmount,
      payment_type: input.payment_type,
      principal_allocation: principalAllocation,
      interest_allocation: interestAllocation,
      note: input.note?.trim() || null,
      created_at: new Date().toISOString(),
    }

    let updatedInsts = [...store.installments]
    let updatedLoan = { ...loan }

    if (input.payment_type === 'Interest + Principal') {
      const intAlloc = interestAllocation || 0
      const prinAlloc = principalAllocation || 0

      if (targetInst) {
        const instIndex = updatedInsts.findIndex((i) => i.id === targetInst.id)
        if (instIndex !== -1) {
          const inst = { ...updatedInsts[instIndex] }
          inst.paid_amount += intAlloc
          inst.paid_date = effectivePaidDate
          inst.status = inst.paid_amount >= inst.expected_amount ? 'Paid' : 'Partial'
          updatedInsts[instIndex] = inst
        }
      }

      updatedLoan.total_collected += paymentAmount
      updatedLoan.remaining_balance = Math.max(0, updatedLoan.remaining_balance - prinAlloc)
      if (prinAlloc >= updatedLoan.principal) {
        updatedLoan.status = 'closed'
        updatedLoan.closed_at = effectivePaidDate
      }
    } else if (isPrincipalReturn) {
      updatedLoan.total_collected += paymentAmount
      updatedLoan.remaining_balance = Math.max(0, updatedLoan.remaining_balance - paymentAmount)
      updatedLoan.status = 'closed'
      updatedLoan.closed_at = effectivePaidDate
    } else if (targetInst) {
      const instIndex = updatedInsts.findIndex((i) => i.id === targetInst.id)
      if (instIndex !== -1) {
        const inst = { ...updatedInsts[instIndex] }
        inst.paid_amount += paymentAmount
        inst.paid_date = effectivePaidDate
        inst.status = inst.paid_amount >= inst.expected_amount ? 'Paid' : 'Partial'
        updatedInsts[instIndex] = inst

        // Update subsequent due date if Daily
        if (loan.mode === 'D' && inst.status === 'Paid') {
          const nextInst = updatedInsts.find(
            (i) => i.loan_id === loan.id && i.installment_number === inst.installment_number + 1
          )
          if (nextInst && nextInst.status === 'Upcoming') {
            nextInst.due_date = calculateNextDueDate('D', effectivePaidDate)
          }
        }
      }
      updatedLoan.total_collected += paymentAmount
      updatedLoan.remaining_balance = Math.max(0, updatedLoan.remaining_balance - paymentAmount)
      const allPaid = updatedInsts
        .filter((i) => i.loan_id === loan.id)
        .every((i) => i.status === 'Paid')
      if (allPaid && loan.mode === 'W') {
        updatedLoan.status = 'closed'
        updatedLoan.closed_at = effectivePaidDate
      }
    }

    const updatedLoans = [...store.loans]
    updatedLoans[loanIndex] = updatedLoan
    const updatedPayments = [newPayment, ...store.payments]

    saveLocalStore({ loans: updatedLoans, installments: updatedInsts, payments: updatedPayments })
    return {
      loan: updatedLoan,
      payment: newPayment,
      installments: updatedInsts.filter((i) => i.loan_id === loan.id),
    }
  }

  async closeLoan(id: string, reason?: string): Promise<Loan> {
    const store = getLocalStore()
    const index = store.loans.findIndex((l) => l.id === id)
    if (index === -1) throw new Error('Loan not found.')
    const existingRemarks = store.loans[index].source_remarks
    const newRemarks = reason
      ? existingRemarks
        ? `${existingRemarks} | ${reason.trim()}`
        : reason.trim()
      : existingRemarks
    const updated = {
      ...store.loans[index],
      status: 'closed' as const,
      closed_at: formatDateISO(new Date()),
      source_remarks: newRemarks,
      updated_at: new Date().toISOString(),
    }
    const loans = [...store.loans]
    loans[index] = updated
    saveLocalStore({ loans })
    return updated
  }

  async deleteLoan(id: string): Promise<void> {
    const store = getLocalStore()
    const loans = store.loans.filter((l) => l.id !== id)
    const installments = store.installments.filter((i) => i.loan_id !== id)
    const payments = store.payments.filter((p) => p.loan_id !== id)
    saveLocalStore({ loans, installments, payments })
  }

  async listPayments(filter?: { mode?: ModeKind; search?: string }): Promise<Payment[]> {
    const { payments } = getLocalStore()
    return payments.filter((p) => {
      if (filter?.mode && p.mode !== filter.mode) return false
      if (filter?.search) {
        const query = filter.search.toLowerCase()
        const matchesName = p.customer_name.toLowerCase().includes(query)
        const matchesNo = String(p.main_sheet_no).includes(query)
        if (!matchesName && !matchesNo) return false
      }
      return true
    })
  }

  async listInstallments(filter?: { status?: InstallmentStatus; due_date?: string }): Promise<Array<Installment & { loan?: Loan }>> {
    const { installments, loans } = getLocalStore()
    const loanMap = new Map(loans.map((l) => [l.id, l]))
    return installments
      .filter((inst) => {
        if (filter?.status && inst.status !== filter.status) return false
        if (filter?.due_date && inst.due_date !== filter.due_date) return false
        return true
      })
      .map((inst) => ({ ...inst, loan: loanMap.get(inst.loan_id) }))
  }

  async getDashboardMetrics(): Promise<DashboardMetrics> {
    const store = getLocalStore()
    return computeDashboardMetrics(
      store.loans,
      store.installments,
      store.payments,
      store.tenPercentEntries,
      formatDateISO(new Date()),
      store.investments,
      store.interests,
      store.dues
    )
  }

  async listTenPercentEntries(): Promise<TenPercentEntry[]> {
    const { tenPercentEntries } = getLocalStore()
    return tenPercentEntries
  }

  async addTenPercentEntry(entry: NewTenPercentEntry): Promise<TenPercentEntry> {
    const store = getLocalStore()
    const newEntry: TenPercentEntry = {
      id: `ten-${Date.now()}`,
      entry_date: entry.entry_date,
      particulars: entry.particulars.trim(),
      amount: Number(entry.amount),
      main_sheet_no: entry.main_sheet_no || null,
      notes: entry.notes?.trim() || null,
      source_kind: 'manual',
      main_transaction_id: null,
      created_at: new Date().toISOString(),
    }
    const updated = [newEntry, ...store.tenPercentEntries]
    saveLocalStore({ tenPercentEntries: updated })
    return newEntry
  }

  async deleteTenPercentEntry(id: string): Promise<void> {
    const store = getLocalStore()
    const target = store.tenPercentEntries.find((e) => e.id === id)
    if (target?.main_transaction_id) {
      const tx = store.mainTransactions.find((t) => t.id === target.main_transaction_id)
      if (tx) tx.category = null
    }
    const tenPercentEntries = store.tenPercentEntries.filter((e) => e.id !== id)
    saveLocalStore({ mainTransactions: store.mainTransactions, tenPercentEntries })
  }

  async listUntaggedMainTransactions(): Promise<MainTransaction[]> {
    const { mainTransactions } = getLocalStore()
    return mainTransactions.filter((tx) => !tx.category)
  }

  async tagMainTransaction(transactionId: string): Promise<TenPercentEntry> {
    const store = getLocalStore()
    const tx = store.mainTransactions.find((t) => t.id === transactionId)
    if (!tx) throw new Error('Transaction not found.')
    if (tx.category === '10PCT') throw new Error('Transaction is already tagged as 10% profit.')
    tx.category = '10PCT'
    const entry: TenPercentEntry = {
      id: `ten-tag-${tx.id}`,
      entry_date: tx.transaction_date || formatDateISO(new Date()),
      particulars: tx.particulars,
      amount: tx.credit,
      main_sheet_no: tx.main_sheet_no,
      notes: 'Explicitly tagged from MAIN ledger transaction',
      source_kind: 'main_tag',
      main_transaction_id: tx.id,
      created_at: new Date().toISOString(),
    }
    const updated = [entry, ...store.tenPercentEntries.filter((e) => e.main_transaction_id !== tx.id)]
    saveLocalStore({ mainTransactions: store.mainTransactions, tenPercentEntries: updated })
    return entry
  }

  async untagMainTransaction(transactionId: string): Promise<void> {
    const store = getLocalStore()
    const tx = store.mainTransactions.find((t) => t.id === transactionId)
    if (tx) {
      tx.category = null
    }
    const updated = store.tenPercentEntries.filter(
      (e) => e.main_transaction_id !== transactionId && e.id !== `ten-tag-${transactionId}`
    )
    saveLocalStore({ mainTransactions: store.mainTransactions, tenPercentEntries: updated })
  }

  async listInvestments(): Promise<InvestmentEntry[]> {
    const { investments } = getLocalStore()
    return investments
  }

  async addInvestment(input: NewInvestmentInput): Promise<InvestmentEntry> {
    const store = getLocalStore()
    const entry: InvestmentEntry = {
      id: `inv-${Date.now()}`,
      entry_date: input.entry_date,
      investor_name: input.investor_name.trim(),
      amount: Number(input.amount),
      notes: input.notes?.trim() || null,
      created_at: new Date().toISOString(),
    }
    const updated = [entry, ...store.investments]
    saveLocalStore({ investments: updated })
    return entry
  }

  async deleteInvestment(id: string): Promise<void> {
    const store = getLocalStore()
    const investments = store.investments.filter((i) => i.id !== id)
    saveLocalStore({ investments })
  }

  async listInterests(): Promise<InterestEntry[]> {
    const { interests } = getLocalStore()
    return interests
  }

  async addInterest(input: NewInterestInput): Promise<InterestEntry> {
    const store = getLocalStore()
    const entry: InterestEntry = {
      id: `int-${Date.now()}`,
      entry_date: input.entry_date,
      customer_name: input.customer_name.trim(),
      ac_no: input.ac_no || null,
      amount: Number(input.amount),
      notes: input.notes?.trim() || null,
      created_at: new Date().toISOString(),
    }
    const updated = [entry, ...store.interests]
    saveLocalStore({ interests: updated })
    return entry
  }

  async deleteInterest(id: string): Promise<void> {
    const store = getLocalStore()
    const interests = store.interests.filter((i) => i.id !== id)
    saveLocalStore({ interests })
  }

  async listDues(): Promise<DueReceivableEntry[]> {
    const { dues } = getLocalStore()
    return dues
  }

  async addDue(input: NewDueInput): Promise<DueReceivableEntry> {
    const store = getLocalStore()
    const entry: DueReceivableEntry = {
      id: `due-${Date.now()}`,
      due_date: input.due_date,
      borrower_name: input.borrower_name.trim(),
      amount: Number(input.amount),
      settled_amount: 0,
      remaining_amount: Number(input.amount),
      status: 'unpaid',
      notes: input.notes?.trim() || null,
      created_at: new Date().toISOString(),
    }
    const updated = [entry, ...store.dues]
    saveLocalStore({ dues: updated })
    return entry
  }

  async settleDue(id: string, settleAmount: number): Promise<DueReceivableEntry> {
    const store = getLocalStore()
    const index = store.dues.findIndex((d) => d.id === id)
    if (index === -1) throw new Error('Due record not found.')
    const due = { ...store.dues[index] }
    due.settled_amount += Number(settleAmount)
    due.remaining_amount = Math.max(0, due.amount - due.settled_amount)
    due.status = due.remaining_amount <= 0 ? 'settled' : 'partial'
    const updated = [...store.dues]
    updated[index] = due
    saveLocalStore({ dues: updated })
    return due
  }

  async deleteDue(id: string): Promise<void> {
    const store = getLocalStore()
    const dues = store.dues.filter((d) => d.id !== id)
    saveLocalStore({ dues })
  }

  async listLedgerTransactions(): Promise<FinancialLedgerTransaction[]> {
    const { ledgerTransactions } = getLocalStore()
    return ledgerTransactions
  }

  async importFullFinanceData(data: ImportedFinanceData): Promise<void> {
    const loans: Loan[] = data.loans.map((raw) => {
      const isDaily = raw.mode === 'D'
      const principal = raw.principal
      const interestAmount = isDaily ? Math.round(principal * 0.03) : 0
      const weeklyPayment = !isDaily ? 3000 : 0
      const totalExpected = isDaily ? principal + interestAmount * 6 : 30000
      const isClosed = Boolean(raw.cleared) || raw.sourceCredit >= principal
      return {
        id: `loan-${raw.mainSheetNo}-${raw.sourceKey.replace(/[^a-zA-Z0-9-]/g, '-')}`,
        main_sheet_no: raw.mainSheetNo,
        customer_name: raw.customerName,
        mode: raw.mode,
        loan_date: raw.loanDate,
        principal,
        interest_amount: interestAmount,
        weekly_payment: weeklyPayment,
        total_expected: totalExpected,
        total_collected: raw.sourceCredit,
        remaining_balance: Math.max(0, totalExpected - raw.sourceCredit),
        status: isClosed ? 'closed' : 'active',
        closed_at: isClosed ? raw.loanDate : null,
        source_remarks: raw.sourceRemarks,
        created_at: new Date(raw.loanDate).toISOString(),
        updated_at: new Date().toISOString(),
      }
    })

    const tenPercentEntries: TenPercentEntry[] = data.tenPercentEntries.map((raw, idx) => ({
      id: `ten-imp-${idx}`,
      entry_date: raw.date,
      particulars: raw.particulars,
      amount: raw.amount,
      main_sheet_no: raw.mainSheetNo,
      notes: 'Imported from verified 10% profit ledger',
      source_kind: 'imported',
      main_transaction_id: null,
      created_at: new Date().toISOString(),
    }))

    const installments: Installment[] = []
    loans.forEach((loan) => {
      const insts = loan.mode === 'D'
        ? generateDailyInstallments(loan.id, loan.loan_date, undefined, loan.interest_amount)
        : generateWeeklyInstallments(loan.id, loan.loan_date, undefined, loan.weekly_payment)
      installments.push(...insts)
    })

    saveLocalStore({
      loans,
      installments,
      tenPercentEntries,
      investments: data.investments,
      interests: data.interests,
      dues: data.dues,
    })
  }

  async clearAllData(): Promise<void> {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        for (let i = window.localStorage.length - 1; i >= 0; i--) {
          const k = window.localStorage.key(i)
          if (k && k.startsWith('finance-tracker-')) {
            window.localStorage.removeItem(k)
          }
        }
      }
    } catch {
      // Ignore
    }
    memoryStore.clear()
    setStorageItem(STORAGE_KEY_LOANS, JSON.stringify([]))
    setStorageItem(STORAGE_KEY_INSTALLMENTS, JSON.stringify([]))
    setStorageItem(STORAGE_KEY_PAYMENTS, JSON.stringify([]))
    setStorageItem(STORAGE_KEY_TEN_PERCENT, JSON.stringify([]))
    setStorageItem(STORAGE_KEY_MAIN_TX, JSON.stringify([]))
    setStorageItem(STORAGE_KEY_INVESTMENTS, JSON.stringify([]))
    setStorageItem(STORAGE_KEY_INTERESTS, JSON.stringify([]))
    setStorageItem(STORAGE_KEY_DUES, JSON.stringify([]))
    setStorageItem(STORAGE_KEY_CUSTOMERS, JSON.stringify([]))
    setStorageItem(STORAGE_KEY_LEDGER, JSON.stringify([]))
  }
}

export class SupabaseFinanceApi implements FinanceApi {
  async listPeople(search = ''): Promise<Customer[]> {
    let query = supabase!.from('customers').select('*').order('name').limit(20)
    if (search.trim()) query = query.ilike('name', `%${search.trim()}%`)
    const { data, error } = await query
    if (error) throw error
    return (data || []) as Customer[]
  }

  async createCustomer(input: { name: string; phone?: string; address?: string }): Promise<Customer> {
    const { data, error } = await supabase!
      .from('customers')
      .insert({
        name: input.name.trim(),
        phone: input.phone?.trim() || null,
        address: input.address?.trim() || null,
      })
      .select('*')
      .single()
    if (error) throw error
    return data as Customer
  }

  async getCustomerDetail(id: string): Promise<{ customer: Customer; loans: Loan[]; dues: DueReceivableEntry[] } | null> {
    const { data: customer, error: custErr } = await supabase!.from('customers').select('*').eq('id', id).single()
    if (custErr || !customer) return null

    const [{ data: loans }, { data: dues }] = await Promise.all([
      supabase!.from('loans').select('*').eq('customer_id', id).order('loan_date', { ascending: false }),
      supabase!.from('due_receivables').select('*').eq('borrower_name', customer.name).order('due_date', { ascending: false }),
    ])

    return {
      customer: customer as Customer,
      loans: (loans || []) as Loan[],
      dues: (dues || []) as DueReceivableEntry[],
    }
  }

  async listLoans(filter?: { mode?: ModeKind; status?: 'active' | 'closed'; search?: string }): Promise<Loan[]> {
    let query = supabase!.from('loans').select('*').order('loan_date', { ascending: false })
    if (filter?.mode) query = query.eq('mode', filter.mode)
    if (filter?.status) query = query.eq('status', filter.status)
    if (filter?.search) query = query.ilike('customer_name', `%${filter.search}%`)
    const { data, error } = await query
    if (error) throw error
    return (data || []) as Loan[]
  }

  async getLoanDetail(id: string): Promise<{ loan: Loan; installments: Installment[]; payments: Payment[] } | null> {
    const { data: loan, error: loanErr } = await supabase!.from('loans').select('*').eq('id', id).single()
    if (loanErr || !loan) return null

    const [{ data: installments }, { data: payments }] = await Promise.all([
      supabase!
        .from('installments')
        .select('*')
        .eq('loan_id', id)
        .order('installment_number', { ascending: true }),
      supabase!
        .from('payments')
        .select('*')
        .eq('loan_id', id)
        .order('payment_date', { ascending: false }),
    ])

    return {
      loan: loan as Loan,
      installments: (installments || []) as Installment[],
      payments: (payments || []) as Payment[],
    }
  }

  async createLoan(input: NewLoanInput): Promise<Loan> {
    const isDaily = input.mode === 'D'
    const principal = Number(input.principal)
    const interestAmount = isDaily ? Number(input.interest_amount) : 0
    const weeklyPayment = !isDaily ? (input.weekly_payment || 3000) : 0
    const totalExpected = isDaily ? principal + interestAmount * 6 : Number(input.total_return || weeklyPayment * 10)

    const { data: loan, error } = await supabase!.rpc('create_loan_account', {
      p_customer_id: input.customer_id || null,
      p_person_name: input.customer_name.trim(),
      p_phone: input.phone || '',
      p_address: input.address || '',
      p_mode: input.mode,
      p_loan_date: input.loan_date,
      p_principal: principal,
      p_interest_amount: interestAmount,
      p_weekly_payment: weeklyPayment,
      p_total_return: totalExpected,
      p_first_due_date: input.first_due_date || null,
    })
    if (error || !loan) throw new Error(error?.message || 'Unable to create account')
    return loan as Loan
  }

  async recordPayment(input: NewPaymentInput): Promise<{ loan: Loan; payment: Payment; installments: Installment[] }> {
    const { data, error } = await supabase!.rpc('record_loan_payment', {
      p_loan_id: input.loan_id,
      p_installment_id: input.installment_id || null,
      p_paid_date: input.paid_date || input.payment_date || formatDateISO(new Date()),
      p_amount: Number(input.amount),
      p_payment_type: input.payment_type,
      p_note: input.note?.trim() || null,
    })

    if (error || !data) throw new Error(error?.message || 'Database transaction failed')

    const { data: installments, error: installmentsError } = await supabase!
      .from('installments')
      .select('*')
      .eq('loan_id', input.loan_id)
      .order('installment_number', { ascending: true })
    if (installmentsError) throw new Error(`Payment saved, but refresh failed: ${installmentsError.message}`)

    const result = data as { loan: Loan; payment: Payment }
    return { ...result, installments: (installments || []) as Installment[] }
  }

  async closeLoan(id: string, reason?: string): Promise<Loan> {
    const { data: current } = await supabase!.from('loans').select('source_remarks').eq('id', id).single()
    const existingRemarks = current?.source_remarks
    const newRemarks = reason
      ? existingRemarks
        ? `${existingRemarks} | ${reason.trim()}`
        : reason.trim()
      : existingRemarks
    const { data, error } = await supabase!
      .from('loans')
      .update({
        status: 'closed',
        closed_at: new Date().toISOString(),
        source_remarks: newRemarks,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return data as Loan
  }

  async deleteLoan(id: string): Promise<void> {
    const { error } = await supabase!.from('loans').delete().eq('id', id)
    if (error) throw new Error(`Unable to delete account: ${error.message}`)
  }

  async listPayments(filter?: { mode?: ModeKind; search?: string }): Promise<Payment[]> {
    let query = supabase!.from('payments').select('*').order('payment_date', { ascending: false })
    if (filter?.mode) query = query.eq('mode', filter.mode)
    if (filter?.search) query = query.ilike('customer_name', `%${filter.search}%`)
    const { data, error } = await query
    if (error) throw error
    return (data || []) as Payment[]
  }

  async listInstallments(filter?: { status?: InstallmentStatus; due_date?: string }): Promise<Array<Installment & { loan?: Loan }>> {
    let query = supabase!.from('installments').select('*, loan:loans(*)')
    if (filter?.status) query = query.eq('status', filter.status)
    if (filter?.due_date) query = query.eq('due_date', filter.due_date)
    const { data, error } = await query
    if (error) throw error
    return (data || []) as Array<Installment & { loan?: Loan }>
  }

  async getDashboardMetrics(): Promise<DashboardMetrics> {
    const [loansRes, instsRes, paysRes, tpRes, invRes, intRes, dueRes] = await Promise.all([
      supabase!.from('loans').select('*'),
      supabase!.from('installments').select('*'),
      supabase!.from('payments').select('*'),
      supabase!.from('ten_percent_entries').select('*'),
      supabase!.from('investment_entries').select('*'),
      supabase!.from('interest_entries').select('*'),
      supabase!.from('due_receivables').select('*'),
    ])

    if (loansRes.error) throw new Error(`Unable to load dashboard totals: ${loansRes.error.message}`)
    if (instsRes.error) throw new Error(`Unable to load dashboard totals: ${instsRes.error.message}`)
    if (paysRes.error) throw new Error(`Unable to load dashboard totals: ${paysRes.error.message}`)
    if (tpRes.error) throw new Error(`Unable to load dashboard totals: ${tpRes.error.message}`)

    return computeDashboardMetrics(
      loansRes.data || [],
      instsRes.data || [],
      paysRes.data || [],
      tpRes.data || [],
      formatDateISO(new Date()),
      invRes.data || [],
      intRes.data || [],
      dueRes.data || []
    )
  }

  async listTenPercentEntries(): Promise<TenPercentEntry[]> {
    const { data, error } = await supabase!
      .from('ten_percent_entries')
      .select('*')
      .order('entry_date', { ascending: false })
    if (error) throw error
    return (data || []) as TenPercentEntry[]
  }

  async addTenPercentEntry(entry: NewTenPercentEntry): Promise<TenPercentEntry> {
    const { data, error } = await supabase!
      .from('ten_percent_entries')
      .insert({ ...entry, source_kind: 'manual' })
      .select('*')
      .single()
    if (error) throw error
    return data as TenPercentEntry
  }

  async deleteTenPercentEntry(id: string): Promise<void> {
    const { data } = await supabase!.from('ten_percent_entries').select('main_transaction_id').eq('id', id).maybeSingle()
    if (data?.main_transaction_id) {
      await supabase!.from('main_transactions').update({ category: null }).eq('id', data.main_transaction_id)
    }
    const { error } = await supabase!.from('ten_percent_entries').delete().eq('id', id)
    if (error) throw error
  }

  async listUntaggedMainTransactions(): Promise<MainTransaction[]> {
    const { data, error } = await supabase!
      .from('main_transactions')
      .select('*')
      .is('category', null)
      .order('main_sheet_no', { ascending: true })
    if (error) throw error
    return (data || []) as MainTransaction[]
  }

  async tagMainTransaction(transactionId: string): Promise<TenPercentEntry> {
    const { data, error } = await supabase!
      .rpc('tag_main_transaction_as_ten_percent', { p_transaction_id: transactionId })
    if (error) throw error
    return data as TenPercentEntry
  }

  async untagMainTransaction(transactionId: string): Promise<void> {
    const { error: deleteError } = await supabase!
      .from('ten_percent_entries')
      .delete()
      .eq('main_transaction_id', transactionId)
    if (deleteError) throw deleteError
    const { error: updateError } = await supabase!
      .from('main_transactions')
      .update({ category: null })
      .eq('id', transactionId)
    if (updateError) throw updateError
  }

  async listInvestments(): Promise<InvestmentEntry[]> {
    const { data, error } = await supabase!
      .from('investment_entries')
      .select('*')
      .order('entry_date', { ascending: false })
    if (error) throw error
    return (data || []) as InvestmentEntry[]
  }

  async addInvestment(input: NewInvestmentInput): Promise<InvestmentEntry> {
    const { data, error } = await supabase!
      .from('investment_entries')
      .insert({
        entry_date: input.entry_date,
        investor_name: input.investor_name.trim(),
        amount: Number(input.amount),
        notes: input.notes?.trim() || null,
      })
      .select('*')
      .single()
    if (error) throw error
    return data as InvestmentEntry
  }

  async deleteInvestment(id: string): Promise<void> {
    const { error } = await supabase!.from('investment_entries').delete().eq('id', id)
    if (error) throw error
  }

  async listInterests(): Promise<InterestEntry[]> {
    const { data, error } = await supabase!
      .from('interest_entries')
      .select('*')
      .order('entry_date', { ascending: false })
    if (error) throw error
    return (data || []) as InterestEntry[]
  }

  async addInterest(input: NewInterestInput): Promise<InterestEntry> {
    const { data, error } = await supabase!
      .from('interest_entries')
      .insert({
        entry_date: input.entry_date,
        customer_name: input.customer_name.trim(),
        ac_no: input.ac_no || null,
        amount: Number(input.amount),
        notes: input.notes?.trim() || null,
      })
      .select('*')
      .single()
    if (error) throw error
    return data as InterestEntry
  }

  async deleteInterest(id: string): Promise<void> {
    const { error } = await supabase!.from('interest_entries').delete().eq('id', id)
    if (error) throw error
  }

  async listDues(): Promise<DueReceivableEntry[]> {
    const { data, error } = await supabase!
      .from('due_receivables')
      .select('*')
      .order('due_date', { ascending: false })
    if (error) throw error
    return (data || []) as DueReceivableEntry[]
  }

  async addDue(input: NewDueInput): Promise<DueReceivableEntry> {
    const amount = Number(input.amount)
    const { data, error } = await supabase!
      .from('due_receivables')
      .insert({
        due_date: input.due_date,
        borrower_name: input.borrower_name.trim(),
        amount,
        settled_amount: 0,
        remaining_amount: amount,
        status: 'unpaid',
        notes: input.notes?.trim() || null,
      })
      .select('*')
      .single()
    if (error) throw error
    return data as DueReceivableEntry
  }

  async settleDue(id: string, settleAmount: number): Promise<DueReceivableEntry> {
    const { data: existing, error: fetchErr } = await supabase!
      .from('due_receivables')
      .select('*')
      .eq('id', id)
      .single()
    if (fetchErr || !existing) throw new Error('Due record not found')

    const newSettled = Number(existing.settled_amount || 0) + Number(settleAmount)
    const newRemaining = Math.max(0, Number(existing.amount) - newSettled)
    const newStatus = newRemaining <= 0 ? 'settled' : 'partial'

    const { data, error } = await supabase!
      .from('due_receivables')
      .update({
        settled_amount: newSettled,
        remaining_amount: newRemaining,
        status: newStatus,
      })
      .eq('id', id)
      .select('*')
      .single()
    if (error) throw error
    return data as DueReceivableEntry
  }

  async deleteDue(id: string): Promise<void> {
    const { error } = await supabase!.from('due_receivables').delete().eq('id', id)
    if (error) throw error
  }

  async listLedgerTransactions(): Promise<FinancialLedgerTransaction[]> {
    const { data, error } = await supabase!
      .from('ledger_transactions')
      .select('*')
      .order('transaction_date', { ascending: false })
    if (error) throw error
    return (data || []) as FinancialLedgerTransaction[]
  }

  async importFullFinanceData(data: ImportedFinanceData): Promise<void> {
    if (data.investments.length > 0) {
      await supabase!.from('investment_entries').upsert(data.investments)
    }
    if (data.interests.length > 0) {
      await supabase!.from('interest_entries').upsert(data.interests)
    }
    if (data.dues.length > 0) {
      await supabase!.from('due_receivables').upsert(data.dues)
    }
    if (data.tenPercentEntries.length > 0) {
      const formatted = data.tenPercentEntries.map((t) => ({
        entry_date: t.date,
        particulars: t.particulars,
        amount: t.amount,
        main_sheet_no: t.mainSheetNo,
        source_kind: 'imported',
      }))
      await supabase!.from('ten_percent_entries').insert(formatted)
    }
  }

  async clearAllData(): Promise<void> {
    if (!supabase) return
    for (const table of [
      'payments',
      'installments',
      'loans',
      'customers',
      'ten_percent_entries',
      'main_transactions',
      'investment_entries',
      'interest_entries',
      'due_receivables',
      'ledger_transactions',
    ] as const) {
      await supabase.from(table).delete().not('id', 'is', null)
    }
  }
}

export const financeApi: FinanceApi = supabase ? new SupabaseFinanceApi() : new LocalPreviewFinanceApi()
