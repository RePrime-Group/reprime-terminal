// Single source of truth for the embedding model identifier. Imported by
// embed.ts (TypeScript) and scripts/verify-phase-5.mjs (Node). At Step 4 of
// Phase 6 the bump from 001 → 002 happens here and cascades to both callers.

export const EMBEDDING_MODEL_NAME = 'gemini-embedding-2';
export const EMBEDDING_DIM = 1536;
export const EMBEDDING_MODEL = `${EMBEDDING_MODEL_NAME}@${EMBEDDING_DIM}`;
export const GEMINI_EMBED_URL = `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL_NAME}:embedContent`;
