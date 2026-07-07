import 'server-only';
import { google } from 'googleapis';
import type { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

// ─────────────────────────────────────────────────────────────────────────────
// Google Drive — org-wide connection helpers.
//
// A SINGLE Google account is connected for the whole workspace. Its OAuth
// tokens live in terminal_google_drive_connection (one row, service-role only).
// The browser never sees the refresh token; when the Picker needs a token we
// mint a short-lived access token server-side and hand only that to the client.
//
// Scopes: drive.readonly (browse + copy files out) + userinfo.email (record
// which account is connected). Read-only — we never modify the user's Drive.
// ─────────────────────────────────────────────────────────────────────────────

export const DRIVE_SCOPES = [
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/userinfo.email',
];

// Refresh the cached access token this many ms before it actually expires.
const EXPIRY_SKEW_MS = 60_000;

export interface DriveConnection {
  google_email: string;
  refresh_token: string;
  access_token: string | null;
  token_expiry: string | null; // ISO
  scope: string | null;
}

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} environment variable is not set`);
  return v;
}

const CALLBACK_PATH = '/api/integrations/google-drive/callback';

// Build the OAuth redirect URI from the current request's public origin
// (honoring the proxy's forwarded headers). This lets the same code serve
// localhost and prod; each resulting callback URL must be registered as an
// Authorized redirect URI on the Google OAuth client.
export function getDriveRedirectUri(req: NextRequest): string {
  const proto = req.headers.get('x-forwarded-proto') ?? req.nextUrl.protocol.replace(':', '');
  const host =
    req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? req.nextUrl.host;
  return `${proto}://${host}${CALLBACK_PATH}`;
}

// A bare OAuth2 client (no tokens). `redirectUri` is required for the auth-URL
// and code-exchange steps (it must match what Google has registered) but is
// irrelevant to the refresh-token grant, so it's optional here.
export function getOAuthClient(redirectUri?: string) {
  return new google.auth.OAuth2(
    requireEnv('GOOGLE_DRIVE_CLIENT_ID'),
    requireEnv('GOOGLE_DRIVE_CLIENT_SECRET'),
    redirectUri,
  );
}

// Consent URL. `state` carries our CSRF nonce + return locale. `redirectUri` is
// derived per-request from the browser's origin so localhost and prod both work
// without an env swap (each origin's callback must be registered in Google Cloud).
export function getAuthUrl(state: string, redirectUri: string): string {
  return getOAuthClient(redirectUri).generateAuthUrl({
    access_type: 'offline', // ask for a refresh token
    prompt: 'consent', // force refresh_token on every (re)connect
    include_granted_scopes: true,
    scope: DRIVE_SCOPES,
    state,
  });
}

// Exchange the auth code for tokens and read the account email. `redirectUri`
// must be byte-identical to the one used to build the consent URL.
export async function exchangeCodeAndSave(
  code: string,
  connectedBy: string | null,
  redirectUri: string,
) {
  const client = getOAuthClient(redirectUri);
  const { tokens } = await client.getToken(code);
  if (!tokens.refresh_token) {
    // Google only returns a refresh_token when access_type=offline + a fresh
    // consent. If missing, the user likely re-approved without consent screen.
    throw new Error(
      'Google did not return a refresh token. Disconnect any prior grant and try again.',
    );
  }
  client.setCredentials(tokens);

  const oauth2 = google.oauth2({ version: 'v2', auth: client });
  const { data: userinfo } = await oauth2.userinfo.get();

  const supabase = createAdminClient();
  const { error } = await supabase.from('terminal_google_drive_connection').upsert(
    {
      id: true,
      google_email: userinfo.email ?? 'unknown',
      refresh_token: tokens.refresh_token,
      access_token: tokens.access_token ?? null,
      token_expiry: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
      scope: tokens.scope ?? DRIVE_SCOPES.join(' '),
      connected_by: connectedBy,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' },
  );
  if (error) throw new Error(`Failed to store Google Drive connection: ${error.message}`);

  return { email: userinfo.email ?? 'unknown' };
}

// Fetch the single connection row (service role). Returns null if not connected.
export async function getConnection(): Promise<DriveConnection | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from('terminal_google_drive_connection')
    .select('google_email, refresh_token, access_token, token_expiry, scope')
    .eq('id', true)
    .maybeSingle();
  return (data as DriveConnection | null) ?? null;
}

export async function deleteConnection(): Promise<void> {
  const supabase = createAdminClient();
  await supabase.from('terminal_google_drive_connection').delete().eq('id', true);
}

// Return a valid access token, refreshing (and persisting) if the cached one is
// missing or within EXPIRY_SKEW_MS of expiring.
export async function getAccessToken(): Promise<string> {
  const conn = await getConnection();
  if (!conn) throw new Error('Google Drive is not connected');

  const expiryMs = conn.token_expiry ? Date.parse(conn.token_expiry) : 0;
  if (conn.access_token && expiryMs - EXPIRY_SKEW_MS > Date.now()) {
    return conn.access_token;
  }

  const client = getOAuthClient();
  client.setCredentials({ refresh_token: conn.refresh_token });
  const { credentials } = await client.refreshAccessToken();
  if (!credentials.access_token) {
    throw new Error('Failed to refresh Google Drive access token');
  }

  const supabase = createAdminClient();
  await supabase
    .from('terminal_google_drive_connection')
    .update({
      access_token: credentials.access_token,
      token_expiry: credentials.expiry_date
        ? new Date(credentials.expiry_date).toISOString()
        : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', true);

  return credentials.access_token;
}

// An authenticated Drive v3 client bound to the org connection.
async function getDriveClient() {
  const accessToken = await getAccessToken();
  const client = getOAuthClient();
  client.setCredentials({ access_token: accessToken });
  return google.drive({ version: 'v3', auth: client });
}

export interface DriveFolderEntry {
  id: string;
  name: string;
}

const FOLDER_FILTER = "mimeType = 'application/vnd.google-apps.folder' and trashed = false";

function sortByName(entries: DriveFolderEntry[]): DriveFolderEntry[] {
  return entries.sort((a, b) => a.name.localeCompare(b.name));
}

// List the immediate subfolders of `parentId`. For the special 'root' level we
// merge three sources so the browser is never mysteriously empty: My Drive root
// folders, "Shared with me" folders, and Shared Drives. Deeper levels list the
// children of the given folder (works inside Shared Drives via the allDrives
// corpora). `parentId` values come from prior results, so they're safe to
// interpolate into the query.
export async function listSubfolders(parentId: string): Promise<DriveFolderEntry[]> {
  const drive = await getDriveClient();

  if (parentId === 'root') {
    const [mine, shared, drives] = await Promise.all([
      drive.files.list({
        q: `'root' in parents and ${FOLDER_FILTER}`,
        fields: 'files(id, name)',
        pageSize: 200,
      }),
      drive.files.list({
        q: `sharedWithMe = true and ${FOLDER_FILTER}`,
        fields: 'files(id, name)',
        pageSize: 200,
      }),
      // Shared Drives (Team Drives). Ignore if the account has none / no access.
      drive.drives
        .list({ pageSize: 100, fields: 'drives(id, name)' })
        .catch(() => ({ data: { drives: [] as { id?: string; name?: string }[] } })),
    ]);

    const map = new Map<string, string>();
    for (const f of mine.data.files ?? []) if (f.id && f.name) map.set(f.id, f.name);
    for (const f of shared.data.files ?? []) if (f.id && f.name) map.set(f.id, f.name);
    for (const d of drives.data.drives ?? []) if (d.id && d.name) map.set(d.id, d.name);

    return sortByName([...map].map(([id, name]) => ({ id, name })));
  }

  const res = await drive.files.list({
    q: `'${parentId}' in parents and ${FOLDER_FILTER}`,
    fields: 'files(id, name)',
    pageSize: 200,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
    corpora: 'allDrives',
  });
  return sortByName(
    (res.data.files ?? [])
      .filter((f): f is { id: string; name: string } => !!f.id && !!f.name)
      .map((f) => ({ id: f.id, name: f.name })),
  );
}

// Search folders by name across all drives + shared-with-me. `query` is user
// input, so escape backslashes and quotes before interpolating into the Drive
// query language.
export async function searchFolders(query: string): Promise<DriveFolderEntry[]> {
  const safe = query.replace(/\\/g, '\\\\').replace(/'/g, "\\'").trim();
  if (!safe) return [];

  const drive = await getDriveClient();
  const nameFilter = `name contains '${safe}' and ${FOLDER_FILTER}`;
  const [all, shared] = await Promise.all([
    drive.files.list({
      q: nameFilter,
      fields: 'files(id, name)',
      pageSize: 100,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
      corpora: 'allDrives',
    }),
    drive.files
      .list({ q: `${nameFilter} and sharedWithMe = true`, fields: 'files(id, name)', pageSize: 100 })
      .catch(() => ({ data: { files: [] as { id?: string; name?: string }[] } })),
  ]);

  const map = new Map<string, string>();
  for (const f of all.data.files ?? []) if (f.id && f.name) map.set(f.id, f.name);
  for (const f of shared.data.files ?? []) if (f.id && f.name) map.set(f.id, f.name);
  return sortByName([...map].map(([id, name]) => ({ id, name })));
}

// Map a Google-native mime type to the export format we download it as. Native
// docs (Docs/Sheets/Slides/Drawings) have no direct bytes, so we export to a
// portable format — PDF for everything, keeping the data room self-contained.
const NATIVE_EXPORT: Record<string, { mimeType: string; ext: string }> = {
  'application/vnd.google-apps.document': { mimeType: 'application/pdf', ext: '.pdf' },
  'application/vnd.google-apps.spreadsheet': { mimeType: 'application/pdf', ext: '.pdf' },
  'application/vnd.google-apps.presentation': { mimeType: 'application/pdf', ext: '.pdf' },
  'application/vnd.google-apps.drawing': { mimeType: 'application/pdf', ext: '.pdf' },
};

export interface DownloadedDriveFile {
  buffer: Buffer;
  filename: string; // includes extension
  mimeType: string;
}

// Download a Drive file's bytes. Binary files stream via alt=media; native
// Google docs are exported to PDF. Folders/shortcuts are rejected by the caller.
export async function downloadFile(fileId: string): Promise<DownloadedDriveFile> {
  const drive = await getDriveClient();

  const { data: meta } = await drive.files.get({
    fileId,
    fields: 'id, name, mimeType',
    supportsAllDrives: true,
  });
  const name = meta.name ?? 'file';
  const mimeType = meta.mimeType ?? 'application/octet-stream';

  const nativeExport = NATIVE_EXPORT[mimeType];
  if (nativeExport) {
    const res = await drive.files.export(
      { fileId, mimeType: nativeExport.mimeType },
      { responseType: 'arraybuffer' },
    );
    const filename = name.toLowerCase().endsWith(nativeExport.ext)
      ? name
      : `${name}${nativeExport.ext}`;
    return {
      buffer: Buffer.from(res.data as ArrayBuffer),
      filename,
      mimeType: nativeExport.mimeType,
    };
  }

  const res = await drive.files.get(
    { fileId, alt: 'media', supportsAllDrives: true },
    { responseType: 'arraybuffer' },
  );
  return { buffer: Buffer.from(res.data as ArrayBuffer), filename: name, mimeType };
}
