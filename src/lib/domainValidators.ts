import type {
  NewDueInput,
  NewInterestInput,
  NewInvestmentInput,
  NewLoanInput,
  NewPaymentInput,
  NewTenPercentEntry,
} from '../types'

export class DomainValidationError extends Error {
  readonly field: string
  constructor(field: string, message: string) {
    super(message)
    this.field = field
    this.name = 'DomainValidationError'
  }
}

export function validateNewLoanInput(input: NewLoanInput): void {
  if (!input.customer_name || input.customer_name.trim().length === 0) {
    throw new DomainValidationError('customer_name', 'Customer/borrower name is required')
  }
  if (!input.mode || (input.mode !== 'D' && input.mode !== 'W')) {
    throw new DomainValidationError('mode', 'Mode must be either Daily (D) or Weekly (W)')
  }
  if (typeof input.principal !== 'number' || isNaN(input.principal) || input.principal <= 0) {
    throw new DomainValidationError('principal', 'Principal amount must be greater than zero')
  }
  if (!input.loan_date || !/^\d{4}-\d{2}-\d{2}$/.test(input.loan_date)) {
    throw new DomainValidationError('loan_date', 'Loan date must be a valid ISO date string (YYYY-MM-DD)')
  }
}

export function validatePaymentInput(input: NewPaymentInput): void {
  if (!input.loan_id || input.loan_id.trim().length === 0) {
    throw new DomainValidationError('loan_id', 'Valid Loan ID is required for recording payment')
  }
  if (typeof input.amount !== 'number' || isNaN(input.amount) || input.amount <= 0) {
    throw new DomainValidationError('amount', 'Payment amount must be greater than zero')
  }
  if (!input.payment_date || !/^\d{4}-\d{2}-\d{2}$/.test(input.payment_date)) {
    throw new DomainValidationError('payment_date', 'Payment date must be a valid ISO date string (YYYY-MM-DD)')
  }
  const allowedTypes = ['Interest', 'Weekly Installment', 'Principal', 'Interest + Principal', 'Partial', 'Other']
  if (!allowedTypes.includes(input.payment_type)) {
    throw new DomainValidationError('payment_type', `Payment type must be one of: ${allowedTypes.join(', ')}`)
  }
}

export function validateInvestmentInput(input: NewInvestmentInput): void {
  if (!input.investor_name || input.investor_name.trim().length === 0) {
    throw new DomainValidationError('investor_name', 'Investor name is required')
  }
  if (typeof input.amount !== 'number' || isNaN(input.amount) || input.amount <= 0) {
    throw new DomainValidationError('amount', 'Investment amount must be greater than zero')
  }
  if (!input.entry_date || !/^\d{4}-\d{2}-\d{2}$/.test(input.entry_date)) {
    throw new DomainValidationError('entry_date', 'Entry date must be a valid ISO date string (YYYY-MM-DD)')
  }
}

export function validateInterestInput(input: NewInterestInput): void {
  if (!input.customer_name || input.customer_name.trim().length === 0) {
    throw new DomainValidationError('customer_name', 'Customer name is required')
  }
  if (typeof input.amount !== 'number' || isNaN(input.amount) || input.amount <= 0) {
    throw new DomainValidationError('amount', 'Interest amount must be greater than zero')
  }
  if (!input.entry_date || !/^\d{4}-\d{2}-\d{2}$/.test(input.entry_date)) {
    throw new DomainValidationError('entry_date', 'Entry date must be a valid ISO date string (YYYY-MM-DD)')
  }
}

export function validateDueInput(input: NewDueInput): void {
  if (!input.borrower_name || input.borrower_name.trim().length === 0) {
    throw new DomainValidationError('borrower_name', 'Borrower name is required')
  }
  if (typeof input.amount !== 'number' || isNaN(input.amount) || input.amount <= 0) {
    throw new DomainValidationError('amount', 'Due amount must be greater than zero')
  }
  if (!input.due_date || !/^\d{4}-\d{2}-\d{2}$/.test(input.due_date)) {
    throw new DomainValidationError('due_date', 'Due date must be a valid ISO date string (YYYY-MM-DD)')
  }
}

export function validateTenPercentEntry(entry: NewTenPercentEntry): void {
  if (!entry.particulars || entry.particulars.trim().length === 0) {
    throw new DomainValidationError('particulars', 'Particulars description is required')
  }
  if (typeof entry.amount !== 'number' || isNaN(entry.amount) || entry.amount <= 0) {
    throw new DomainValidationError('amount', 'Profit amount must be greater than zero')
  }
  if (!entry.entry_date || !/^\d{4}-\d{2}-\d{2}$/.test(entry.entry_date)) {
    throw new DomainValidationError('entry_date', 'Entry date must be a valid ISO date string (YYYY-MM-DD)')
  }
}
