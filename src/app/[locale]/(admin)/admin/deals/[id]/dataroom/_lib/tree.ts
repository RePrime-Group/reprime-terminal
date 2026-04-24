import type { TerminalDDFolder, TerminalDDDocument, DataRoomFolderNode } from '@/lib/types/database';

// Build a hierarchical tree from flat folder/document arrays.
// Orphans (folders whose parent_id is not in the folder list) surface at root
// so they're still visible to the admin instead of silently vanishing.
export function buildTree(
  folders: TerminalDDFolder[],
  documents: TerminalDDDocument[],
): DataRoomFolderNode[] {
  const nodeMap = new Map<string, DataRoomFolderNode>();
  for (const f of folders) {
    nodeMap.set(f.id, { ...f, children: [], documents: [] });
  }

  const docsByFolder = new Map<string, TerminalDDDocument[]>();
  for (const doc of documents) {
    const list = docsByFolder.get(doc.folder_id) ?? [];
    list.push(doc);
    docsByFolder.set(doc.folder_id, list);
  }

  for (const node of nodeMap.values()) {
    const docs = docsByFolder.get(node.id) ?? [];
    docs.sort((a, b) => a.sort_order - b.sort_order);
    node.documents = docs;
  }

  const roots: DataRoomFolderNode[] = [];
  for (const node of nodeMap.values()) {
    if (node.parent_id && nodeMap.has(node.parent_id)) {
      nodeMap.get(node.parent_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  const sortChildren = (node: DataRoomFolderNode) => {
    node.children.sort((a, b) => a.display_order - b.display_order);
    node.children.forEach(sortChildren);
  };
  roots.sort((a, b) => a.display_order - b.display_order);
  roots.forEach(sortChildren);

  return roots;
}

// Recursively count documents with a storage_path across a subtree.
// Used for investor-facing counts (placeholders hidden) and "empty folder" detection.
export function countUploadedDocs(node: DataRoomFolderNode): number {
  let total = node.documents.filter((d) => !!d.storage_path).length;
  for (const child of node.children) total += countUploadedDocs(child);
  return total;
}

// Total document count in a subtree (including placeholders) — used for admin view.
export function countAllDocs(node: DataRoomFolderNode): number {
  let total = node.documents.length;
  for (const child of node.children) total += countAllDocs(child);
  return total;
}

// Collect every folder id in a subtree (including the root).
export function collectFolderIds(node: DataRoomFolderNode): string[] {
  const ids = [node.id];
  for (const child of node.children) ids.push(...collectFolderIds(child));
  return ids;
}

// Collect every document in a subtree.
export function collectDocuments(node: DataRoomFolderNode): TerminalDDDocument[] {
  const docs = [...node.documents];
  for (const child of node.children) docs.push(...collectDocuments(child));
  return docs;
}

// Circular-nesting guard. Returns true if moving `dragId` under `targetId`
// would create a cycle (i.e. targetId is a descendant of dragId, or ===).
export function wouldCreateCircle(
  dragId: string,
  targetId: string,
  folders: Pick<TerminalDDFolder, 'id' | 'parent_id'>[],
): boolean {
  if (dragId === targetId) return true;
  const byId = new Map(folders.map((f) => [f.id, f]));
  let cursor: string | null | undefined = targetId;
  const seen = new Set<string>();
  while (cursor) {
    if (cursor === dragId) return true;
    if (seen.has(cursor)) return false;
    seen.add(cursor);
    cursor = byId.get(cursor)?.parent_id;
  }
  return false;
}

// Find a node by id anywhere in the tree.
export function findNode(
  tree: DataRoomFolderNode[],
  id: string,
): DataRoomFolderNode | null {
  for (const node of tree) {
    if (node.id === id) return node;
    const inside = findNode(node.children, id);
    if (inside) return inside;
  }
  return null;
}

// Build the breadcrumb path (root → ... → node) for display in search results.
export function findPath(
  tree: DataRoomFolderNode[],
  id: string,
): DataRoomFolderNode[] {
  for (const node of tree) {
    if (node.id === id) return [node];
    const inside = findPath(node.children, id);
    if (inside.length > 0) return [node, ...inside];
  }
  return [];
}

// Flatten folders for lookup (useful when wouldCreateCircle expects the flat list).
export function flattenFolders(tree: DataRoomFolderNode[]): DataRoomFolderNode[] {
  const out: DataRoomFolderNode[] = [];
  const walk = (nodes: DataRoomFolderNode[]) => {
    for (const node of nodes) {
      out.push(node);
      walk(node.children);
    }
  };
  walk(tree);
  return out;
}
