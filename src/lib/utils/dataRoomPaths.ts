export interface FolderRow {
  id: string;
  name: string;
  parent_id: string | null;
}

export function sanitizePathSegment(name: string): string {
  return name.replace(/[\\/:*?"<>|]+/g, '_').trim() || 'Untitled';
}

export function buildFolderPath(folderId: string, folders: Map<string, FolderRow>): string {
  const parts: string[] = [];
  let cursor: string | null = folderId;
  const seen = new Set<string>();
  while (cursor && !seen.has(cursor)) {
    seen.add(cursor);
    const f = folders.get(cursor);
    if (!f) break;
    parts.unshift(sanitizePathSegment(f.name));
    cursor = f.parent_id;
  }
  return parts.join('/');
}

export function dedupePath(path: string, used: Set<string>): string {
  if (!used.has(path)) {
    used.add(path);
    return path;
  }
  const slash = path.lastIndexOf('/');
  const dir = slash >= 0 ? path.slice(0, slash) : '';
  const file = slash >= 0 ? path.slice(slash + 1) : path;
  const dot = file.lastIndexOf('.');
  const base = dot > 0 ? file.slice(0, dot) : file;
  const ext = dot > 0 ? file.slice(dot) : '';
  let n = 1;
  let candidate = `${dir ? `${dir}/` : ''}${base} (${n})${ext}`;
  while (used.has(candidate)) {
    n += 1;
    candidate = `${dir ? `${dir}/` : ''}${base} (${n})${ext}`;
  }
  used.add(candidate);
  return candidate;
}
