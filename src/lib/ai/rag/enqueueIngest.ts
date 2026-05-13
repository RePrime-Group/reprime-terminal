// Phase 6 Step 6 — fire-and-forget POST to the n8n ingestion webhook.
//
// Server-only. Bulk uploads are rate-limited by a 3-in-flight semaphore so a
// 10-file drop doesn't open 10 simultaneous Haiku/Gemini fan-outs. Never
// throws: the upload itself has already succeeded by the time we call this,
// so an enqueue failure must not surface to the user. If we can't reach n8n
// the row stays indexing_status='pending' and the Phase 6 Step 8 backfill
// script picks it up later.

const MAX_IN_FLIGHT = 3;
let inFlight = 0;
const waiters: Array<() => void> = [];

async function acquire(): Promise<void> {
  if (inFlight < MAX_IN_FLIGHT) {
    inFlight++;
    return;
  }
  await new Promise<void>((resolve) => waiters.push(resolve));
  inFlight++;
}

function release(): void {
  inFlight--;
  const next = waiters.shift();
  if (next) next();
}

export async function enqueueIngest(documentId: string, dealId: string): Promise<void> {
  const url = process.env.N8N_INGEST_WEBHOOK_URL;
  if (!url) {
    console.warn('[rag] N8N_INGEST_WEBHOOK_URL not set; skipping enqueue', { documentId });
    return;
  }

  await acquire();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5_000);
    try {
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ document_id: documentId, deal_id: dealId }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }
  } catch (err) {
    console.error('[rag] enqueueIngest failed', { documentId, dealId, err });
  } finally {
    release();
  }
}
