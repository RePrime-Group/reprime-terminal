# RePrime Terminal

Institutional commercial real estate investment platform. Invite-only portal for qualified CRE investors to view, analyze, and act on deals under executed Purchase and Sale Agreements.

## Tech Stack

- **Framework:** Next.js 15 (App Router), TypeScript strict mode
- **Styling:** Tailwind CSS 4 with custom brand theme
- **Database:** Supabase PostgreSQL (all tables prefixed `terminal_`)
- **Auth:** Supabase Auth (invite-only flow)
- **Storage:** Supabase Storage (deal photos + DD documents)
- **3D:** Three.js via @react-three/fiber (login page)
- **i18n:** next-intl (English + Hebrew with full RTL)

## Setup

1. Clone the repo and install dependencies:
   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env.local` and fill in your Supabase credentials:
   ```
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   ```

3. Run database migrations in order via Supabase SQL Editor:
   - `supabase/migrations/001_terminal_tables.sql`
   - `supabase/migrations/002_terminal_rls.sql`
   - `supabase/migrations/003_terminal_seed.sql` (see note below)
   - `supabase/migrations/004_terminal_storage.sql`

4. **Before running seed migration (003):**
   - Create auth accounts for Gideon and Shirel in Supabase Dashboard > Authentication > Users > Add User
   - Copy their auth UUIDs into `003_terminal_seed.sql`
   - Then run the migration

5. Create storage buckets in Supabase Dashboard > Storage:
   - `terminal-deal-photos` (public)
   - `terminal-dd-documents` (private)

6. Run the development server:
   ```bash
   npm run dev
   ```

## Access Levels

| Role | Access |
|------|--------|
| **Owner** | Full access: deals, investors, activity logs, invitations, settings |
| **Employee** | Deals (CRUD), DD management. No investor data or activity logs |
| **Investor** | Portal: published deals, DD room, deal structure, meeting scheduler |

## Deployment

Connect the GitHub repo to Vercel. Set environment variables in the Vercel dashboard. Auto-deploys from the main branch.
