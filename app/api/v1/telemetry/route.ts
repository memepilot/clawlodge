import { NextRequest, NextResponse } from "next/server";

import { insertCliTelemetryEvent } from "@/lib/server/store";

type TelemetryPayload = {
  event_type?: string;
  command?: string;
  slug?: string | null;
  duration_ms?: number | null;
  outcome?: string;
  error_class?: string | null;
  used_openclaw?: boolean;
  cli_version?: string;
  os?: string;
  arch?: string;
  installation_id?: string | null;
  event_timestamp?: string;
};

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function asOptionalString(value: unknown) {
  const text = asString(value);
  return text || null;
}

export async function POST(request: NextRequest) {
  let payload: TelemetryPayload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ detail: "Invalid JSON payload" }, { status: 400 });
  }

  const command = asString(payload.command).slice(0, 64);
  if (!command) {
    return NextResponse.json({ detail: "command is required" }, { status: 400 });
  }

  const eventType = asString(payload.event_type) || "command_run";
  if (eventType !== "command_run") {
    return NextResponse.json({ detail: "Unsupported event_type" }, { status: 400 });
  }

  const outcome = asString(payload.outcome) || "success";
  if (outcome !== "success" && outcome !== "error") {
    return NextResponse.json({ detail: "Unsupported outcome" }, { status: 400 });
  }

  const eventTimestamp = asString(payload.event_timestamp) || new Date().toISOString();
  if (Number.isNaN(Date.parse(eventTimestamp))) {
    return NextResponse.json({ detail: "Invalid event_timestamp" }, { status: 400 });
  }

  const durationMs =
    typeof payload.duration_ms === "number" && Number.isFinite(payload.duration_ms) && payload.duration_ms >= 0
      ? Math.round(payload.duration_ms)
      : null;

  await insertCliTelemetryEvent({
    eventTimestamp,
    eventType: "command_run",
    command,
    slug: asOptionalString(payload.slug)?.slice(0, 255) ?? null,
    durationMs,
    outcome,
    errorClass: asOptionalString(payload.error_class)?.slice(0, 255) ?? null,
    usedOpenClaw: Boolean(payload.used_openclaw),
    cliVersion: (asString(payload.cli_version) || "unknown").slice(0, 64),
    os: (asString(payload.os) || "unknown").slice(0, 64),
    arch: (asString(payload.arch) || "unknown").slice(0, 64),
    installationId: asOptionalString(payload.installation_id)?.slice(0, 128) ?? null,
  });

  return NextResponse.json({ ok: true }, { status: 202 });
}
