import { createClient } from '@/lib/supabase/server';

export const metadata = { title: 'AI Usage — RePrime Terminal Beta Admin' };

interface UsageRow {
  user_id: string;
  input_tokens: number;
  output_tokens: number;
  message_count: number;
  last_model: string | null;
  last_deal_id: string | null;
  created_at: string;
  updated_at: string;
  terminal_users: { full_name: string | null; email: string | null } | null;
  terminal_deals: { name: string | null } | null;
}

const fmt = (n: number) => n.toLocaleString('en-US');
const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleString() : '—');

export default async function AiUsagePage() {
  const supabase = await createClient();

  const { data: rowsRaw } = await supabase
    .from('terminal_ai_usage')
    .select(
      'user_id, input_tokens, output_tokens, message_count, last_model, last_deal_id, created_at, updated_at, terminal_users(full_name, email), terminal_deals!last_deal_id(name)',
    )
    .order('input_tokens', { ascending: false });

  const rows = (rowsRaw as UsageRow[] | null) ?? [];

  const totalInput = rows.reduce((s, r) => s + (r.input_tokens ?? 0), 0);
  const totalOutput = rows.reduce((s, r) => s + (r.output_tokens ?? 0), 0);
  const totalMessages = rows.reduce((s, r) => s + (r.message_count ?? 0), 0);
  const totalUsers = rows.length;

  const byModel = new Map<string, { input: number; output: number; users: number }>();
  for (const r of rows) {
    const key = r.last_model ?? 'unknown';
    const cur = byModel.get(key) ?? { input: 0, output: 0, users: 0 };
    cur.input += r.input_tokens ?? 0;
    cur.output += r.output_tokens ?? 0;
    cur.users += 1;
    byModel.set(key, cur);
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold text-[#0E3470]">AI Usage</h1>
        <p className="text-sm text-gray-600 mt-1">
          Per-user cumulative token consumption from <code>terminal_ai_usage</code>. Each chat
          turn adds to the user&apos;s row via the <code>terminal_ai_usage_increment</code> RPC;
          one row per user.
        </p>
      </header>

      <section className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Stat label="Active users" value={fmt(totalUsers)} />
        <Stat label="Total messages" value={fmt(totalMessages)} />
        <Stat label="Input tokens" value={fmt(totalInput)} />
        <Stat label="Output tokens" value={fmt(totalOutput)} />
      </section>

      <section>
        <h2 className="text-lg font-semibold text-[#0E3470] mb-3">By model (last model used per user)</h2>
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-2">Model</th>
                <th className="px-4 py-2 text-right">Users</th>
                <th className="px-4 py-2 text-right">Input</th>
                <th className="px-4 py-2 text-right">Output</th>
                <th className="px-4 py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {Array.from(byModel.entries()).map(([model, m]) => (
                <tr key={model} className="border-t border-gray-100">
                  <td className="px-4 py-2 font-mono text-xs">{model}</td>
                  <td className="px-4 py-2 text-right">{fmt(m.users)}</td>
                  <td className="px-4 py-2 text-right">{fmt(m.input)}</td>
                  <td className="px-4 py-2 text-right">{fmt(m.output)}</td>
                  <td className="px-4 py-2 text-right">{fmt(m.input + m.output)}</td>
                </tr>
              ))}
              {byModel.size === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-gray-500">
                    No usage recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-[#0E3470] mb-3">By user</h2>
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-2">User</th>
                <th className="px-4 py-2 text-right">Messages</th>
                <th className="px-4 py-2 text-right">Input</th>
                <th className="px-4 py-2 text-right">Output</th>
                <th className="px-4 py-2 text-right">Total</th>
                <th className="px-4 py-2">Last model</th>
                <th className="px-4 py-2">Last deal</th>
                <th className="px-4 py-2">Last activity</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.user_id} className="border-t border-gray-100">
                  <td className="px-4 py-2">
                    <div>{r.terminal_users?.full_name ?? <span className="text-gray-400">unknown</span>}</div>
                    <div className="text-xs text-gray-500">{r.terminal_users?.email ?? r.user_id}</div>
                  </td>
                  <td className="px-4 py-2 text-right">{fmt(r.message_count)}</td>
                  <td className="px-4 py-2 text-right">{fmt(r.input_tokens)}</td>
                  <td className="px-4 py-2 text-right">{fmt(r.output_tokens)}</td>
                  <td className="px-4 py-2 text-right font-medium">
                    {fmt(r.input_tokens + r.output_tokens)}
                  </td>
                  <td className="px-4 py-2 font-mono text-xs">
                    {r.last_model ?? <span className="text-gray-400">—</span>}
                  </td>
                  <td className="px-4 py-2 text-xs">
                    {r.terminal_deals?.name ?? <span className="text-gray-400">—</span>}
                  </td>
                  <td className="px-4 py-2 text-xs text-gray-600">{fmtDate(r.updated_at)}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-6 text-center text-gray-500">
                    No users yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="text-xs uppercase tracking-wide text-gray-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-[#0E3470]">{value}</div>
    </div>
  );
}
