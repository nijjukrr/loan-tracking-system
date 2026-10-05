import type { MainTransaction, NewTenPercentEntry, TenPercentEntry } from '../types'
import { supabase } from './supabase'

export interface FinanceApi {
  listTenPercentEntries(): Promise<TenPercentEntry[]>
  addTenPercentEntry(entry: NewTenPercentEntry): Promise<TenPercentEntry>
  listUntaggedMainTransactions(): Promise<MainTransaction[]>
  tagMainTransaction(transactionId: string): Promise<TenPercentEntry>
}

class SupabaseFinanceApi implements FinanceApi {
  async listTenPercentEntries() {
    const { data, error } = await supabase!
      .from('ten_percent_entries')
      .select('id, entry_date, particulars, amount, main_sheet_no, notes, source_kind, main_transaction_id, created_at')
      .order('entry_date', { ascending: false })
      .order('created_at', { ascending: false })
    if (error) throw error
    return (data ?? []) as TenPercentEntry[]
  }

  async addTenPercentEntry(entry: NewTenPercentEntry) {
    const { data, error } = await supabase!
      .from('ten_percent_entries')
      .insert({ ...entry, source_kind: 'manual' })
      .select('id, entry_date, particulars, amount, main_sheet_no, notes, source_kind, main_transaction_id, created_at')
      .single()
    if (error) throw error
    return data as TenPercentEntry
  }

  async listUntaggedMainTransactions() {
    const { data, error } = await supabase!
      .from('main_transactions')
      .select('id, main_sheet_no, transaction_date, particulars, credit, category')
      .is('category', null)
      .order('main_sheet_no', { ascending: true })
    if (error) throw error
    return (data ?? []) as MainTransaction[]
  }

  async tagMainTransaction(transactionId: string) {
    const { data, error } = await supabase!
      .rpc('tag_main_transaction_as_ten_percent', { p_transaction_id: transactionId })
    if (error) throw error
    return data as TenPercentEntry
  }
}

const ENTRY_KEY = 'finance-demo-ten-percent-entries-v2'
const MAIN_KEY = 'finance-demo-main-transactions-v2'

function readLocal<T>(key: string, fallback: T): T {
  const stored = localStorage.getItem(key)
  return stored ? (JSON.parse(stored) as T) : fallback
}

function writeLocal<T>(key: string, value: T) {
  localStorage.setItem(key, JSON.stringify(value))
}

class LocalPreviewFinanceApi implements FinanceApi {
  async listTenPercentEntries() {
    return readLocal<TenPercentEntry[]>(ENTRY_KEY, [])
  }

  async addTenPercentEntry(entry: NewTenPercentEntry) {
    const record: TenPercentEntry = {
      id: crypto.randomUUID(),
      ...entry,
      source_kind: 'manual',
      main_transaction_id: null,
      created_at: new Date().toISOString(),
    }
    const entries = readLocal<TenPercentEntry[]>(ENTRY_KEY, [])
    writeLocal(ENTRY_KEY, [record, ...entries])
    return record
  }

  async listUntaggedMainTransactions() {
    return readLocal<MainTransaction[]>(MAIN_KEY, []).filter((transaction) => transaction.category === null)
  }

  async tagMainTransaction(transactionId: string) {
    const transactions = readLocal<MainTransaction[]>(MAIN_KEY, [])
    const transaction = transactions.find((item) => item.id === transactionId)
    if (!transaction) throw new Error('MAIN transaction not found.')
    transaction.category = '10PCT'
    writeLocal(MAIN_KEY, transactions)

    const entry: TenPercentEntry = {
      id: crypto.randomUUID(),
      entry_date: transaction.transaction_date ?? new Date().toISOString().slice(0, 10),
      particulars: transaction.particulars,
      amount: transaction.credit,
      main_sheet_no: transaction.main_sheet_no,
      notes: null,
      source_kind: 'main_tag',
      main_transaction_id: transaction.id,
      created_at: new Date().toISOString(),
    }
    const entries = readLocal<TenPercentEntry[]>(ENTRY_KEY, [])
    writeLocal(ENTRY_KEY, [entry, ...entries])
    return entry
  }
}

export const financeApi: FinanceApi = supabase ? new SupabaseFinanceApi() : new LocalPreviewFinanceApi()
