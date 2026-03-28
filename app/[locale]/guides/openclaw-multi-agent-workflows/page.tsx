import { permanentRedirect } from "next/navigation";

type LegacyLocalizedMultiAgentWorkflowsGuideRedirectProps = {
  params: Promise<{ locale: string }>;
};

export default async function LegacyLocalizedMultiAgentWorkflowsGuideRedirect({
  params,
}: LegacyLocalizedMultiAgentWorkflowsGuideRedirectProps) {
  const { locale } = await params;
  permanentRedirect(`/${locale}/guides/openclaw-multi-agent-config`);
}
