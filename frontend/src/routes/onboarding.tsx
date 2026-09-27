import { createFileRoute } from "@tanstack/react-router";
import { requireAuth } from "@/lib/auth-guard";
import { OnboardingPage } from "@/pages/AuthPages";

export const Route = createFileRoute("/onboarding")({
  beforeLoad: requireAuth,
  // The session lives in localStorage, so this page cannot be decided on the
  // server. Skip SSR and let the guard run in the browser.
  ssr: false,
  head: () => ({
    meta: [
      { title: "Set up your workspace â€” NEXUS" },
      {
        name: "description",
        content: "Create an organization, invite teammates, and launch your first NEXUS project.",
      },
      { property: "og:title", content: "Set up your workspace â€” NEXUS" },
      {
        property: "og:description",
        content: "Create an organization, invite teammates, and launch your first NEXUS project.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: OnboardingPage,
});
