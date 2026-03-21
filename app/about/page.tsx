import { AboutPage, buildAboutMetadata } from "@/components/about-page";

export const metadata = buildAboutMetadata("en");

export default function AboutPageRoute() {
  return <AboutPage locale="en" />;
}
