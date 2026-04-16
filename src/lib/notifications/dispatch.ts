import type { SupabaseClient } from '@supabase/supabase-js';
import {
  sendDealNotificationEmail,
  sendDocumentUploadEmail,
  sendDealActivityEmail,
} from '@/lib/email/send';
import {
  DEAL_ACTIVITY_FIELD_LABELS,
  normalizePrefs,
  shouldDeliver,
  type DealActivityField,
  type NotifEventKey,
  type NotifPreferences,
} from './types';

type Admin = SupabaseClient;

type DealSummary = {
  id: string;
  name: string;
  city: string;
  state: string;
  property_type: string;
  status: string;
};

type Recipient = {
  id: string;
  email: string;
  prefs: NotifPreferences;
};

function getPortalUrl() {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://terminal.reprime.com';
  return `${baseUrl}/en/portal`;
}

async function loadRecipientsByIds(admin: Admin, userIds: string[]): Promise<Recipient[]> {
  if (userIds.length === 0) return [];
  const { data } = await admin
    .from('terminal_users')
    .select('id, email, is_active, notification_preferences')
    .in('id', userIds)
    .eq('is_active', true);
  return (data ?? []).map((u) => ({
    id: u.id,
    email: u.email,
    prefs: normalizePrefs(u.notification_preferences),
  }));
}

async function loadAllActiveInvestors(admin: Admin): Promise<Recipient[]> {
  const { data } = await admin
    .from('terminal_users')
    .select('id, email, notification_preferences')
    .eq('role', 'investor')
    .eq('is_active', true);
  return (data ?? []).map((u) => ({
    id: u.id,
    email: u.email,
    prefs: normalizePrefs(u.notification_preferences),
  }));
}

async function loadDealRecipients(admin: Admin, dealId: string): Promise<Recipient[]> {
  // Recipients for "deal_activity": committed + watchlisted investors.
  const [{ data: commitments }, { data: watchlist }] = await Promise.all([
    admin.from('terminal_deal_commitments').select('user_id').eq('deal_id', dealId),
    admin.from('terminal_watchlist').select('user_id').eq('deal_id', dealId),
  ]);
  const ids = new Set<string>();
  (commitments ?? []).forEach((r: { user_id: string }) => ids.add(r.user_id));
  (watchlist ?? []).forEach((r: { user_id: string }) => ids.add(r.user_id));
  return loadRecipientsByIds(admin, Array.from(ids));
}

async function loadNDASignedRecipients(admin: Admin, dealId: string): Promise<Recipient[]> {
  // Investors who have signed the NDA for this specific deal OR the blanket NDA.
  const { data: sigs } = await admin
    .from('terminal_nda_signatures')
    .select('user_id, nda_type, deal_id');
  const ids = new Set<string>();
  (sigs ?? []).forEach((s: { user_id: string; nda_type: string; deal_id: string | null }) => {
    if (s.nda_type === 'blanket') ids.add(s.user_id);
    else if (s.nda_type === 'deal' && s.deal_id === dealId) ids.add(s.user_id);
  });
  return loadRecipientsByIds(admin, Array.from(ids));
}

type InAppRow = {
  user_id: string;
  deal_id: string | null;
  type: string;
  title: string;
  description: string;
};

async function insertInAppRows(admin: Admin, rows: InAppRow[]) {
  if (rows.length === 0) return;
  // Best-effort insert; individual failures shouldn't abort the dispatch.
  const { error } = await admin.from('terminal_notifications').insert(rows);
  if (error) console.error('[notifications] in-app insert failed:', error.message);
}

async function runEmail(taskName: string, fn: () => Promise<unknown>) {
  try {
    await fn();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[notifications] ${taskName} failed:`, msg);
  }
}

function filterByChannel(recipients: Recipient[], event: NotifEventKey) {
  const in_app: Recipient[] = [];
  const email: Recipient[] = [];
  for (const r of recipients) {
    if (shouldDeliver(r.prefs, event, 'in_app')) in_app.push(r);
    if (shouldDeliver(r.prefs, event, 'email')) email.push(r);
  }
  return { in_app, email };
}

export async function dispatchNewDeal(admin: Admin, deal: DealSummary) {
  const recipients = await loadAllActiveInvestors(admin);
  if (recipients.length === 0) return { sent: 0 };

  const { in_app, email } = filterByChannel(recipients, 'new_deals');

  await insertInAppRows(
    admin,
    in_app.map((r) => ({
      user_id: r.id,
      deal_id: deal.id,
      type: 'new_deal',
      title: `New deal: ${deal.name}`,
      description: `${deal.city}, ${deal.state} · ${deal.property_type}`,
    })),
  );

  const portalUrl = `${getPortalUrl()}/deals/${deal.id}`;
  for (const r of email) {
    await runEmail(`new_deal email to ${r.email}`, () =>
      sendDealNotificationEmail(r.email, deal, portalUrl),
    );
  }
  return { sent: recipients.length };
}

export async function dispatchDocumentUploads(
  admin: Admin,
  deal: DealSummary,
  docs: { name: string }[],
) {
  if (docs.length === 0) return { sent: 0 };
  const recipients = await loadNDASignedRecipients(admin, deal.id);
  if (recipients.length === 0) return { sent: 0 };

  const { in_app, email } = filterByChannel(recipients, 'document_uploads');

  const summary =
    docs.length === 1
      ? docs[0].name
      : `${docs.length} new documents (${docs[0].name}, …)`;

  await insertInAppRows(
    admin,
    in_app.map((r) => ({
      user_id: r.id,
      deal_id: deal.id,
      type: 'document_uploaded',
      title: `New documents in ${deal.name}`,
      description: summary,
    })),
  );

  const portalUrl = `${getPortalUrl()}/deals/${deal.id}`;
  for (const r of email) {
    await runEmail(`document_upload email to ${r.email}`, () =>
      sendDocumentUploadEmail(r.email, {
        dealName: deal.name,
        city: deal.city,
        state: deal.state,
        docCount: docs.length,
        firstDocName: docs[0].name,
        portalUrl,
      }),
    );
  }
  return { sent: recipients.length };
}

export async function dispatchDealActivity(
  admin: Admin,
  deal: DealSummary,
  changedFields: DealActivityField[],
) {
  if (changedFields.length === 0) return { sent: 0 };
  const recipients = await loadDealRecipients(admin, deal.id);
  if (recipients.length === 0) return { sent: 0 };

  const { in_app, email } = filterByChannel(recipients, 'deal_activity');

  const labels = changedFields.map((f) => DEAL_ACTIVITY_FIELD_LABELS[f]);
  const summary =
    labels.length === 1
      ? `${labels[0]} was updated.`
      : `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]} were updated.`;

  await insertInAppRows(
    admin,
    in_app.map((r) => ({
      user_id: r.id,
      deal_id: deal.id,
      type: 'deal_activity',
      title: `${deal.name} updated`,
      description: summary,
    })),
  );

  const portalUrl = `${getPortalUrl()}/deals/${deal.id}`;
  for (const r of email) {
    await runEmail(`deal_activity email to ${r.email}`, () =>
      sendDealActivityEmail(r.email, {
        dealName: deal.name,
        city: deal.city,
        state: deal.state,
        changes: labels,
        portalUrl,
      }),
    );
  }
  return { sent: recipients.length };
}
