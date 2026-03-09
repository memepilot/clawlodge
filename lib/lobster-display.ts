import type { LobsterDetail, LobsterSummary } from "@/lib/types";

function parseGithubOwner(url?: string | null) {
  if (!url) return null;
  const match = url.match(/github\.com\/([^/]+)\/[^/]+/i);
  return match?.[1] ?? null;
}

function stripLeadingOwner(name: string, owner: string | null | undefined) {
  const prefix = owner?.trim();
  if (!prefix) return name;
  const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return name.replace(new RegExp(`^${escaped}\\s+`, "i"), "").trim();
}

function escapeForRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function getDisplayLobsterName(
  lobster: Pick<LobsterSummary, "name" | "original_author" | "source_url">,
  latestSourceRepo?: string | null,
) {
  const candidates = [
    lobster.original_author,
    parseGithubOwner(lobster.source_url),
    parseGithubOwner(latestSourceRepo),
  ].filter(Boolean) as string[];

  let next = lobster.name;
  for (const candidate of candidates) {
    next = stripLeadingOwner(next, candidate);
  }

  return next || lobster.name;
}

export function getDetailDisplayLobsterName(lobster: LobsterDetail) {
  return getDisplayLobsterName(lobster, lobster.versions[0]?.source_repo);
}

export function getDisplaySummary(
  lobster: Pick<LobsterSummary, "name" | "summary" | "original_author" | "source_url">,
  latestSourceRepo?: string | null,
) {
  const displayName = getDisplayLobsterName(lobster, latestSourceRepo);
  const originalName = lobster.name.trim();
  const summary = lobster.summary.trim();
  if (!summary) return summary;
  if (!originalName || originalName === displayName) return summary;

  const originalEscaped = escapeForRegex(originalName);
  const replaced = summary.replace(new RegExp(`^${originalEscaped}(?=\\s|[,:;.!?-])`, "i"), displayName).trim();
  return replaced || summary;
}

export function getDisplayAuthor(
  lobster: Pick<LobsterSummary, "original_author" | "source_url" | "owner_handle" | "owner_display_name">,
  latestSourceRepo?: string | null,
) {
  const sourceAuthor =
    lobster.original_author ||
    parseGithubOwner(lobster.source_url) ||
    parseGithubOwner(latestSourceRepo);

  if (sourceAuthor) {
    return {
      label: `@${sourceAuthor}`,
      href: null,
    };
  }

  return {
    label: lobster.owner_display_name || `@${lobster.owner_handle}`,
    href: `/u/${lobster.owner_handle}`,
    suffix: lobster.owner_display_name ? ` (@${lobster.owner_handle})` : "",
  };
}
