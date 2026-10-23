# Nijju Finance Tracker — Deployment, Backup, and Operational Runbook

This operational runbook provides production-grade deployment instructions, database migration sequences, backup protocols, user authorization guidelines, and financial reconciliation workflows for **Nijju Finance Tracker**.

---

## 1. System Architecture & Technology Stack

The application manages personal lending, collections, investment capital, and accounting reconciliation with dual-mode operational support:
- **Frontend**: React 19, TypeScript 6, Vite 8
- **Styling**: Tailored Vanilla CSS with tabular currency figures, accessible contrast, and print stylesheets
- **Data Access & Persistence**: Dual-layer architecture
  - **Persistent Supabase Mode**: Real PostgreSQL database with Row-Level Security (RLS) and stored procedures.
  - **Local Preview Engine**: In-browser memory/localStorage fallback with identical schema for offline verification and zero-setup demonstration.
- **Verification & Quality**: Vitest 5, Oxlint 1.81, TypeScript compiler (`tsc -b`), and Vite bundle builder.

---

## 2. Environment Configuration

Copy the sample environment file to `.env`:
```bash
cp .env.example .env
```

### Environment Variables
| Variable | Description | Security Requirement |
| :--- | :--- | :--- |
| `VITE_SUPABASE_URL` | Supabase Project URL (`https://<project-ref>.supabase.co`) | Publicly accessible URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase Anonymous Public Key | Safe for browser bundle. **NEVER** expose `service_role` key! |

> [!CAUTION]
> **Strict Secret Security**: Never commit `.env` or service role keys to Git. The frontend client bundle only uses `VITE_SUPABASE_ANON_KEY` governed by PostgreSQL Row Level Security.

---

## 3. Database Migration Sequence

All schema migrations are forward-only and located in `supabase/migrations/`:

1. **`20261023120000_normalized_finance_schema.sql`**
   - Tables: `customers`, `loans`, `installments`, `payments`, `investment_entries`, `interest_entries`, `ten_percent_entries`, `due_receivables`, `ledger_transactions`, `audit_logs`, `import_batches`.
   - Constraints: Decimal numeric precision `NUMERIC(14,2)` for INR, foreign key relationships, check constraints on modes (`'D'`, `'W'`) and statuses.
   - Stored Functions: `tag_main_transaction_as_ten_percent`, `record_loan_payment`.

2. **`20261023121000_secure_finance_rls.sql`**
   - Enables Row-Level Security (`RLS`) on all financial tables.
   - Restricts read and write operations to authenticated members with approved status (`app_metadata ->> 'approved_member' = 'true'`).

### Applying Migrations to Supabase
Using the Supabase CLI:
```bash
supabase db push
# or link to remote project:
supabase link --project-ref <your-project-id>
supabase db push
```

---

## 4. User Creation & Approved Member Authorization

To authorize operators to access private financial records:
1. Create user in Supabase Authentication dashboard (Email + Password).
2. Set custom app metadata to grant approved member status:
```sql
update auth.users
set raw_app_meta_data = raw_app_meta_data || '{"approved_member": true}'::jsonb
where email = 'operator@example.com';
```

---

## 5. Financial Reconciliation Targets & Accounting Rules

All calculations reconcile to the primary source workbook (**NISHANTH-2026.xlsx**):

| Category | Reference Target | Count | Source Sheet & Columns | Accounting Definition |
| :--- | :--- | :--- | :--- | :--- |
| **Investments Received** | **₹185,000** | 8 entries | `SEP&OCT` (Cols P-S) | Partner equity injections. NOT business revenue or profit. |
| **Interest Inflow** | **₹4,950** | 9 entries | `SEP&OCT` (Cols K-N) | Physically collected borrower interest payments. |
| **10% Profit Collected** | **₹8,970** | 24 entries | `SEP&OCT` (Cols F-I) | Genuine 10% fee receipts. Erroneous ₹161,010 credit misclassification resolved. |
| **Outstanding Dues** | **₹12,000** | 6 entries | `SEP&OCT` (Cols J-K) | Uncollected customer receivables (Ajith, Shanthi, Divya). |
| **Loan Principal Disbursed**| **₹162,000** | 17 accounts | `LOAN` Sheet | Total capital disbursed (12 active + 5 historical closed rows). |
| **Workbook Total Ledger** | **₹210,920** | — | Ledger Summary | Sum of Investments + Interest + 10% Profit + Dues. |
| **Workbook Nominal Cash** | **₹48,920** | — | Ledger Summary | Ledger Total (₹210,920) − Principal Disbursed (₹162,000). |
| **Actual Liquid Cash** | **₹36,920** | — | True Cash Accounting | Nominal Cash (₹48,920) − Unpaid Customer Dues (₹12,000). |

### Critical Accounting Distinction
- **Nominal vs Liquid Cash**: Unpaid customer dues (₹12,000) are receivables. They cannot be spent as cash. The application clearly shows both figures and provides variance alerts.
- **Profit vs Capital**: Partner investment credits (e.g. ₹27k, ₹50k) are capital liabilities, never to be classified as 10% profit.

---

## 6. Daily Operations Runbook

### Running Verification Suite
```bash
# Verify all linters, unit tests, type safety, and production build
npm run verify:all

# Run Excel import verification
npm run verify:import

# Run development server
npm run dev
```

### CSV Data Exports
Navigate to `/reports` in the application to generate RFC 4180 compliant CSV exports for:
- Investments Ledger (`investments-ledger-<date>.csv`)
- Interest Receipts (`interest-receipts-<date>.csv`)
- 10% Profit Ledger (`ten-percent-profit-<date>.csv`)
- Loan Portfolio Master (`loan-portfolio-master-<date>.csv`)
- Payment Collection History (`payment-collection-history-<date>.csv`)
- Outstanding Dues (`outstanding-dues-receivables-<date>.csv`)
- Full Audit Reconciliation Report (`audit-reconciliation-report-<date>.csv`)

---

## 7. Backup, Rollback & Disaster Recovery

### PostgreSQL Database Backups
Schedule daily pg_dump backups via Supabase or external cron:
```bash
pg_dump "postgresql://postgres:<password>@db.<ref>.supabase.co:5432/postgres" \
  --schema public \
  -F c \
  -b \
  -v \
  -f "backup-finance-$(date +%Y%m%d).dump"
```

### Import Batch Rollback
Each Excel workbook import records an entry in `import_batches`. In case of ambiguous data:
1. Navigate to `/reports` and review the batch summary.
2. Mark the batch as `status = 'rolled_back'`.
3. Re-run import with corrected workbook.
