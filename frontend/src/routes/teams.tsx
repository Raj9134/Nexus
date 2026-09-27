import { createFileRoute } from "@tanstack/react-router";
import { requireAuth } from "@/lib/auth-guard";
import { TeamsPage } from "@/pages/AppPages";

export const Route = createFileRoute("/teams")({
  beforeLoad: requireAuth,
  // The session lives in localStorage, so this page cannot be decided on the
  // server. Skip SSR and let the guard run in the browser.
  ssr: false,
  head: () => ({
    meta: [
      { title: "Engineering Team â€” NEXUS" },
      {
        name: "description",
        content: "Manage team members, activity, workload, and performance in NEXUS.",
      },
      { property: "og:title", content: "Engineering Team â€” NEXUS" },
      {
        property: "og:description",
        content: "Manage team members, activity, workload, and performance in NEXUS.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TeamsPage,
});
