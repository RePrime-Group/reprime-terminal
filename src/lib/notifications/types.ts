export type NotifEventKey = 'new_deals' | 'document_uploads' | 'deal_activity';
export type NotifChannel = 'email' | 'in_app';

export type NotifPreferences = {
  events: Record<NotifEventKey, boolean>;
  channels: Record<NotifChannel, boolean>;
};

export const DEFAULT_NOTIF_PREFS: NotifPreferences = {
  events: {
    new_deals: true,
    document_uploads: true,
    deal_activity: true,
  },
  channels: {
    email: true,
    in_app: true,
  },
};

/**
 * Accepts either the current shape ({ events, channels }) or the legacy
 * per-event-per-channel shape ({ new_deals: { email, in_app }, ... }) and
 * emits the current shape.
 */
export function normalizePrefs(raw: unknown): NotifPreferences {
  const out: NotifPreferences = {
    events: { ...DEFAULT_NOTIF_PREFS.events },
    channels: { ...DEFAULT_NOTIF_PREFS.channels },
  };

  if (!raw || typeof raw !== 'object') return out;
  const r = raw as Record<string, unknown>;

  // Current shape
  if (r.events && typeof r.events === 'object' && r.channels && typeof r.channels === 'object') {
    const e = r.events as Record<string, unknown>;
    const c = r.channels as Record<string, unknown>;
    (Object.keys(out.events) as NotifEventKey[]).forEach((k) => {
      if (typeof e[k] === 'boolean') out.events[k] = e[k] as boolean;
    });
    (Object.keys(out.channels) as NotifChannel[]).forEach((k) => {
      if (typeof c[k] === 'boolean') out.channels[k] = c[k] as boolean;
    });
    return out;
  }

  // Legacy shape: { new_deals: { email, in_app }, document_uploads: {...}, deal_activity: {...} }
  // Event is "on" if ANY channel is on. Global channels default to union across events.
  let anyEmail = false;
  let anyInApp = false;
  let hadLegacyKey = false;
  (Object.keys(out.events) as NotifEventKey[]).forEach((k) => {
    const v = r[k];
    if (v && typeof v === 'object') {
      hadLegacyKey = true;
      const entry = v as Record<string, unknown>;
      const email = typeof entry.email === 'boolean' ? entry.email : true;
      const in_app = typeof entry.in_app === 'boolean' ? entry.in_app : true;
      out.events[k] = email || in_app;
      anyEmail = anyEmail || email;
      anyInApp = anyInApp || in_app;
    }
  });
  if (hadLegacyKey) {
    out.channels.email = anyEmail;
    out.channels.in_app = anyInApp;
  }
  return out;
}

/**
 * Helper used by the dispatcher to decide whether to send.
 */
export function shouldDeliver(
  prefs: NotifPreferences,
  event: NotifEventKey,
  channel: NotifChannel,
): boolean {
  return prefs.events[event] && prefs.channels[channel];
}

// Field names (on terminal_deals) whose change triggers a deal_activity event.
export const DEAL_ACTIVITY_WATCH_FIELDS = [
  'purchase_price',
  'om_storage_path',
  'dd_deadline',
  'close_deadline',
  'extension_deadline',
  'psa_draft_start',
  'loi_signed_at',
  'quarter_release',
] as const;

export type DealActivityField = typeof DEAL_ACTIVITY_WATCH_FIELDS[number];

export const DEAL_ACTIVITY_FIELD_LABELS: Record<DealActivityField, string> = {
  purchase_price: 'Purchase price',
  om_storage_path: 'Offering Memorandum',
  dd_deadline: 'Due-diligence deadline',
  close_deadline: 'Closing deadline',
  extension_deadline: 'Extension deadline',
  psa_draft_start: 'PSA draft start',
  loi_signed_at: 'LOI signing date',
  quarter_release: 'Release quarter',
};
