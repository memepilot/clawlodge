import { CommentItem, LobsterDetail, LobsterSummary, MeProfile, SeedRecord, UserProfile } from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api/v1";
const API_ORIGIN = process.env.NEXT_PUBLIC_API_ORIGIN ?? "";

export const apiOrigin = API_ORIGIN;

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    credentials: "include",
    cache: "no-store",
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || `Request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export async function getLobsters(params?: { sort?: string; tag?: string; q?: string }) {
  const search = new URLSearchParams();
  if (params?.sort) search.set("sort", params.sort);
  if (params?.tag) search.set("tag", params.tag);
  if (params?.q) search.set("q", params.q);
  const query = search.toString();
  return request<{ items: LobsterSummary[]; total: number }>(`/lobsters${query ? `?${query}` : ""}`);
}

export function getLobster(slug: string) {
  return request<LobsterDetail>(`/lobsters/${slug}`);
}

export function getComments(slug: string) {
  return request<CommentItem[]>(`/lobsters/${slug}/comments`);
}

export function addFavorite(slug: string) {
  return request(`/lobsters/${slug}/favorite`, { method: "POST" });
}

export function removeFavorite(slug: string) {
  return request(`/lobsters/${slug}/favorite`, { method: "DELETE" });
}

export function addComment(slug: string, content: string) {
  return request<CommentItem>(`/lobsters/${slug}/comments`, {
    method: "POST",
    body: JSON.stringify({ content }),
  });
}

export function reportLobster(slug: string, reason: string) {
  return request<{ message: string }>(`/lobsters/${slug}/report`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

export function createLobster(payload: {
  name: string;
  summary: string;
  license: string;
  tags: string[];
  is_hireable: boolean;
}) {
  return request<LobsterDetail>("/lobsters", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function createVersion(
  slug: string,
  payload: {
    version: string;
    changelog: string;
    readme_markdown: string;
    source_repo?: string;
    source_commit?: string;
    workspace_files?: Array<{ path: string; size: number; kind: "text" | "binary"; content_excerpt?: string | null }>;
    skills: Array<{ id: string; name: string; entry: string; path: string }>;
    settings: Array<{ key: string; value: unknown }>;
  },
) {
  return request(`/lobsters/${slug}/versions`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getUserProfile(handle: string) {
  return request<UserProfile>(`/users/${handle}`);
}

export function getMe() {
  return request<MeProfile>("/me");
}

export function rotateToken() {
  return request<{ token: string; token_prefix: string; created_at: string }>("/me/token/rotate", { method: "POST" });
}

export function updateHireProfile(payload: {
  status: "open" | "closed";
  contact_type?: string;
  contact_value?: string;
  timezone?: string;
  response_sla_hours?: number;
}) {
  return request("/me/hire-profile", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function logout() {
  return request<{ ok: true }>("/auth/logout", { method: "POST" });
}

export function getSeeds() {
  return request<SeedRecord[]>("/admin/seeds");
}

export function saveSeed(payload: {
  slug: string;
  source_type: "official" | "curated" | "community" | "demo";
  source_url?: string;
  original_author?: string;
  verified?: boolean;
  curation_note?: string;
  seeded?: boolean;
}) {
  return request<SeedRecord>("/admin/seeds", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
