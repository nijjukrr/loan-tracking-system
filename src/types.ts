export type TenPercentEntry = {
  id: string
  entry_date: string
  particulars: string
  amount: number
  main_sheet_no: number | null
  notes: string | null
  source_kind: 'manual' | 'main_tag'
  main_transaction_id: string | null
  created_at: string
}

export type NewTenPercentEntry = {
  entry_date: string
  particulars: string
  amount: number
  main_sheet_no: number | null
  notes: string | null
}

export type MainTransaction = {
  id: string
  main_sheet_no: number
  transaction_date: string | null
  particulars: string
  credit: number
  category: '10PCT' | null
}
