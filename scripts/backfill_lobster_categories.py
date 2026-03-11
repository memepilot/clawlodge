#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import sqlite3
from collections import Counter
from pathlib import Path


def normalize(value: str | None) -> str:
    return (value or "").lower()


def includes_any(haystack: str, needles: list[str]) -> bool:
    return any(needle in haystack for needle in needles)


def is_workspace_like(haystack: str, tags: list[str]) -> bool:
    return (
        "workspace" in tags
        or "starter" in tags
        or "template" in tags
        or "config" in tags
        or includes_any(
            haystack,
            [
                "starter",
                "starter kit",
                "starter pack",
                "openclaw-config",
                "openclaw config",
                "openclaw workspace",
                "workspace add-on",
                "workspace addon",
                "workspace template",
                "workspace backup",
                "project template",
                "scaffolding template",
                "subagents workspace",
                "subagents workspaces",
                "private deployment",
                "self-hosted ai assistant",
                "社区版",
                "中文社区版",
                "完整中文本地化",
            ],
        )
    )


def classify(item: dict) -> str:
    slug = normalize(item.get("slug"))
    name = normalize(item.get("name"))
    summary = normalize(item.get("summary"))
    source = normalize(item.get("sourceUrl") or item.get("sourceRepo"))
    tags = [normalize(tag) for tag in item.get("tags", [])]
    combined = " ".join(part for part in [slug, name, summary, source, " ".join(tags)] if part)
    workspace_like = is_workspace_like(combined, tags)

    if includes_any(combined, ["memory management", "memory-manager", "memory-management"]):
        return "memory"

    if includes_any(
        combined,
        [
            "memory system",
            "memory engine",
            "memory architecture",
        ],
    ) and not workspace_like:
        return "memory"

    if ("workflow" in tags or includes_any(
        combined,
        [
            "workflow",
            "orchestration",
            "research ops",
            "multi agent",
            "multi-agent",
            "approval flow",
            "dispatch architecture",
            "kanban",
        ],
    )) and not workspace_like:
        return "workflow"

    if includes_any(
        combined,
        [
            "console",
            "studio",
            "docker",
            "plugins",
            "plugin",
            "control panel",
            "deployment",
            "monitoring",
            "manager",
            "blueprint",
            "mcp upload",
            "tooling",
            "cli",
            "terminal ui",
        ],
    ) and not workspace_like:
        return "tooling"

    if includes_any(
        combined,
        [
            "skill",
            "skills",
            "-skill",
            " skill ",
            "skills kit",
            "openclaw skill",
            "thumbnail designer",
            "youtube thumbnail",
            "photo bank",
            "logo bank",
        ],
    ) and not workspace_like and not includes_any(combined, ["studio", "console", "plugin", "plugins", "docker"]):
        return "skill"

    if includes_any(
        combined,
        [
            "agent persona",
            "sub-agent",
            "subagent",
            "designer agent",
            "researcher agent",
            "reviewer agent",
            "assistant persona",
        ],
    ) and not workspace_like:
        return "agent"

    return "workspace"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Backfill lobster category in app_state + lobsters_mirror.")
    parser.add_argument("--db", default="data/app.db", help="Path to app.db")
    parser.add_argument("--input-json", help="Use exported JSON instead of sqlite for dry-run planning")
    parser.add_argument("--updates-json", help="Write planned slug/category updates to JSON")
    parser.add_argument("--apply", action="store_true", help="Persist the changes")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    if args.input_json:
        payload = json.loads(Path(args.input_json).read_text())
        items = payload.get("items", [])
        changed = []
        counts = Counter()
        for item in items:
            category = classify(
                {
                    "slug": item.get("slug"),
                    "name": item.get("name"),
                    "summary": item.get("summary"),
                    "tags": item.get("tags", []),
                    "sourceUrl": item.get("source_url"),
                    "sourceRepo": item.get("source_repo"),
                }
            )
            counts[category] += 1
            changed.append({"slug": item.get("slug"), "category": category})

        result = {"changed": len(changed), "counts": dict(counts), "sample": changed[:20], "updates": changed}
        if args.updates_json:
            Path(args.updates_json).write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n")
        print(json.dumps({k: v for k, v in result.items() if k != "updates"}, ensure_ascii=False, indent=2))
        return

    db_path = Path(args.db)
    conn = sqlite3.connect(str(db_path))
    cur = conn.cursor()

    row = cur.execute("select id, payload from app_state limit 1").fetchone()
    if not row:
      raise SystemExit("app_state not found")
    state_id, payload = row
    state = json.loads(payload)

    by_id = {lobster["id"]: lobster for lobster in state.get("lobsters", [])}
    version_by_lobster = {}
    for version in state.get("lobsterVersions", []):
        existing = version_by_lobster.get(version["lobsterId"])
        if not existing or existing.get("createdAt", "") < version.get("createdAt", ""):
            version_by_lobster[version["lobsterId"]] = version

    changed = []
    counts = Counter()
    for lobster in state.get("lobsters", []):
        if lobster.get("status") != "active":
            continue
        version = version_by_lobster.get(lobster["id"], {})
        category = classify(
            {
                "slug": lobster.get("slug"),
                "name": lobster.get("name"),
                "summary": lobster.get("summary"),
                "tags": lobster.get("tags", []),
                "sourceUrl": lobster.get("sourceUrl"),
                "sourceRepo": version.get("sourceRepo"),
            }
        )
        counts[category] += 1
        if lobster.get("category") != category:
            lobster["category"] = category
            changed.append((lobster["slug"], category))

    result = {"changed": len(changed), "counts": dict(counts), "sample": changed[:20]}
    print(json.dumps(result, ensure_ascii=False, indent=2))

    if not args.apply:
        conn.close()
        return

    cur.execute("update app_state set payload=?, updated_at=datetime('now') where id=?", (json.dumps(state, separators=(",", ":")), state_id))
    for lobster in state.get("lobsters", []):
        cur.execute("update lobsters_mirror set category=? where id=?", (lobster.get("category"), lobster["id"]))
    conn.commit()
    conn.close()


if __name__ == "__main__":
    main()
