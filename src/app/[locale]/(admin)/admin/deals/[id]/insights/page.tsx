'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import DealSubNav from '@/components/admin/DealSubNav';
import {
  createCategory,
  renameCategory,
  addInsight,
  updateInsight,
  deleteInsight,
} from './actions';
import type { InsightCategory, DealInsight } from '@/lib/types/database';

export default function DealInsightsAdminPage() {
  const params = useParams();
  const dealId = params.id as string;
  const locale = (params.locale as string) ?? 'en';
  const supabase = createClient();

  const [dealName, setDealName] = useState('');
  const [categories, setCategories] = useState<InsightCategory[]>([]);
  const [insights, setInsights] = useState<DealInsight[]>([]);
  // Categories surfaced on this deal: those with insights here, plus any the
  // admin added this session before writing an insight under them.
  const [activeCategoryIds, setActiveCategoryIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [showAddCategory, setShowAddCategory] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [dealRes, catsRes, insightsRes] = await Promise.all([
      supabase.from('terminal_deals').select('name').eq('id', dealId).single(),
      supabase
        .from('terminal_insight_categories')
        .select('*')
        .order('display_name', { ascending: true }),
      supabase
        .from('terminal_deal_insights')
        .select('*, category:terminal_insight_categories(id, name, display_name)')
        .eq('deal_id', dealId)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true }),
    ]);
    if (dealRes.data) setDealName(dealRes.data.name as string);
    if (catsRes.data) setCategories(catsRes.data as InsightCategory[]);
    if (insightsRes.data) {
      const list = insightsRes.data as DealInsight[];
      setInsights(list);
      // Seed active categories from whatever already has insights here.
      setActiveCategoryIds((prev) => {
        const fromInsights = list.map((i) => i.category_id);
        return Array.from(new Set([...prev, ...fromInsights]));
      });
    }
    setLoading(false);
  }, [dealId, supabase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const categoriesById = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories],
  );

  const insightsByCategory = useMemo(() => {
    const map = new Map<string, DealInsight[]>();
    for (const ins of insights) {
      const arr = map.get(ins.category_id) ?? [];
      arr.push(ins);
      map.set(ins.category_id, arr);
    }
    return map;
  }, [insights]);

  // Ordered list of category groups to render on this deal.
  const activeCategories = useMemo(
    () =>
      activeCategoryIds
        .map((id) => categoriesById.get(id))
        .filter((c): c is InsightCategory => !!c)
        .sort((a, b) => a.display_name.localeCompare(b.display_name)),
    [activeCategoryIds, categoriesById],
  );

  function flash(msg: string) {
    setMessage(msg);
    window.setTimeout(() => setMessage(null), 3000);
  }

  // Add an existing category as a group on this deal (no DB write — it
  // persists once an insight is added under it).
  function addExistingCategory(categoryId: string) {
    setActiveCategoryIds((prev) => (prev.includes(categoryId) ? prev : [...prev, categoryId]));
    setShowAddCategory(false);
  }

  async function handleCreateCategory(displayName: string) {
    const res = await createCategory(displayName);
    if (!res.ok) {
      flash(res.error);
      return;
    }
    await fetchData();
    setActiveCategoryIds((prev) => (prev.includes(res.id) ? prev : [...prev, res.id]));
    setShowAddCategory(false);
    flash(res.existed ? 'Category already existed — added to this deal.' : 'Category created.');
  }

  async function handleRename(categoryId: string, displayName: string) {
    const res = await renameCategory(categoryId, displayName);
    if (!res.ok) {
      flash(res.error);
      return;
    }
    setCategories((prev) =>
      prev.map((c) => (c.id === categoryId ? { ...c, display_name: displayName } : c)),
    );
    flash('Category renamed.');
  }

  async function handleAddInsight(categoryId: string, content: string) {
    const res = await addInsight({ dealId, categoryId, content });
    if (!res.ok) {
      flash(res.error);
      return;
    }
    await fetchData();
  }

  async function handleUpdateInsight(insightId: string, content: string) {
    const res = await updateInsight(insightId, content);
    if (!res.ok) {
      flash(res.error);
      return;
    }
    setInsights((prev) => prev.map((i) => (i.id === insightId ? { ...i, content } : i)));
    flash('Insight saved.');
  }

  async function handleDeleteInsight(insightId: string) {
    const res = await deleteInsight(insightId);
    if (!res.ok) {
      flash(res.error);
      return;
    }
    setInsights((prev) => prev.filter((i) => i.id !== insightId));
  }

  // Categories available to add (global list minus already-active on this deal).
  const availableCategories = useMemo(
    () => categories.filter((c) => !activeCategoryIds.includes(c.id)),
    [categories, activeCategoryIds],
  );

  return (
    <div className="px-4 md:px-8 py-6 max-w-[1400px] mx-auto">
      <DealSubNav dealId={dealId} dealName={dealName} locale={locale} />

      {message && (
        <div className="mb-4 p-3 rounded-lg bg-rp-gold/10 border border-rp-gold/30 text-[12px] text-rp-navy">
          {message}
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[20px] font-semibold text-rp-navy font-[family-name:var(--font-playfair)]">
            Insights
          </h1>
          <p className="text-[12px] text-rp-gray-500 mt-1">
            Category-tagged notes shown on the deal page. Add a category, then add insights under it.
          </p>
        </div>
        <Button variant="gold" size="sm" onClick={() => setShowAddCategory(true)}>
          Add Category
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-6 h-6 border-2 border-rp-gold border-t-transparent rounded-full animate-spin" />
        </div>
      ) : activeCategories.length === 0 ? (
        <div className="bg-white rounded-2xl border border-rp-gray-200 p-10 text-center">
          <h2 className="text-[16px] font-semibold text-rp-navy mb-2">No insights yet.</h2>
          <p className="text-[13px] text-rp-gray-500 mb-6 max-w-[480px] mx-auto">
            Add a category (e.g. Motivation, Pressure Point) and write insights under it.
            The Insights tab stays hidden from investors until at least one insight exists.
          </p>
          <Button variant="gold" size="md" onClick={() => setShowAddCategory(true)}>
            Add Category
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          {activeCategories.map((cat) => (
            <CategoryCard
              key={cat.id}
              category={cat}
              insights={insightsByCategory.get(cat.id) ?? []}
              onRename={(name) => handleRename(cat.id, name)}
              onAddInsight={(content) => handleAddInsight(cat.id, content)}
              onUpdateInsight={handleUpdateInsight}
              onDeleteInsight={handleDeleteInsight}
            />
          ))}
        </div>
      )}

      {showAddCategory && (
        <AddCategoryModal
          available={availableCategories}
          onClose={() => setShowAddCategory(false)}
          onPickExisting={addExistingCategory}
          onCreate={handleCreateCategory}
        />
      )}
    </div>
  );
}

function CategoryCard({
  category,
  insights,
  onRename,
  onAddInsight,
  onUpdateInsight,
  onDeleteInsight,
}: {
  category: InsightCategory;
  insights: DealInsight[];
  onRename: (displayName: string) => void;
  onAddInsight: (content: string) => Promise<void> | void;
  onUpdateInsight: (insightId: string, content: string) => Promise<void> | void;
  onDeleteInsight: (insightId: string) => Promise<void> | void;
}) {
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(category.display_name);
  const [newInsight, setNewInsight] = useState('');
  const [adding, setAdding] = useState(false);

  async function submitNew() {
    const content = newInsight.trim();
    if (!content || adding) return;
    setAdding(true);
    await onAddInsight(content);
    setNewInsight('');
    setAdding(false);
  }

  return (
    <div className="bg-white rounded-2xl border border-rp-gray-200 p-6">
      <div className="flex items-center justify-between mb-4 gap-3">
        {editingName ? (
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Input label="" value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} />
              <Button
                variant="gold"
                size="sm"
                onClick={() => {
                  onRename(nameDraft.trim() || category.display_name);
                  setEditingName(false);
                }}
              >
                Save
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setNameDraft(category.display_name);
                  setEditingName(false);
                }}
              >
                Cancel
              </Button>
            </div>
            <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-rp-red">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              Categories are shared — renaming this changes its label on every deal it&rsquo;s used in.
            </p>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <h3 className="text-[15px] font-semibold text-rp-navy">{category.display_name}</h3>
            <span className="text-[10px] font-mono text-rp-gray-400 bg-rp-gray-50 px-1.5 py-0.5 rounded">
              {category.name}
            </span>
            <button
              onClick={() => {
                setNameDraft(category.display_name);
                setEditingName(true);
              }}
              className="text-[11px] text-rp-gold hover:underline"
            >
              Rename
            </button>
          </div>
        )}
      </div>

      <div className="space-y-2">
        {insights.map((ins) => (
          <InsightRow
            key={ins.id}
            insight={ins}
            onSave={(content) => onUpdateInsight(ins.id, content)}
            onDelete={() => onDeleteInsight(ins.id)}
          />
        ))}
        {insights.length === 0 && (
          <p className="text-[12px] text-rp-gray-400 italic">No insights in this category yet.</p>
        )}
      </div>

      <div className="mt-4 flex items-start gap-2">
        <textarea
          value={newInsight}
          onChange={(e) => setNewInsight(e.target.value)}
          rows={2}
          placeholder="Add an insight…"
          className="flex-1 px-3.5 py-2.5 border border-rp-gray-300 rounded-lg text-sm text-rp-gray-700 focus:outline-none focus:ring-[3px] focus:ring-rp-gold/15 focus:border-rp-gold"
        />
        <Button variant="gold" size="sm" onClick={submitNew} loading={adding}>
          Add
        </Button>
      </div>
    </div>
  );
}

function InsightRow({
  insight,
  onSave,
  onDelete,
}: {
  insight: DealInsight;
  onSave: (content: string) => Promise<void> | void;
  onDelete: () => Promise<void> | void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(insight.content);

  if (editing) {
    return (
      <div className="flex items-start gap-2 p-3 rounded-lg bg-rp-gray-50/70 border border-rp-gray-200">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={2}
          className="flex-1 px-3 py-2 border border-rp-gray-300 rounded-lg text-sm text-rp-gray-700 focus:outline-none focus:ring-[3px] focus:ring-rp-gold/15 focus:border-rp-gold"
        />
        <Button
          variant="gold"
          size="sm"
          onClick={() => {
            onSave(draft.trim() || insight.content);
            setEditing(false);
          }}
        >
          Save
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setDraft(insight.content);
            setEditing(false);
          }}
        >
          Cancel
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-start justify-between gap-3 p-3 rounded-lg bg-rp-gray-50/70 border border-rp-gray-200">
      <p className="text-[13px] text-rp-gray-700 whitespace-pre-wrap flex-1">{insight.content}</p>
      <div className="flex items-center gap-2 shrink-0">
        <button onClick={() => setEditing(true)} className="text-[11px] text-rp-gold hover:underline">
          Edit
        </button>
        <button onClick={onDelete} className="text-[11px] text-red-500 hover:underline">
          Delete
        </button>
      </div>
    </div>
  );
}

function AddCategoryModal({
  available,
  onClose,
  onPickExisting,
  onCreate,
}: {
  available: InsightCategory[];
  onClose: () => void;
  onPickExisting: (categoryId: string) => void;
  onCreate: (displayName: string) => Promise<void> | void;
}) {
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return available;
    return available.filter(
      (c) => c.display_name.toLowerCase().includes(q) || c.name.includes(q),
    );
  }, [available, search]);

  async function submitNew() {
    const name = newName.trim();
    if (!name || creating) return;
    setCreating(true);
    await onCreate(name);
    setNewName('');
    setCreating(false);
  }

  const slugPreview = newName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_{2,}/g, '_');

  return (
    <Modal isOpen onClose={onClose} title="Add Category">
      <div className="space-y-6">
        {/* Create new */}
        <div>
          <label className="block text-[13px] font-medium text-rp-gray-700 mb-1.5">
            Create a new category
          </label>
          <Input
            label=""
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="e.g. Pressure Point"
            onKeyDown={(e) => {
              if (e.key === 'Enter') submitNew();
            }}
            autoFocus
          />
          <div className="mt-1.5 flex items-center justify-between gap-3 min-h-[18px]">
            <p className="text-[11px] text-rp-gray-400">
              {slugPreview ? (
                <>
                  Stored as <span className="font-mono text-rp-gray-500">{slugPreview}</span> ·
                  duplicates merge automatically
                </>
              ) : (
                'Stored as a snake_case key; duplicates merge automatically.'
              )}
            </p>
          </div>
          <Button
            variant="gold"
            size="sm"
            onClick={submitNew}
            loading={creating}
            disabled={!newName.trim()}
            className="mt-2 w-full"
          >
            Create category
          </Button>
        </div>

        {/* Choose existing */}
        {available.length > 0 && (
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="h-px flex-1 bg-rp-gray-200" />
              <span className="text-[11px] font-medium uppercase tracking-wider text-rp-gray-400">
                or choose existing
              </span>
              <div className="h-px flex-1 bg-rp-gray-200" />
            </div>
            <Input
              label=""
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search categories…"
            />
            <div className="mt-2 max-h-[240px] overflow-y-auto rounded-lg border border-rp-gray-200 divide-y divide-rp-gray-100">
              {filtered.length === 0 ? (
                <p className="p-3 text-[12px] text-rp-gray-400">No matching categories.</p>
              ) : (
                filtered.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => onPickExisting(c.id)}
                    className="w-full flex items-center justify-between gap-3 px-3.5 py-3 text-left hover:bg-rp-gold/5 transition-colors group"
                  >
                    <span className="flex items-center gap-2.5 min-w-0">
                      <span className="w-1.5 h-4 rounded-full bg-rp-gold/40 group-hover:bg-rp-gold transition-colors shrink-0" />
                      <span className="text-[13px] text-rp-gray-700 truncate">{c.display_name}</span>
                    </span>
                    <span className="text-[10px] font-mono text-rp-gray-400 shrink-0">{c.name}</span>
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
