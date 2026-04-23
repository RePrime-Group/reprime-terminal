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

2. Run the development server:
   ```bash
   npm run dev
   ```

## Deployment

Connect the GitHub repo to Vercel. Set environment variables in the Vercel dashboard. Auto-deploys from the main branch.
