import { generateWorkspaceLobsterIcon, iconExtensionForContentType } from "./lobster-icon";
import { mutateDb, readDb } from "./store";
import { putObject } from "./storage";

const MAX_ICON_JOB_ATTEMPTS = 3;

let workerRunning = false;

function hasAiIconConfig() {
  return Boolean(process.env.LLM_API_KEY?.trim() || process.env.OPENROUTER_API_KEY?.trim());
}

function iconStorageKey(slug: string, version: string, contentType: string) {
  return `lobsters/${slug}/${version}/icon.${iconExtensionForContentType(contentType)}`;
}

export async function enqueueIconGenerationJob(lobsterVersionId: number) {
  if (!hasAiIconConfig()) return;

  await mutateDb((db) => {
    const existing = db.iconJobs.find(
      (job) => job.lobsterVersionId === lobsterVersionId && (job.status === "pending" || job.status === "running"),
    );
    if (existing) return;

    const now = new Date().toISOString();
    db.iconJobs.push({
      id: db.nextIds.iconJob++,
      lobsterVersionId,
      status: "pending",
      attempts: 0,
      lastError: null,
      createdAt: now,
      updatedAt: now,
      startedAt: null,
      completedAt: null,
    });
  });
}

async function claimNextIconJob() {
  return mutateDb((db) => {
    const nextJob = db.iconJobs
      .filter((job) => job.status === "pending" || (job.status === "failed" && job.attempts < MAX_ICON_JOB_ATTEMPTS))
      .sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt))[0];
    if (!nextJob) return null;
    nextJob.status = "running";
    nextJob.startedAt = new Date().toISOString();
    nextJob.updatedAt = nextJob.startedAt;
    return { id: nextJob.id, lobsterVersionId: nextJob.lobsterVersionId, attempts: nextJob.attempts };
  });
}

async function markJobCompleted(jobId: number, icon: { iconUrl: string; iconSeed: string; iconSpecVersion: string }) {
  await mutateDb((db) => {
    const job = db.iconJobs.find((item) => item.id === jobId);
    if (!job) return;
    const version = db.lobsterVersions.find((item) => item.id === job.lobsterVersionId);
    if (version) {
      version.iconUrl = icon.iconUrl;
      version.iconSeed = icon.iconSeed;
      version.iconSpecVersion = icon.iconSpecVersion;
    }
    job.status = "completed";
    job.lastError = null;
    job.completedAt = new Date().toISOString();
    job.updatedAt = job.completedAt;
  });
}

async function markJobFailed(jobId: number, attempts: number, error: unknown) {
  await mutateDb((db) => {
    const job = db.iconJobs.find((item) => item.id === jobId);
    if (!job) return;
    job.attempts = attempts + 1;
    job.status = job.attempts >= MAX_ICON_JOB_ATTEMPTS ? "failed" : "pending";
    job.lastError = error instanceof Error ? error.message : String(error);
    job.updatedAt = new Date().toISOString();
  });
}

async function processClaimedJob(job: { id: number; lobsterVersionId: number; attempts: number }) {
  const db = await readDb();
  const version = db.lobsterVersions.find((item) => item.id === job.lobsterVersionId);
  if (!version) {
    await markJobFailed(job.id, MAX_ICON_JOB_ATTEMPTS, new Error("Version not found"));
    return;
  }
  const lobster = db.lobsters.find((item) => item.id === version.lobsterId);
  if (!lobster) {
    await markJobFailed(job.id, MAX_ICON_JOB_ATTEMPTS, new Error("Lobster not found"));
    return;
  }

  const icon = await generateWorkspaceLobsterIcon({
    slug: lobster.slug,
    version: version.version,
    tags: lobster.tags,
    sourceType: lobster.sourceType,
    workspacePaths: (version.workspaceFiles ?? []).map((file) => file.path),
    readmeText: version.readmeText,
    summary: lobster.summary,
  });
  const iconContentType = String(icon.contentType);

  const iconUrl = await putObject(
    iconStorageKey(lobster.slug, version.version, iconContentType),
    icon.body,
    iconContentType,
  );

  await markJobCompleted(job.id, {
    iconUrl,
    iconSeed: icon.seed,
    iconSpecVersion: icon.specVersion,
  });
}

export async function kickIconJobWorker() {
  if (workerRunning || !hasAiIconConfig()) return;
  workerRunning = true;

  queueMicrotask(async () => {
    try {
      while (true) {
        const job = await claimNextIconJob();
        if (!job) break;
        try {
          await processClaimedJob(job);
        } catch (error) {
          await markJobFailed(job.id, job.attempts, error);
        }
      }
    } finally {
      workerRunning = false;
    }
  });
}
