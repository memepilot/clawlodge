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
  license: string;
  sourceType: "official" | "curated" | "community" | "demo";
  sourceUrl: string | null;
  originalAuthor: string | null;
  verified: boolean;
  curationNote: string | null;
  seededAt: string | null;
  isHireable: boolean;
  status: "active" | "hidden";
  reportPenalty: number;
  searchDocument: string;
  tags: string[];
  favoriteCount: number;
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
  sourceRepo: string | null;
  sourceCommit: string | null;
  workspaceFiles: DbWorkspaceFile[];
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

export type DbState = {
  nextIds: {
    user: number;
    session: number;
    apiToken: number;
    hireProfile: number;
    lobster: number;
    lobsterVersion: number;
    comment: number;
    report: number;
  };
  users: DbUser[];
  sessions: DbSession[];
  apiTokens: DbApiToken[];
  hireProfiles: DbHireProfile[];
  lobsters: DbLobster[];
  lobsterVersions: DbLobsterVersion[];
  comments: DbComment[];
  reports: DbReport[];
};
