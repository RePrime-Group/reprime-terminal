import 'server-only';
import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { hasPermission } from '@/lib/auth/permissions';
import type { TeamPermissionKey, TeamPermissions } from '@/lib/types/database';

interface InvestorAuth {
  userId: string;
  email: string | null;
  fullName: string | null;
  role: 'owner' | 'employee' | 'investor';
  isActive: boolean;
  parentInvestorId: string | null;
  permissions: TeamPermissions;
}

export async function getInvestorAuth(): Promise<
  | { ok: true; user: InvestorAuth }
  | { ok: false; response: NextResponse }
> {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll() {},
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  const { data: profile } = await supabase
    .from('terminal_users')
    .select('id, email, full_name, role, is_active, parent_investor_id, permissions')
    .eq('id', user.id)
    .single();

  if (!profile) {
    return { ok: false, response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  if (profile.is_active === false) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Your account has been deactivated. Please contact RePrime if you believe this is an error.' },
        { status: 403 },
      ),
    };
  }

  return {
    ok: true,
    user: {
      userId: profile.id,
      email: profile.email ?? user.email ?? null,
      fullName: profile.full_name ?? null,
      role: profile.role,
      isActive: profile.is_active !== false,
      parentInvestorId: profile.parent_investor_id ?? null,
      permissions: (profile.permissions ?? {}) as TeamPermissions,
    },
  };
}

/**
 * Returns a 403 response if the user is a team sub-user who lacks this permission.
 * Parent investors and non-sub-users always pass.
 */
export function permissionDenied(user: InvestorAuth, key: TeamPermissionKey): NextResponse | null {
  if (hasPermission(
    {
      parent_investor_id: user.parentInvestorId,
      permissions: user.permissions,
      is_active: user.isActive,
    },
    key,
  )) {
    return null;
  }
  return NextResponse.json(
    {
      error: 'Your account doesn\u2019t have permission for this action. Ask the investor who invited you to enable it.',
      missing_permission: key,
    },
    { status: 403 },
  );
}
