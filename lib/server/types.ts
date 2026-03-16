export type LobsterCategory =
  | "workspace"
  | "skill"
  | "agent"
  | "tooling"
  | "workflow"
  | "memory";

export type LobsterTopic =
  | "dev"
  | "design"
  | "research"
  | "writing"
  | "productivity"
  | "multiagent"
  | "automation";

export type DbUser = {
  id: number;
  handle: string;
  displayName: string | null;
  avatarUrl: string | null;
  bio: string | null;
  email: string | null;
  githubId: string | null;
  favoriteSlugs: string[];
  createdAt: string;
  updatedAt: string;
};

export type DbSession = {
  id: number;
  userId: number;
  tokenHash: string;
  expiresAt: string;
  createdAt: string;
};

export type DbApiToken = {
  id: number;
  userId: number;
  tokenHash: string;
  tokenPrefix: string;
  revoked: boolean;
  createdAt: string;
  revokedAt: string | null;
  lastUsedAt: string | null;
};

export type DbHireProfile = {
  id: number;
  userId: number;
  status: "open" | "closed";
  contactType: string | null;
  contactValue: string | null;
  timezone: string | null;
  responseSlaHours: number | null;
  createdAt: string;
  updatedAt: string;
};

export type DbLobster = {
  id: number;
  slug: string;
  ownerId: number;
  name: string;
  summary: string;
  category: LobsterCategory | null;
  topics: LobsterTopic[];
  license: string;
  sourceType: "official" | "curated" | "community" | "demo";
  sourceUrl: string | null;
  originalAuthor: string | null;
  verified: boolean;
  curationNote: string | null;
  seededAt: string | null;
  status: "active" | "hidden";
  reportPenalty: number;
  searchDocument: string;
  tags: string[];
  recommendationScore: number | null;
  githubStars: number | null;
  favoriteCount: number;
  viewCount: number;
  downloadCount: number;
  shareCount: number;
  commentCount: number;
  createdAt: string;
  updatedAt: string;
};

export type DbSkill = {
  skillId: string;
  name: string;
  entry: string;
  path: string;
  digest: string | null;
  size: number | null;
};

export type DbWorkspaceFile = {
  path: string;
  size: number;
  kind: "text" | "binary";
  contentExcerpt: string | null;
  contentText: string | null;
  contentType: string | null;
  storageUrl: string | null;
  maskedCount: number;
};

export type DbLobsterVersion = {
  id: number;
  lobsterId: number;
  createdBy: number;
  version: string;
  changelog: string;
  readmeText: string;
  manifestUrl: string;
  readmeUrl: string;
  skillsBundleUrl: string | null;
  iconUrl: string | null;
  iconSeed: string | null;
  iconSpecVersion: string | null;
  sourceRepo: string | null;
  sourceCommit: string | null;
  workspaceFiles?: DbWorkspaceFile[];
  publishClient: string | null;
  maskedSecretsCount: number;
  blockedFilesCount: number;
  skills: DbSkill[];
  createdAt: string;
};

export type DbComment = {
  id: number;
  userId: number;
  lobsterId: number;
  content: string;
  createdAt: string;
};

export type DbReport = {
  id: number;
  lobsterId: number;
  reporterId: number;
  reason: string;
  status: "open" | "resolved" | "rejected";
  handledBy: number | null;
  handledAt: string | null;
  createdAt: string;
};

export type DbIconJob = {
  id: number;
  lobsterVersionId: number;
  status: "pending" | "running" | "completed" | "failed";
  attempts: number;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  completedAt: string | null;
};

export type DbLegacyNextIds = {
  user: number;
  session: number;
  apiToken: number;
  hireProfile: number;
  lobster: number;
  lobsterVersion: number;
  comment: number;
  report: number;
  iconJob: number;
};

export type DbState = {
  // Legacy JSON payloads may still carry this field, but PostgreSQL sequences are the source of truth.
  nextIds?: Partial<DbLegacyNextIds>;
  users: DbUser[];
  sessions: DbSession[];
  apiTokens: DbApiToken[];
  hireProfiles: DbHireProfile[];
  lobsters: DbLobster[];
  lobsterVersions: DbLobsterVersion[];
  comments: DbComment[];
  reports: DbReport[];
  iconJobs: DbIconJob[];
};
