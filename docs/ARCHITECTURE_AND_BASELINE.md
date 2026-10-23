# Nijju Finance Tracker — Architecture, Audit & Baseline Requirements

## 1. Project Overview & Scope
**Nijju Finance Tracker** is a production-grade personal loan, collection, profit, and financial accounting management application.
- **Repository**: `https://github.com/nijjukrr/loan-tracking-system`
- **Tech Stack**: React 19, TypeScript, Vite 8, Supabase (PostgreSQL, Row Level Security, Auth), ExcelJS, Vitest, Oxlint.
- **Primary Source of Truth**: `C:/Users/nijju/OneDrive/Documents/Nijju acc/NISHANTH-2026.xlsx` containing historical financial ledgers across sheets:
  - `PLAN`: P&L and Balance Sheet summary (Total ledger value ₹2,10,920; Cash in hand ₹48,920; Loans disbursed ₹1,62,000).
  - `SEP&OCT`: 4 segregated transaction ledgers:
    - **Investment Received**: 8 entries totalling **₹1,85,000**.
    - **Interest Received**: 9 entries totalling **₹4,950**.
    - **10% Profit**: 24 entries totalling **₹8,970**.
    - **Outstanding Dues**: 6 entries totalling **₹12,000**.
  - `LOAN`: 17 loan ledger rows totalling **₹1,62,000** principal disbursed across Daily (D) and Weekly (W) accounts, including historical closed accounts.

---

## 2. Existing Architecture & Directory Map
```
loan-tracking-system/
├── src/
│   ├── components/            # UI Pages & Modals
│   │   ├── ActiveAccountsPage.tsx   # Open loan portfolio
│   │   ├── AppLayout.tsx            # Main shell with sidebar navigation
│   │   ├── BorrowerDetailPage.tsx   # Per-borrower/loan schedule & payment history
│   │   ├── ClosedAccountsPage.tsx   # Historical closed loan records
│   │   ├── DailyPage.tsx            # 10-day interest cycle tracking
│   │   ├── DashboardPage.tsx        # Financial KPIs and portfolio summary
│   │   ├── MarkPaidModal.tsx        # Payment recording modal
│   │   ├── NewLoanModal.tsx         # Loan creation modal
│   │   ├── PaymentsPage.tsx         # Ledger of all collections
│   │   ├── RemindersPage.tsx        # Due today, upcoming, overdue tracker
│   │   ├── TenPercentPage.tsx       # 10% profit ledger & MAIN transaction tagging
│   │   └── WeeklyPage.tsx           # 10-week installment loan tracker
│   ├── lib/                   # Business logic, math & API
│   │   ├── financeApi.ts            # Data access abstraction (Supabase & Local Preview)
│   │   ├── financeLogic.ts          # Pure domain rules, schedules, profit calculations
│   │   └── supabase.ts              # Supabase client initialization & auth helpers
│   ├── types.ts               # Core TypeScript domain definitions
│   └── main.tsx               # App entrypoint & routing
├── supabase/
│   └── migrations/            # Version-controlled SQL migrations
├── scripts/                   # Import, admin & seed scripts
│   ├── import-excel.ts        # Excel parser
│   ├── seed-supabase.ts       # Database seeder
│   └── finance-data-admin.ts  # Administrative backup and reset utilities
```

---

## 3. Discovered Defects & Accounting Discrepancies

### A. The 10% Profit Misclassification Defect
- **Prior Defect**: Previous import logic took miscellaneous credits from the generic `nijju2026.xlsx` MAIN sheet, summing to an erroneous **₹1,61,010**.
- **Source Truth**: `NISHANTH-2026.xlsx` (sheet `SEP&OCT`, columns F-I) explicitly documents 24 individual profit entries totalling **₹8,970**. Large credits (such as ₹27,000, ₹50,000, ₹30,000) are **investments**, not 10% profit.

### B. Database Schema Constraints on Account Numbers
- **Prior Defect**: `public.loans` had `main_sheet_no bigint unique not null`.
- **Source Truth**: In the real business ledger, multiple loans exist for the same borrower with identical account numbers (e.g., Kavitha A/C 3 has two loans: ₹15,000 and ₹20,000; Kalyanam A/C 7 has two loans: ₹15,000 and ₹15,000; Pattani A/C 5 has four historical entries). Reused account numbers must be supported by assigning distinct immutable UUIDs for `loan_id`.

### C. Cash Reconciliation & Outstanding Dues
- **Workbook Equation**:
  `₹1,85,000 (Investment) + ₹4,950 (Interest) + ₹8,970 (10% Profit) + ₹12,000 (Dues) = ₹2,10,920`
  `₹2,10,920 - ₹1,62,000 (Loan Principal) = ₹48,920 (Workbook Cash in Hand)`
- **Accounting Distinction**:
  - The ₹12,000 in Dues represents **uncollected receivables** (unpaid installments from Ajith, Shanthi, Divya).
  - Therefore, the actual transaction-derived physical cash balance is:
    `₹48,920 - ₹12,000 = ₹36,920`.
  - The system must display both the reported workbook cash (₹48,920) and the transaction-verified cash (₹36,920), clearly flagging the ₹12,000 receivable difference.

### D. Missing First-Class Entities
- The initial schema lacked dedicated tables/models for:
  1. `InvestmentEntry` (₹1,85,000)
  2. `InterestEntry` (₹4,950)
  3. `DueEntry` (₹12,000)
  4. `FinancialLedgerTransaction` (double-entry/unified cash ledger)
  5. `AuditLog` (change history & correction audit trail)
  6. `ImportBatch` (repeatable, duplicate-safe workbook imports)

---

## 4. Testing & Verification Baseline
- **Build Status**: `tsc -b && vite build` passing cleanly.
- **Lint Status**: `oxlint` passing with 0 errors and 0 warnings.
- **Test Suite**: `vitest` currently passes 9 tests.
- **Verification Strategy**:
  Every commit must maintain:
  1. Strict TypeScript type-checking (`tsc -b`)
  2. Oxlint cleanliness (0 warnings, 0 errors)
  3. Regression test suite pass with 100% financial formula coverage
