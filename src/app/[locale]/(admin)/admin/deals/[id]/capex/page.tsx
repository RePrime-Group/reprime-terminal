'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import DealSubNav from '@/components/admin/DealSubNav';
import {
  CAPEX_CONDITIONS,
  CAPEX_PRIORITIES,
  groupByPriority,
  computeAnnualizedReserve,
  computeTotalDuringHold,
  sortCapExForDisplay,
  conditionColor,
  formatMoney,
  parseHoldPeriod,
} from '@/lib/utils/capex';
import type {
  CapExItem,
  CapExCondition,
  CapExPriority,
  TerminalDealAddress,
} from '@/lib/types/database';

interface CapExFormState {
  address_id: string;
  component_name: string;
  current_condition: CapExCondition;
  year_last_replaced: string;
  useful_life_remaining: string;
  estimated_replacement_cost: string;
  priority: CapExPriority;
  notes: string;
}

const EMPTY_FORM: CapExFormState = {
  address_id: '',
  component_name: '',
  current_condition: 'Unknown',
  year_last_replaced: '',
  useful_life_remaining: '',
  estimated_replacement_cost: '',
  priority: 'During Hold',
  notes: '',
};

function itemToForm(item: CapExItem): CapExFormState {
  return {
    address_id: item.address_id ?? '',
    component_name: item.component_name ?? '',
    current_condition: item.current_condition ?? 'Unknown',
    year_last_replaced: item.year_last_replaced ?? '',
    useful_life_remaining: item.useful_life_remaining ?? '',
    estimated_replacement_cost: item.estimated_replacement_cost ?? '',
    priority: item.priority ?? 'During Hold',
    notes: item.notes ?? '',
  };
}

function formToDb(form: CapExFormState, dealId: string, sortOrder: number) {
  const num = (v: unknown): number | null => {
    if (v === null || v === undefined) return null;
    if (typeof v === 'number') return Number.isFinite(v) ? v : null;
    const s = String(v).trim();
    if (!s) return null;
    const n = parseFloat(s.replace(/[$,\s]/g, ''));
    return Number.isFinite(n) ? n : null;
  };

  return {
    deal_id: dealId,
    address_id: form.address_id.trim() || null,
    component_name: form.component_name.trim(),
    current_condition: form.current_condition,
    year_last_replaced: form.year_last_replaced.trim() || null,
    useful_life_remaining: form.useful_life_remaining.trim() || null,
    estimated_replacement_cost: num(form.estimated_replacement_cost),
    priority: form.priority,
    notes: form.notes.trim() || null,
    sort_order: sortOrder,
  };
}

export default function CapExAdminPage() {
  const params = useParams();
  const dealId = params.id as string;
  const locale = (params.locale as string) ?? 'en';
  const supabase = createClient();

  const [dealName, setDealName] = useState('');
  const [holdPeriodYears, setHoldPeriodYears] = useState(5);
  const [isPortfolio, setIsPortfolio] = useState(false);
  const [addresses, setAddresses] = useState<TerminalDealAddress[]>([]);
  const [items, setItems] = useState<CapExItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Narratives, keyed by scope: key `deal` for single-property deals, otherwise
  // the address UUID for each portfolio building. We keep them in a map so
  // each textarea edits its own slice without clobbering the others.
  const [narratives, setNarratives] = useState<Record<string, string>>({});

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CapExFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<CapExItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [parsingFor, setParsingFor] = useState<string | null>(null); // addressId or 'deal'
  const [parseMessage, setParseMessage] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [dealRes, itemsRes, addressesRes] = await Promise.all([
      supabase
        .from('terminal_deals')
        .select('name, is_portfolio, hold_period_years, capex_narrative')
        .eq('id', dealId)
        .single(),
      supabase
        .from('capex_items')
        .select('*')
        .eq('deal_id', dealId)
        .order('sort_order', { ascending: true }),
      supabase
        .from('terminal_deal_addresses')
        .select('*')
        .eq('deal_id', dealId)
        .order('display_order', { ascending: true }),
    ]);
    if (dealRes.data) {
      setDealName(dealRes.data.name as string);
      setIsPortfolio(!!dealRes.data.is_portfolio);
      setHoldPeriodYears(parseHoldPeriod(dealRes.data.hold_period_years as string | null, 5));
    }
    if (itemsRes.data) setItems(itemsRes.data as CapExItem[]);
    if (addressesRes.data) setAddresses(addressesRes.data as TerminalDealAddress[]);

    // Hydrate narratives from whichever scope the deal uses
    const next: Record<string, string> = {};
    if (dealRes.data && !dealRes.data.is_portfolio) {
      next['deal'] = (dealRes.data.capex_narrative as string | null) ?? '';
    }
    if (addressesRes.data) {
      for (const addr of addressesRes.data as TerminalDealAddress[]) {
        next[addr.id] = addr.capex_narrative ?? '';
      }
    }
    setNarratives(next);

    setLoading(false);
  }, [dealId, supabase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  function openAdd(presetAddressId?: string) {
    setEditingId(null);
    const defaultAddressId = isPortfolio
      ? (presetAddressId ?? addresses[0]?.id ?? '')
      : '';
    setForm({ ...EMPTY_FORM, address_id: defaultAddressId });
    setShowModal(true);
  }

  function openEdit(item: CapExItem) {
    setEditingId(item.id);
    setForm(itemToForm(item));
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  }

  function updateFormField<K extends keyof CapExFormState>(key: K, value: CapExFormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    if (!form.component_name.trim()) {
      alert('Component name is required.');
      return;
    }
    if (isPortfolio && !form.address_id) {
      alert('Please select a building for this item.');
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        const existing = items.find((i) => i.id === editingId);
        const sortOrder = existing?.sort_order ?? 0;
        const payload = formToDb(form, dealId, sortOrder);
        const { data, error } = await supabase
          .from('capex_items')
          .update(payload)
          .eq('id', editingId)
          .select()
          .maybeSingle();
        if (error) {
          alert(`Failed to save: ${error.message}`);
        } else if (data) {
          setItems((prev) => prev.map((i) => (i.id === editingId ? (data as CapExItem) : i)));
          closeModal();
        } else {
          await fetchData();
          closeModal();
        }
      } else {
        const nextOrder = items.length > 0 ? Math.max(...items.map((i) => i.sort_order)) + 1 : 0;
        const payload = formToDb(form, dealId, nextOrder);
        const { data, error } = await supabase
          .from('capex_items')
          .insert(payload)
          .select()
          .maybeSingle();
        if (error) {
          alert(`Failed to save: ${error.message}`);
        } else if (data) {
          setItems((prev) => [...prev, data as CapExItem]);
          closeModal();
        } else {
          await fetchData();
          closeModal();
        }
      }
    } catch (e) {
      console.error('capex save failed', e);
      alert(`Failed to save: ${e instanceof Error ? e.message : 'unknown error'}`);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const { error } = await supabase.from('capex_items').delete().eq('id', deleteTarget.id);
      if (error) {
        alert(`Failed to delete: ${error.message}`);
      } else {
        setItems((prev) => prev.filter((i) => i.id !== deleteTarget.id));
        setDeleteTarget(null);
      }
    } catch (e) {
      console.error('capex delete failed', e);
      alert(`Failed to delete: ${e instanceof Error ? e.message : 'unknown error'}`);
    } finally {
      setDeleting(false);
    }
  }

  async function handleReorder(id: string, direction: 'up' | 'down') {
    const ordered = sortCapExForDisplay(items);
    const idx = ordered.findIndex((i) => i.id === id);
    if (idx === -1) return;
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= ordered.length) return;

    const a = ordered[idx];
    const b = ordered[swapIdx];
    const aOrder = a.sort_order;
    const bOrder = b.sort_order;

    await Promise.all([
      supabase.from('capex_items').update({ sort_order: bOrder }).eq('id', a.id),
      supabase.from('capex_items').update({ sort_order: aOrder }).eq('id', b.id),
    ]);

    setItems((prev) =>
      prev.map((i) => {
        if (i.id === a.id) return { ...i, sort_order: bOrder };
        if (i.id === b.id) return { ...i, sort_order: aOrder };
        return i;
      }),
    );
  }

  async function handleParseNarrative(addressId?: string) {
    // Serial-lock: only one parse at a time, matching the rent-roll admin
    // page. Prevents sort_order collisions and message clobbering.
    if (parsingFor !== null) return;
    const key = addressId ?? 'deal';
    const narrative = (narratives[key] ?? '').trim();
    if (!narrative) {
      setParseMessage('Paste some property condition notes first.');
      return;
    }
    setParsingFor(key);
    setParseMessage(null);
    try {
      const res = await fetch(`/api/admin/deals/${dealId}/parse-capex-narrative`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ addressId: addressId ?? null, narrative }),
      });
      const json = await res.json();
      if (!res.ok) {
        setParseMessage(`Parsing failed: ${json.error ?? 'unknown error'}`);
      } else {
        const label = addresses.find((a) => a.id === addressId)?.label;
        setParseMessage(
          `Parsed ${json.inserted ?? 0} item(s)${label ? ` for ${label}` : ''}. Review each row before publishing.`,
        );
        await fetchData();
      }
    } catch (err) {
      setParseMessage(`Parsing failed: ${err instanceof Error ? err.message : 'unknown error'}`);
    } finally {
      setParsingFor(null);
    }
  }

  const sortedItems = sortCapExForDisplay(items);
  const totalItems = items.length;
  const dealTotals = groupByPriority(items);
  const dealAnnualized = computeAnnualizedReserve(items, holdPeriodYears);
  const dealDuringHold = computeTotalDuringHold(items);

  interface Bucket {
    key: string;
    label: string;
    addressId: string | null;
    narrativeKey: string;
    itemsInBucket: CapExItem[];
  }
  const buckets: Bucket[] = isPortfolio
    ? [
        ...addresses.map((addr) => ({
          key: addr.id,
          label: addr.label,
          addressId: addr.id,
          narrativeKey: addr.id,
          itemsInBucket: sortedItems.filter((i) => i.address_id === addr.id),
        })),
        {
          key: 'unassigned',
          label: 'Unassigned / Needs Review',
          addressId: null,
          narrativeKey: 'unassigned',
          itemsInBucket: sortedItems.filter((i) => !i.address_id),
        },
      ].filter((b) => b.addressId !== null || b.itemsInBucket.length > 0)
    : [
        {
          key: 'all',
          label: '',
          addressId: null,
          narrativeKey: 'deal',
          itemsInBucket: sortedItems,
        },
      ];

  return (
    <div className="px-4 md:px-8 py-6 max-w-[1400px] mx-auto">
      <DealSubNav dealId={dealId} dealName={dealName} locale={locale} />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <SummaryCard label="Items" value={totalItems.toString()} />
        <SummaryCard label="Immediate + Near-Term" value={formatMoney(dealTotals['Immediate'] + dealTotals['Near-Term'], false)} />
        <SummaryCard label="Total (Hold)" value={formatMoney(dealDuringHold, false)} />
        <SummaryCard label={`Annualized / ${holdPeriodYears}yr`} value={formatMoney(dealAnnualized, false)} />
      </div>

      <div className="bg-white rounded-2xl border border-rp-gray-200 p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-[16px] font-semibold text-rp-navy">CapEx &amp; Property Condition</h2>
            <p className="text-[12px] text-rp-gray-500 mt-1">
              Informational only — does not modify cap rate, CoC, IRR, DSCR, equity, or the engine&rsquo;s CapEx reserve.
              {isPortfolio && ' Portfolio — items are grouped by building.'}
            </p>
          </div>
          {!isPortfolio && (
            <Button variant="gold" size="sm" onClick={() => openAdd()}>
              + Add Item
            </Button>
          )}
        </div>

        {parseMessage && (
          <div className="mb-4 p-3 rounded-lg bg-rp-gold/10 border border-rp-gold/30 text-[12px] text-rp-navy">
            {parseMessage}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-rp-gold border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="space-y-10">
            {buckets.map((bucket) => {
              const bucketTotals = groupByPriority(bucket.itemsInBucket);
              const bucketDuringHold = computeTotalDuringHold(bucket.itemsInBucket);
              const isParsing = parsingFor === (bucket.addressId ?? 'deal');
              const narrativeValue = narratives[bucket.narrativeKey] ?? '';

              return (
                <div key={bucket.key}>
                  {isPortfolio && (
                    <div className="flex items-center justify-between mb-3 pb-2 border-b border-rp-gray-200">
                      <div className="flex items-baseline gap-4 flex-wrap">
                        <h3 className="text-[14px] font-semibold text-rp-navy">
                          {bucket.label}
                          {bucket.addressId === null && (
                            <span className="ml-2 text-[11px] font-medium text-rp-red">
                              ({bucket.itemsInBucket.length} needs building assignment)
                            </span>
                          )}
                        </h3>
                        <span className="text-[11px] text-rp-gray-500">
                          Items {bucket.itemsInBucket.length} · Hold spend {formatMoney(bucketDuringHold, false)}
                        </span>
                      </div>
                      {bucket.addressId && (
                        <Button
                          variant="gold"
                          size="sm"
                          onClick={() => openAdd(bucket.addressId as string)}
                        >
                          + Item
                        </Button>
                      )}
                    </div>
                  )}

                  {/* Narrative textarea + Parse button — only for real scopes,
                      not the orphan bucket, since the orphan bucket has no
                      persistence target for the narrative. */}
                  {(bucket.addressId || !isPortfolio) && (
                    <div className="mb-4 p-4 rounded-lg border border-rp-gray-200 bg-rp-gray-50/50">
                      <label className="block text-[12px] font-semibold text-rp-gray-700 mb-2">
                        Property condition notes
                        {isPortfolio && bucket.label ? ` — ${bucket.label}` : ''}
                      </label>
                      <textarea
                        value={narrativeValue}
                        onChange={(e) =>
                          setNarratives((prev) => ({ ...prev, [bucket.narrativeKey]: e.target.value }))
                        }
                        rows={4}
                        placeholder="Roof was replaced 5 years ago, should be good for another 15. HVAC is original — three rooftop units on R-22, need replacement in 3-5 years, budget $90K…"
                        className="w-full px-3.5 py-2.5 border border-rp-gray-300 rounded-lg text-sm text-rp-gray-700 bg-white focus:outline-none focus:ring-[3px] focus:ring-rp-gold/15 focus:border-rp-gold"
                      />
                      <div className="mt-2 flex items-center justify-between">
                        <p className="text-[11px] text-rp-gray-500">
                          AI will extract structured line items. Review before publishing.
                        </p>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleParseNarrative(bucket.addressId ?? undefined)}
                          loading={isParsing}
                          disabled={parsingFor !== null && !isParsing}
                        >
                          Parse with AI
                        </Button>
                      </div>
                    </div>
                  )}

                  {bucket.itemsInBucket.length === 0 ? (
                    <div className="text-center py-8 text-rp-gray-400 text-[12px]">
                      No CapEx items yet. Add one manually or paste notes and click &ldquo;Parse with AI&rdquo;.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-[11px] uppercase tracking-wide text-rp-gray-500 border-b border-rp-gray-200">
                            <th className="py-2 pr-3 w-14">Order</th>
                            <th className="py-2 pr-3">Component</th>
                            <th className="py-2 pr-3">Condition</th>
                            <th className="py-2 pr-3">Last Replaced</th>
                            <th className="py-2 pr-3">Life Remaining</th>
                            <th className="py-2 pr-3 text-right">Est. Cost</th>
                            <th className="py-2 pr-3">Priority</th>
                            <th className="py-2 pr-3 w-28 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {bucket.itemsInBucket.map((item) => {
                            const globalIdx = sortedItems.findIndex((i) => i.id === item.id);
                            const cc = conditionColor(item.current_condition);
                            return (
                              <tr key={item.id} className="border-b border-rp-gray-100">
                                <td className="py-2 pr-3">
                                  <div className="flex flex-col">
                                    <button
                                      onClick={() => handleReorder(item.id, 'up')}
                                      disabled={globalIdx === 0}
                                      className="text-rp-gray-400 hover:text-rp-navy disabled:opacity-20 text-xs"
                                      aria-label="Move up"
                                    >
                                      ▲
                                    </button>
                                    <button
                                      onClick={() => handleReorder(item.id, 'down')}
                                      disabled={globalIdx === sortedItems.length - 1}
                                      className="text-rp-gray-400 hover:text-rp-navy disabled:opacity-20 text-xs"
                                      aria-label="Move down"
                                    >
                                      ▼
                                    </button>
                                  </div>
                                </td>
                                <td className="py-2 pr-3 font-medium text-rp-navy">
                                  {item.component_name}
                                  {item.ai_extracted && (
                                    <span className="ml-2 inline-block text-[9px] font-semibold uppercase tracking-wider text-rp-gold bg-rp-gold/10 px-1.5 py-0.5 rounded">
                                      AI
                                    </span>
                                  )}
                                </td>
                                <td className="py-2 pr-3">
                                  <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium ${cc.bg} ${cc.text}`}>
                                    <span className={`w-1.5 h-1.5 rounded-full ${cc.dot}`} />
                                    {item.current_condition}
                                  </span>
                                </td>
                                <td className="py-2 pr-3 text-rp-gray-600">{item.year_last_replaced ?? '—'}</td>
                                <td className="py-2 pr-3 text-rp-gray-600">{item.useful_life_remaining ?? '—'}</td>
                                <td className="py-2 pr-3 text-right">{formatMoney(item.estimated_replacement_cost)}</td>
                                <td className="py-2 pr-3">{item.priority}</td>
                                <td className="py-2 pr-3 text-right">
                                  <button
                                    onClick={() => openEdit(item)}
                                    className="text-rp-navy hover:underline text-xs font-medium"
                                  >
                                    Edit
                                  </button>
                                  <span className="mx-1 text-rp-gray-300">·</span>
                                  <button
                                    onClick={() => setDeleteTarget(item)}
                                    className="text-rp-red hover:underline text-xs font-medium"
                                  >
                                    Delete
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showModal && (
        <Modal
          isOpen={showModal}
          onClose={closeModal}
          title={editingId ? 'Edit CapEx Item' : 'Add CapEx Item'}
        >
          <div className="max-h-[70vh] overflow-y-auto pr-1 space-y-3">
            {isPortfolio && (
              <div>
                <label className="block text-[13px] font-medium text-rp-gray-700 mb-1.5">Building *</label>
                <select
                  value={form.address_id}
                  onChange={(e) => updateFormField('address_id', e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-rp-gray-300 rounded-lg text-sm text-rp-gray-700 bg-white focus:outline-none focus:ring-[3px] focus:ring-rp-gold/15 focus:border-rp-gold"
                >
                  <option value="">Select a building…</option>
                  {addresses.map((addr) => (
                    <option key={addr.id} value={addr.id}>
                      {addr.label}
                      {addr.address ? ` — ${addr.address}` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <Input
              label="Component Name *"
              value={form.component_name}
              onChange={(e) => updateFormField('component_name', e.target.value)}
              placeholder="Roof, HVAC, Parking Lot, Elevator…"
            />

            <div className="grid grid-cols-2 gap-3">
              <SelectField
                label="Current Condition"
                value={form.current_condition}
                onChange={(v) => updateFormField('current_condition', v as CapExCondition)}
                options={CAPEX_CONDITIONS}
              />
              <SelectField
                label="Priority"
                value={form.priority}
                onChange={(v) => updateFormField('priority', v as CapExPriority)}
                options={CAPEX_PRIORITIES}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Year Last Replaced"
                value={form.year_last_replaced}
                onChange={(e) => updateFormField('year_last_replaced', e.target.value)}
                placeholder='e.g. "2018", "Original 1975"'
              />
              <Input
                label="Useful Life Remaining"
                value={form.useful_life_remaining}
                onChange={(e) => updateFormField('useful_life_remaining', e.target.value)}
                placeholder='e.g. "12+ years", "3-5 years"'
              />
            </div>

            <Input
              label="Estimated Replacement Cost ($)"
              value={form.estimated_replacement_cost}
              onChange={(e) => updateFormField('estimated_replacement_cost', e.target.value)}
              placeholder="e.g. 40000"
            />

            <div>
              <label className="block text-[13px] font-medium text-rp-gray-700 mb-1.5">Notes</label>
              <textarea
                value={form.notes}
                onChange={(e) => updateFormField('notes', e.target.value)}
                rows={3}
                placeholder="Warranties, inspection findings, quotes…"
                className="w-full px-3.5 py-2.5 border border-rp-gray-300 rounded-lg text-sm text-rp-gray-700 focus:outline-none focus:ring-[3px] focus:ring-rp-gold/15 focus:border-rp-gold"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-4">
            <Button variant="ghost" size="sm" onClick={closeModal}>Cancel</Button>
            <Button variant="gold" size="sm" onClick={handleSave} loading={saving}>
              {editingId ? 'Save Changes' : 'Add'}
            </Button>
          </div>
        </Modal>
      )}

      {deleteTarget && (
        <Modal
          isOpen={!!deleteTarget}
          onClose={() => setDeleteTarget(null)}
          title="Delete CapEx Item"
        >
          <p className="text-sm text-rp-gray-600 mb-6">
            Remove &ldquo;{deleteTarget.component_name}&rdquo; from this deal&rsquo;s CapEx list? This cannot be undone.
          </p>
          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="danger" size="sm" onClick={handleDelete} loading={deleting}>Delete</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-xl border border-rp-gray-200 p-4">
      <div className="text-[10px] font-semibold tracking-wider uppercase text-rp-gray-500">{label}</div>
      <div className="mt-1 text-[18px] font-semibold text-rp-navy font-[family-name:var(--font-playfair)]">
        {value}
      </div>
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: readonly string[];
}) {
  return (
    <div>
      <label className="block text-[13px] font-medium text-rp-gray-700 mb-1.5">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3.5 py-2.5 border border-rp-gray-300 rounded-lg text-sm text-rp-gray-700 bg-white focus:outline-none focus:ring-[3px] focus:ring-rp-gold/15 focus:border-rp-gold"
      >
        {options.map((opt) => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
    </div>
  );
}
