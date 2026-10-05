import type { NewTenPercentEntry, TenPercentEntry } from '../types'

export function calculateTenPercentProfit(entries: TenPercentEntry[]) {
  return entries.reduce((total, entry) => total + Number(entry.amount), 0)
}

export function validateTenPercentEntry(entry: NewTenPercentEntry) {
  const errors: Partial<Record<keyof NewTenPercentEntry, string>> = {}

  if (!entry.entry_date) errors.entry_date = 'Date is required.'
  if (!entry.particulars.trim()) errors.particulars = 'Name or particulars is required.'
  if (!Number.isFinite(entry.amount) || entry.amount <= 0) errors.amount = 'Enter an amount greater than zero.'
  if (entry.main_sheet_no !== null && (!Number.isInteger(entry.main_sheet_no) || entry.main_sheet_no <= 0)) {
    errors.main_sheet_no = 'Main Sheet No must be a positive whole number.'
  }

  return errors
}

export function hasValidationErrors(errors: ReturnType<typeof validateTenPercentEntry>) {
  return Object.keys(errors).length > 0
}
