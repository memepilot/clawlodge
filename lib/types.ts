export type LobsterSummary = {
  slug: string;
  name: string;
  summary: string;
  license: string;
  source_type?: "official" | "curated" | "community" | "demo";
  source_url?: string | null;
  original_author?: string | null;
  verified?: boolean;
  curation_note?: string | null;
  seeded_at?: string | null;
  owner_handle: string;
  owner_display_name?: string | null;
  tags: string[];
  latest_version?: string | null;
  favorite_count: number;
  share_count: number;
  comment_count: number;
  hot_score: number;
  status: string;
  created_at: string;
};

export type LobsterVersion = {
  version: string;
  changelog: string;
  readme_text: string;
  manifest_url: string;
  readme_url: string;
  skills_bundle_url?: string | null;
  source_repo?: string | null;
  source_commit?: string | null;
  publish_client?: string | null;
  masked_secrets_count?: number;
  blocked_files_count?: number;
  created_at: string;
  workspace_files?: Array<{
    path: string;
    size: number;
    kind: "text" | "binary";
    content_excerpt?: string | null;
    content_text?: string | null;
    masked_count?: number;
  }>;
  skills: Array<{
    skill_id: string;
    name: string;
    entry: string;
    path: string;
    digest?: string | null;
    size?: number | null;
  }>;
};

export type LobsterDetail = LobsterSummary & {
  search_document: string;
  versions: LobsterVersion[];
};

export type CommentItem = {
  id: number;
  lobster_slug: string;
  user_handle: string;
  user_display_name?: string | null;
  content: string;
  created_at: string;
};

export type UserProfile = {
  user: {
    id: number;
    handle: string;
    display_name?: string | null;
    avatar_url?: string | null;
    bio?: string | null;
  };
  hire_profile?: {
    status: string;
    contact_type?: string | null;
    contact_value?: string | null;
    timezone?: string | null;
    response_sla_hours?: number | null;
  } | null;
  published: LobsterSummary[];
  favorites: LobsterSummary[];
};

export type MeProfile = {
  user: {
    id: number;
    handle: string;
    display_name?: string | null;
    avatar_url?: string | null;
    bio?: string | null;
  };
  hire_profile?: {
    status: string;
    contact_type?: string | null;
    contact_value?: string | null;
    timezone?: string | null;
    response_sla_hours?: number | null;
  } | null;
  active_token_prefix?: string | null;
  active_token_last_used_at?: string | null;
};

export type SeedRecord = {
  slug: string;
  source_type: "official" | "curated" | "community" | "demo";
  source_url?: string | null;
  original_author?: string | null;
  verified: boolean;
  curation_note?: string | null;
  seeded_at?: string | null;
};
