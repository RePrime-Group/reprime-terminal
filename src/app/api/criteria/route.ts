import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import type { MandateInput } from '@/components/admin/crm/mandate';

/**
 * Build a wa.me link from a server-side env var, or null if unset.
 *
 * Intentionally NOT prefixed with NEXT_PUBLIC_ — that would inline the value
 * into the client bundle at build time and expose it to anyone who can view
 * the page source. Keeping it server-only means the number only crosses the
 * wire in the response to a successful POST with a valid submission token
 * (i.e. only to investors we actually invited).
 */
function buildWhatsappUrl(prefilledText: string): string | null {
  const raw = process.env.REPRIME_WHATSAPP_NUMBER;
  if (!raw) return null;
  // wa.me requires digits only with country code (no +).
  const digits = raw.replace(/[^\d]/g, '');
  if (!digits) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(prefilledText)}`;
}

// Token-gated form; never cache.
export const dynamic = 'force-dynamic';

const identitySchema = z.object({
  first_name: z.string().min(1, 'first_name is required'),
  last_name: z.string().min(1, 'last_name is required'),
  email: z.string().email(),
  phone: z.string().min(1, 'phone is required'),
  whatsapp: z.string().optional().nullable(),
  company_name: z.string().optional().nullable(),
  title: z.string().optional().nullable(),
  preferred_contact_method: z.enum(['email', 'phone', 'whatsapp', 'text_message', 'linkedin', 'zoom']),
  investing_as: z.enum(['principal', 'fund', 'family_office', 'jv', '1031']).or(z.literal('')).optional().nullable(),
  capital_ready: z.string().optional().nullable(),
  ownership_pref: z.enum(['direct', 'gp_lp', 'either']).or(z.literal('')).optional().nullable(),
  timeline_to_deploy: z.string().optional().nullable(),
  is_accredited: z.boolean(),
});

const mandateSchema = z.object({
  label: z.string().optional().nullable(),
  property_types: z.array(z.string()),
  listing_types: z.array(z.string()),
  states: z.array(z.string()),
  property_class: z.array(z.string()),
  structure_prefs: z.array(z.string()),
  min_price: z.number().nullable().optional(),
  max_price: z.number().nullable().optional(),
  min_cap: z.number().nullable().optional(),
  min_coc: z.number().nullable().optional(),
  min_occupancy: z.number().nullable().optional(),
  max_occupancy: z.number().nullable().optional(),
  min_sqft: z.number().nullable().optional(),
  max_sqft: z.number().nullable().optional(),
  price_per_sf_max: z.number().nullable().optional(),
  min_lease_term_years: z.number().nullable().optional(),
  strategy: z.enum(['value_add', 'stabilized', 'opportunistic', 'either']).nullable().optional(),
  tenant_credit_pref: z.enum(['investment_grade', 'mixed', 'not_important']).nullable().optional(),
  notes: z.string().nullable().optional(),
});

const bodySchema = z.object({
  token: z.string().min(1),
  identity: identitySchema,
  mandates: z.array(mandateSchema).min(1, 'at least one mandate is required'),
  consent_contact: z.literal(true, { message: 'consent_contact must be true' }),
  locale: z.enum(['en', 'he']).optional(),
});

function mandateRow(investorId: string, m: MandateInput) {
  return {
    investor_id: investorId,
    label: m.label?.trim() || null,
    color: null,
    is_active: true,
    property_types: m.property_types ?? [],
    listing_types: m.listing_types ?? [],
    states: m.states ?? [],
    property_class: m.property_class ?? [],
    structure_prefs: m.structure_prefs ?? [],
    min_price: m.min_price ?? null,
    max_price: m.max_price ?? null,
    min_cap: m.min_cap ?? null,
    min_coc: m.min_coc ?? null,
    min_occupancy: m.min_occupancy ?? null,
    max_occupancy: m.max_occupancy ?? null,
    min_sqft: m.min_sqft ?? null,
    max_sqft: m.max_sqft ?? null,
    price_per_sf_max: m.price_per_sf_max ?? null,
    min_lease_term_years: m.min_lease_term_years ?? null,
    strategy: m.strategy ?? null,
    tenant_credit_pref: m.tenant_credit_pref ?? null,
    notes: m.notes?.trim() || null,
  };
}

export async function POST(request: NextRequest) {
  let body;
  try {
    body = bodySchema.parse(await request.json());
  } catch (e) {
    return NextResponse.json(
      { error: 'invalid_body', message: e instanceof Error ? e.message : 'Invalid request body' },
      { status: 400 },
    );
  }

  const admin = createAdminClient();

  // Concurrency-safe token burn: update by (id, submission_token=token) and
  // ensure exactly one row was affected. If the token was already used or
  // overwritten, the filter matches nothing and we treat it as invalid.
  const { data: lookup, error: lookupErr } = await admin
    .from('terminal_crm_investors')
    .select('id, email')
    .eq('submission_token', body.token)
    .maybeSingle();
  if (lookupErr) {
    return NextResponse.json({ error: 'lookup_failed', message: lookupErr.message }, { status: 500 });
  }
  if (!lookup) {
    return NextResponse.json({ error: 'invalid_or_used_token' }, { status: 401 });
  }

  const investorId = lookup.id;
  const investorEmail = (lookup.email ?? body.identity.email).toLowerCase();

  // Smart-routing lookup — drives both the redirect AND the auth_user_id
  // linkage. Done before the UPDATE so we can write the link in the same
  // statement.
  const { data: existingUser } = await admin
    .from('terminal_users')
    .select('id')
    .ilike('email', investorEmail)
    .maybeSingle();

  // Update identity, link auth_user_id if the user already exists, AND burn
  // the token in one statement. The submission_token filter on UPDATE means
  // we lose any race against a second submission.
  const { data: updated, error: updateErr } = await admin
    .from('terminal_crm_investors')
    .update({
      first_name: body.identity.first_name.trim(),
      last_name: body.identity.last_name.trim(),
      phone: body.identity.phone.trim() || null,
      whatsapp: body.identity.whatsapp?.trim() || null,
      company_name: body.identity.company_name?.trim() || null,
      title: body.identity.title?.trim() || null,
      preferred_contact_method: body.identity.preferred_contact_method,
      investing_as: body.identity.investing_as || null,
      capital_ready: body.identity.capital_ready || null,
      ownership_pref: body.identity.ownership_pref || null,
      timeline_to_deploy: body.identity.timeline_to_deploy || null,
      is_accredited: body.identity.is_accredited,
      consent_contact: true,
      criteria_submitted_at: new Date().toISOString(),
      auth_user_id: existingUser?.id ?? null,
      submission_token: null,
      submission_token_issued_at: null,
    })
    .eq('id', investorId)
    .eq('submission_token', body.token)
    .select('id')
    .single();

  if (updateErr || !updated) {
    return NextResponse.json({ error: 'invalid_or_used_token' }, { status: 401 });
  }

  // Replace mandates (form is authoritative — see plan §4).
  const { error: deleteErr } = await admin
    .from('terminal_crm_mandates')
    .delete()
    .eq('investor_id', investorId);
  if (deleteErr) {
    return NextResponse.json({ error: 'mandate_delete_failed', message: deleteErr.message }, { status: 500 });
  }

  const rows = body.mandates.map((m) => mandateRow(investorId, m as MandateInput));
  const { error: insertErr } = await admin.from('terminal_crm_mandates').insert(rows);
  if (insertErr) {
    return NextResponse.json({ error: 'mandate_insert_failed', message: insertErr.message }, { status: 500 });
  }

  // Locale comes from the form, not the API path (the public /criteria pages
  // are at /[locale]/criteria but POST to /api/criteria with no locale segment).
  // Locale is echoed back so the client can display it if useful, but the URLs
  // below are intentionally locale-LESS — the client renders them via the
  // next-intl <Link> which prepends the locale itself.
  const locale = body.locale === 'he' ? 'he' : 'en';
  const emailParam = encodeURIComponent(investorEmail);

  // Determine if the SAME browser is also logged in. Independent from
  // isRegistered — they could be a registered user who simply isn't signed in
  // on this device. We use the SSR cookie client (NOT admin) so we read the
  // caller's session, not bypass it.
  let isLoggedIn = false;
  try {
    const cookieStore = await cookies();
    const ssr = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll() {},
        },
      },
    );
    const { data: { user: caller } } = await ssr.auth.getUser();
    isLoggedIn = !!caller && existingUser?.id === caller.id;
  } catch {
    isLoggedIn = false;
  }

  const whatsappUrl = buildWhatsappUrl(
    `Hi RePrime, I just submitted my criteria (${investorEmail}). Could someone from the team reach out?`,
  );

  return NextResponse.json({
    ok: true,
    investor_id: investorId,
    isRegistered: !!existingUser,
    isLoggedIn,
    email: investorEmail,
    locale,
    loginUrl: `/login?email=${emailParam}`,
    terminalUrl: `/portal`,
    joinUrl: `/join?email=${emailParam}&from=criteria`,
    whatsappUrl,
  });
}
