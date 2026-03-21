import { GuidesIndexPage } from "@/components/guides-index-page";
import { buildLocaleAlternates } from "@/lib/locale-routing";

export const metadata = {
  title: "OpenClaw Guides",
  description:
    "Practical ClawLodge guides for OpenClaw config files, memory strategy, and multi-agent workspace design.",
  alternates: buildLocaleAlternates("/guides", "en"),
};

export default function GuidesPage() {
  return <GuidesIndexPage locale="en" />;
}
