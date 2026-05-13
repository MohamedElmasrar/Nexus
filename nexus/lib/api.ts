/**
 * Nexus API client — ownCloud-native typed HTTP layer.
 *
 * All admin pages and user-facing components should import from here
 * rather than making raw fetch calls.
 */

// ── Configuration ────────────────────────────────────────────────────────────

export const NEXUS_TOKEN_COOKIE = "nexus_token";

export function getApiBaseUrl(): string {
  if (typeof window === "undefined") {
    return (
      process.env.API_URL ||
      process.env.NEXT_PUBLIC_API_URL ||
      "http://localhost:8000"
    );
  }
  return process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
}

// ── Types ────────────────────────────────────────────────────────────────────

export interface User {
  username: string;
  display_name: string;
  email: string;
  role: "admin" | "user";
  groups: string[];
  is_admin?: boolean;
}

export interface OwnCloudGroup {
  id: string;
  name: string;
  members?: string[];
}

export interface OwnCloudFile {
  name: string;
  path: string;
  is_directory: boolean;
  size: number;
  content_type: string;
  last_modified: string;
}

export interface OwnCloudShare {
  id: number;
  share_type: number;
  share_with: string | null;
  share_with_displayname: string | null;
  path: string;
  permissions: number;
  uid_owner: string;
  file_target?: string | null;
}

// ── Fetch helpers ────────────────────────────────────────────────────────────

/**
 * Client-side fetch wrapper — goes through the Next.js /api/nexus proxy.
 */
export async function nexusFetch<T = unknown>(
  path: string,
  init: RequestInit = {},
): Promise<{ ok: boolean; status: number; data: T }> {
  const url = `/api/nexus?path=${encodeURIComponent(path)}`;

  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init.headers,
    },
    cache: "no-store",
  });

  if (res.status === 401 && typeof window !== "undefined") {
    window.dispatchEvent(new Event("nexus-auth-expired"));
  }

  const data = res.ok ? await res.json() : await res.json().catch(() => null);
  return { ok: res.ok, status: res.status, data: data as T };
}

/**
 * Client-side blob fetch — for file downloads.
 */
export async function nexusFetchBlob(
  path: string,
  options: RequestInit = {}
): Promise<{ ok: boolean; data?: Blob; status: number; error?: string }> {
  try {
    const url = `/api/nexus?path=${encodeURIComponent(path)}`;
    const res = await fetch(url, { ...options });
    
    if (res.status === 401 && typeof window !== "undefined") {
      window.dispatchEvent(new Event("nexus-auth-expired"));
    }

    if (!res.ok) {
      const isJson = res.headers.get("content-type")?.includes("application/json");
      const errPayload = isJson ? await res.json().catch(() => ({})) : {};
      return {
        ok: false,
        status: res.status,
        error: errPayload.detail || errPayload.error || "Request failed",
      };
    }
    const blob = await res.blob();
    return { ok: true, data: blob, status: res.status };
  } catch (err: any) {
    return { ok: false, status: 0, error: err.message };
  }
}

/**
 * Server-side fetch — used by Next.js API route handlers.
 */
export async function nexusServerFetch(
  path: string,
  token: string,
  init: RequestInit = {},
): Promise<Response> {
  const base = getApiBaseUrl();
  const url = `${base}${path}`;

  return fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...init.headers,
    },
    cache: "no-store",
  });
}

// ── API Methods ──────────────────────────────────────────────────────────────

export const api = {
  // Auth
  login: (username: string, password: string) =>
    fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    }),

  session: () => fetch("/api/auth/session", { cache: "no-store" }),

  logout: () => fetch("/api/auth/logout", { method: "POST" }),

  // ── Current User ────────────────────────────────────────────────────────
  getMe: () => nexusFetch<User>("/api/v1/users/me/"),
  getMyGroups: () => nexusFetch<OwnCloudGroup[]>("/api/v1/users/me/groups"),
  browseMyFiles: (path: string = "/") =>
    nexusFetch<OwnCloudFile[]>(`/api/v1/users/me/files?path=${encodeURIComponent(path)}`),
  downloadMyFile: (path: string) =>
    nexusFetchBlob(`/api/v1/users/me/files/download?path=${encodeURIComponent(path)}`),
  deleteMyFile: (path: string) =>
    nexusFetch(`/api/v1/users/me/files?path=${encodeURIComponent(path)}`, {
      method: "DELETE",
    }),
  createMyFolder: (path: string) =>
    nexusFetch("/api/v1/users/me/files/folder", {
      method: "POST",
      body: JSON.stringify({ path }),
    }),

  // ── Admin: Users ────────────────────────────────────────────────────────
  getUsers: () => nexusFetch<User[]>("/api/v1/admin/users/"),
  getUser: (username: string) => nexusFetch<User>(`/api/v1/admin/users/${username}`),

  // ── Admin: Groups ───────────────────────────────────────────────────────
  getGroups: () => nexusFetch<OwnCloudGroup[]>("/api/v1/admin/groups/"),
  getGroup: (groupId: string) =>
    nexusFetch<OwnCloudGroup & { members: string[] }>(`/api/v1/admin/groups/${encodeURIComponent(groupId)}`),
  createGroup: (groupId: string) =>
    nexusFetch<OwnCloudGroup>("/api/v1/admin/groups/", {
      method: "POST",
      body: JSON.stringify({ group_id: groupId }),
    }),
  deleteGroup: (groupId: string) =>
    nexusFetch(`/api/v1/admin/groups/${encodeURIComponent(groupId)}`, {
      method: "DELETE",
    }),
  addUserToGroup: (groupId: string, username: string) =>
    nexusFetch(`/api/v1/admin/groups/${encodeURIComponent(groupId)}/users/${encodeURIComponent(username)}`, {
      method: "POST",
    }),
  removeUserFromGroup: (groupId: string, username: string) =>
    nexusFetch(`/api/v1/admin/groups/${encodeURIComponent(groupId)}/users/${encodeURIComponent(username)}`, {
      method: "DELETE",
    }),

  // ── Admin: Files ────────────────────────────────────────────────────────
  adminBrowseFiles: (path: string = "/") =>
    nexusFetch<OwnCloudFile[]>(`/api/v1/admin/files/browse?path=${encodeURIComponent(path)}`),
  adminDownloadFile: (path: string) =>
    nexusFetchBlob(`/api/v1/admin/files/download?path=${encodeURIComponent(path)}`),
  adminDeleteFile: (path: string) =>
    nexusFetch(`/api/v1/admin/files/?path=${encodeURIComponent(path)}`, {
      method: "DELETE",
    }),
  adminCreateFolder: (path: string) =>
    nexusFetch("/api/v1/admin/files/folder", {
      method: "POST",
      body: JSON.stringify({ path }),
    }),

  // ── Admin: Sharing ──────────────────────────────────────────────────────
  adminGetShares: (path: string = "") =>
    nexusFetch<OwnCloudShare[]>(`/api/v1/admin/files/shares?path=${encodeURIComponent(path)}`),
  adminCreateShare: (path: string, shareType: number, shareWith: string, permissions: number = 1) =>
    nexusFetch<OwnCloudShare>("/api/v1/admin/files/share", {
      method: "POST",
      body: JSON.stringify({
        path,
        share_type: shareType,
        share_with: shareWith,
        permissions,
      }),
    }),
  adminDeleteShare: (shareId: number) =>
    nexusFetch(`/api/v1/admin/files/share/${shareId}`, {
      method: "DELETE",
    }),

  // ── Admin: Sync Status ──────────────────────────────────────────────────
  getSyncStatus: (path: string) =>
    nexusFetch<{ file_path: string; status: string; synced_at: string | null }>(
      `/api/v1/admin/files/sync-status?path=${encodeURIComponent(path)}`
    ),
  setSyncStatus: (path: string, status: string = "pending") =>
    nexusFetch(
      `/api/v1/admin/files/sync-status?path=${encodeURIComponent(path)}&status=${encodeURIComponent(status)}`,
      { method: "POST" }
    ),

  // ── Admin: AI Indexing ──────────────────────────────────────────────────
  indexFile: (filePath: string) =>
    nexusFetch<{ file_path: string; status: string; chunks: number }>(
      "/api/v1/ai/index",
      { method: "POST", body: JSON.stringify({ file_path: filePath }) }
    ),
  indexAllFiles: (basePath: string = "/") =>
    nexusFetch<{ total: number; synced: number; errors: number; results: unknown[] }>(
      "/api/v1/ai/index-all",
      { method: "POST", body: JSON.stringify({ base_path: basePath }) }
    ),
  getIndexedFiles: () =>
    nexusFetch<{ total_files: number; files: { file_path: string; chunk_count: number }[] }>(
      "/api/v1/ai/index"
    ),
  removeFromIndex: (filePath: string) =>
    nexusFetch<{ file_path: string; chunks_removed: number }>(
      `/api/v1/ai/index?file_path=${encodeURIComponent(filePath)}`,
      { method: "DELETE" }
    ),

  // ── Chat / Conversations ────────────────────────────────────────────────
  listConversations: () =>
    nexusFetch<ChatConversation[]>("/api/v1/chat/conversations"),
  createConversation: (title: string = "New conversation") =>
    nexusFetch<ChatConversation>("/api/v1/chat/conversations", {
      method: "POST",
      body: JSON.stringify({ title }),
    }),
  getConversation: (id: number) =>
    nexusFetch<ChatConversationDetail>(`/api/v1/chat/conversations/${id}`),
  deleteConversation: (id: number) =>
    nexusFetch(`/api/v1/chat/conversations/${id}`, { method: "DELETE" }),
  updateConversationTitle: (id: number, title: string) =>
    nexusFetch<ChatConversation>(`/api/v1/chat/conversations/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ title }),
    }),
  askQuestion: (conversationId: number, message: string) =>
    nexusFetch<ChatAskResponse>(`/api/v1/chat/conversations/${conversationId}/ask`, {
      method: "POST",
      body: JSON.stringify({ message }),
    }),
};

// ── Chat Types ──────────────────────────────────────────────────────────────

export interface ChatSource {
  file_path: string;
  snippet: string;
}

export interface ChatMessage {
  id: number;
  role: "user" | "assistant";
  content: string;
  sources?: ChatSource[] | null;
  created_at: string;
}

export interface ChatConversation {
  id: number;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface ChatConversationDetail extends ChatConversation {
  messages: ChatMessage[];
}

export interface ChatAskResponse {
  answer: string;
  sources: ChatSource[];
  message_id: number;
  conversation_id: number;
}
