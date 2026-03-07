import crypto from "node:crypto";
import path from "node:path";

export const semverRe = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
export const allowedLicenses = ["MIT", "Apache-2.0", "CC-BY-4.0", "BSD-3-Clause", "GPL-3.0-only"] as const;

export function slugify(input: string): string {
  const slug = input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "lobster";
}

export function recencyDecay(createdAt: Date, now = new Date()): number {
  const ageHours = Math.max((now.getTime() - createdAt.getTime()) / 3600000, 0);
  return Math.max(0, 5 - ageHours / 24);
}

export function computeHotScore(
  favorites: number,
  comments: number,
  createdAt: Date,
  reportPenalty = 0,
): number {
  const score = 1.0 * favorites + 0.7 * comments + recencyDecay(createdAt) - reportPenalty;
  return Math.round(score * 10000) / 10000;
}

export function sha256(input: string | Buffer) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

export function generatePat() {
  return `claw_pat_${crypto.randomBytes(30).toString("base64url")}`;
}

export function tokenPrefix(token: string) {
  return token.slice(0, 20);
}

export function generateSessionToken() {
  return crypto.randomBytes(30).toString("base64url");
}

export function sanitizeText(input: string) {
  return input.replace(/<[^>]+>/g, "").trim();
}

export function isSafeRelativePath(p: string) {
  if (path.isAbsolute(p)) return false;
  const normalized = path.posix.normalize(p);
  return !normalized.startsWith("../") && normalized !== "..";
}
