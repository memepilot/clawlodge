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

export function getDisplayLobsterName(
  lobster: Pick<LobsterSummary, "name" | "original_author" | "source_url" | "owner_handle">,
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
