# Loan Tracking System

Private React and Supabase finance tracker. The current implementation provides the `10% Profit` workflow without changing the source Excel workbook.

## Included

- Separate `10% Profit` section with a live total.
- `+ Add 10% Entry` form for date, particulars, amount, optional Main Sheet No, and notes.
- Explicit `Tag MAIN transaction` workflow with confirmation.
- No automatic 10% classification.
- Email/password sign-in when Supabase is configured.
- Row Level Security restricted to active rows in `app_members`.
- Local browser preview when Supabase environment variables are absent.

## Run locally

```powershell
pnpm install
Copy-Item .env.example .env.local
pnpm dev
```

Set these values in `.env.local`:

```text
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
```

Never place a Supabase secret key or database password in a `VITE_` variable.

## Database setup

1. Link the Supabase project with the CLI.
2. Apply the migration in `supabase/migrations`.
3. Create approved users in Supabase Auth. Disable public sign-up for this private app.
4. Add each approved user to `public.app_members` from the SQL editor:

```sql
insert into public.app_members (user_id, display_name)
values ('AUTH_USER_UUID', 'Approved user');
```

The migration intentionally creates zero 10% entries. MAIN transactions become 10% entries only when a user explicitly confirms `Tag as 10%`.

## Verification

```powershell
pnpm test
pnpm lint
pnpm build
```
