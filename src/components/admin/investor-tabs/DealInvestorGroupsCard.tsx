'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import Button from '@/components/ui/Button';
import { createClient } from '@/lib/supabase/client';
import { useActivityTracker } from '@/lib/hooks/useActivityTracker';
import { setDealTabAssignments } from '@/app/[locale]/(admin)/admin/investor-tabs/actions';

interface GroupOption {
  id: string;
  name: string;
  is_enabled: boolean;
}

interface Assignment {
  tabId: string;
  matchReason: string;
  internalNote: string;
}

/**
 * "Investor Groups" card on the admin deal page. Self-contained: loads the
 * groups + this deal's current assignments on mount, then saves the chosen
 * set (with optional per-group notes) via the setDealTabAssignments action.
 */
export default function DealInvestorGroupsCard({ dealId }: { dealId: string }) {
  const t = useTranslations('admin.investorTabs');
  const { trackActivity } = useActivityTracker();

  const [groups, setGroups] = useState<GroupOption[]>([]);
  const [selected, setSelected] = useState<Map<string, Assignment>>(new Map());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    const supabase = createClient();
    (async () => {
      const [{ data: tabs }, { data: assignments }] = await Promise.all([
        supabase
          .from('terminal_investor_tabs')
          .select('id, name, is_enabled')
          .order('name', { ascending: true }),
        supabase
          .from('terminal_deal_tab_assignments')
          .select('tab_id, match_reason, internal_note')
          .eq('deal_id', dealId),
      ]);
      if (!active) return;

      setGroups(tabs ?? []);
      const map = new Map<string, Assignment>();
      for (const a of assignments ?? []) {
        map.set(a.tab_id, {
          tabId: a.tab_id,
          matchReason: a.match_reason ?? '',
          internalNote: a.internal_note ?? '',
        });
      }
      setSelected(map);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [dealId]);

  function toggle(tabId: string) {
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(tabId)) next.delete(tabId);
      else next.set(tabId, { tabId, matchReason: '', internalNote: '' });
      return next;
    });
    setSavedAt(null);
  }

  function updateNote(tabId: string, field: 'matchReason' | 'internalNote', value: string) {
    setSelected((prev) => {
      const next = new Map(prev);
      const current = next.get(tabId);
      if (current) next.set(tabId, { ...current, [field]: value });
      return next;
    });
    setSavedAt(null);
  }

  async function handleSave() {
    if (saving) return;
    setSaving(true);
    setError(null);
    const tabIds = [...selected.keys()];
    const notes: Record<string, { matchReason?: string; internalNote?: string }> = {};
    for (const a of selected.values()) {
      notes[a.tabId] = {
        matchReason: a.matchReason.trim() || undefined,
        internalNote: a.internalNote.trim() || undefined,
      };
    }
    const res = await setDealTabAssignments(dealId, tabIds, notes);
    setSaving(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    trackActivity('deal_curated', dealId, { tab_ids: tabIds });
    setSavedAt(Date.now());
  }

  return (
    <div className="bg-white rounded-2xl border border-rp-gray-200 p-6 mb-6">
      <h2 className="text-[16px] font-semibold text-rp-navy mb-1">{t('dealCardTitle')}</h2>
      <p className="text-[12px] text-rp-gray-500 mb-4">{t('dealCardSubtitle')}</p>

      {loading ? (
        <p className="text-sm text-rp-gray-400 py-4">{t('loading')}</p>
      ) : groups.length === 0 ? (
        <p className="text-sm text-rp-gray-400 py-4">{t('noGroupsYet')}</p>
      ) : (
        <div className="flex flex-col gap-3">
          {groups.map((g) => {
            const isOn = selected.has(g.id);
            const assignment = selected.get(g.id);
            return (
              <div
                key={g.id}
                className={`rounded-xl border p-3 transition-colors ${
                  isOn ? 'border-rp-gold/40 bg-rp-gold/[0.03]' : 'border-rp-gray-200'
                }`}
              >
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isOn}
                    onChange={() => toggle(g.id)}
                    className="w-4 h-4 rounded border-rp-gray-300 text-rp-gold focus:ring-rp-gold"
                  />
                  <span className="text-[13px] font-medium text-rp-gray-700">{g.name}</span>
                  {!g.is_enabled && (
                    <span className="text-[10px] font-semibold text-rp-gray-400 uppercase tracking-wide">
                      {t('statusDisabled')}
                    </span>
                  )}
                </label>

                {isOn && assignment && (
                  <div className="mt-3 pl-6 flex flex-col gap-2">
                    <input
                      type="text"
                      value={assignment.matchReason}
                      onChange={(e) => updateNote(g.id, 'matchReason', e.target.value)}
                      placeholder={t('matchReasonPlaceholder')}
                      className="w-full px-3 py-2 border border-rp-gray-300 rounded-lg text-[13px] focus:ring-2 focus:ring-rp-gold/20 focus:border-rp-gold outline-none"
                    />
                    <input
                      type="text"
                      value={assignment.internalNote}
                      onChange={(e) => updateNote(g.id, 'internalNote', e.target.value)}
                      placeholder={t('internalNotePlaceholder')}
                      className="w-full px-3 py-2 border border-rp-gray-300 rounded-lg text-[13px] focus:ring-2 focus:ring-rp-gold/20 focus:border-rp-gold outline-none"
                    />
                  </div>
                )}
              </div>
            );
          })}

          {error && <p className="text-xs text-rp-red">{error}</p>}

          <div className="flex items-center gap-3">
            <Button variant="gold" size="sm" onClick={handleSave} loading={saving}>
              {t('saveGroups')}
            </Button>
            {savedAt && <span className="text-[12px] text-rp-green">{t('saved')}</span>}
          </div>
        </div>
      )}
    </div>
  );
}
