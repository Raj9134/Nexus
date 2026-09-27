import { createFileRoute } from "@tanstack/react-router";
import { requireAuth } from "@/lib/auth-guard";
import { DashboardPage } from "@/pages/AppPages";

export const Route = createFileRoute("/app")({
  beforeLoad: requireAuth,
  // The session lives in localStorage, so this page cannot be decided on the
  // server. Skip SSR and let the guard run in the browser.
  ssr: false,
  head: () => ({
    meta: [
      { title: "NEXUS Overview â€” Workspace command center" },
      {
        name: "description",
        content: "Track projects, tasks, productivity, workload, and team activity across NEXUS.",
      },
      { property: "og:title", content: "NEXUS Overview â€” Workspace command center" },
      {
        property: "og:description",
        content: "Track projects, tasks, productivity, workload, and team activity across NEXUS.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DashboardPage,
});
