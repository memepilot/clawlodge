import { allowedLicenses, isSafeRelativePath, semverRe, sha256 } from "./utils";

type ParsedSkill = {
  id: string;
  name: string;
  entry: string;
  path: string;
  digest?: string;
  size?: number;
};

export type ParsedManifest = {
  schema_version: "1.0";
  lobster_slug: string;
  version: string;
  name: string;
  summary: string;
  license: (typeof allowedLicenses)[number];
  readme_path: string;
  skills: ParsedSkill[];
  settings: Array<{ key: string; value: unknown }>;
  source?: {
    repo_url?: string;
    commit?: string;
  };
};

function expectString(value: unknown, name: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${name} must be a non-empty string`);
  }
  return value;
}

function expectOptionalString(value: unknown, name: string) {
  if (value == null) return undefined;
  if (typeof value !== "string") throw new Error(`${name} must be a string`);
  return value;
}

function parseSkill(value: unknown): ParsedSkill {
  if (!value || typeof value !== "object") throw new Error("skill must be an object");
  const skill = value as Record<string, unknown>;
  const parsed: ParsedSkill = {
    id: expectString(skill.id, "skill.id"),
    name: expectString(skill.name, "skill.name"),
    entry: expectString(skill.entry, "skill.entry"),
    path: expectString(skill.path, "skill.path"),
  };
  if (skill.digest != null) {
    if (typeof skill.digest !== "string" || !/^[A-Fa-f0-9]{64}$/.test(skill.digest)) {
      throw new Error(`invalid digest for skill ${parsed.id}`);
    }
    parsed.digest = skill.digest;
  }
  if (skill.size != null) {
    if (typeof skill.size !== "number" || !Number.isInteger(skill.size) || skill.size < 0) {
      throw new Error(`invalid size for skill ${parsed.id}`);
    }
    parsed.size = skill.size;
  }
  if (!isSafeRelativePath(parsed.path) || !isSafeRelativePath(parsed.entry)) {
    throw new Error(`unsafe skill path/entry for skill ${parsed.id}`);
  }
  return parsed;
}

export function parseAndValidateManifest(raw: Buffer): ParsedManifest {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.toString("utf8"));
  } catch {
    throw new Error("manifest.json must be valid UTF-8 JSON");
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error("manifest.json must be an object");
  }

  const obj = parsed as Record<string, unknown>;
  const schemaVersion = expectString(obj.schema_version, "schema_version");
  if (schemaVersion !== "1.0") throw new Error("schema_version must be 1.0");

  const version = expectString(obj.version, "version");
  if (!semverRe.test(version)) throw new Error("version must be valid semver");

  const license = expectString(obj.license, "license");
  if (!allowedLicenses.includes(license as (typeof allowedLicenses)[number])) {
    throw new Error("license is not allowed");
  }

  const readmePath = expectString(obj.readme_path, "readme_path");
  if (!isSafeRelativePath(readmePath)) {
    throw new Error("readme_path must be a safe relative path");
  }

  const rawSkills = obj.skills;
  if (!Array.isArray(rawSkills)) throw new Error("skills must be an array");
  const skills = rawSkills.map(parseSkill);

  const rawSettings = obj.settings;
  const settings = Array.isArray(rawSettings)
    ? rawSettings.map((item) => {
        if (!item || typeof item !== "object") throw new Error("setting must be an object");
        const setting = item as Record<string, unknown>;
        return { key: expectString(setting.key, "setting.key"), value: setting.value };
      })
    : [];

  const source =
    obj.source && typeof obj.source === "object"
      ? {
          repo_url: expectOptionalString((obj.source as Record<string, unknown>).repo_url, "source.repo_url"),
          commit: expectOptionalString((obj.source as Record<string, unknown>).commit, "source.commit"),
        }
      : undefined;

  return {
    schema_version: "1.0",
    lobster_slug: expectString(obj.lobster_slug, "lobster_slug"),
    version,
    name: expectString(obj.name, "name"),
    summary: expectString(obj.summary, "summary"),
    license: license as (typeof allowedLicenses)[number],
    readme_path: readmePath,
    skills,
    settings,
    source,
  };
}

export function verifySkillDigest(content: Buffer, digest?: string) {
  if (!digest) return true;
  return sha256(content).toLowerCase() === digest.toLowerCase();
}
