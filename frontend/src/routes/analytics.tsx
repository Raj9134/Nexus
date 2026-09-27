import { createFileRoute } from "@tanstack/react-router";
import { requireAuth } from "@/lib/auth-guard";
import { AnalyticsPage } from "@/pages/AppPages";

export const Route = createFileRoute("/analytics")({
  beforeLoad: requireAuth,
  // The session lives in localStorage, so this page cannot be decided on the
  // server. Skip SSR and let the guard run in the browser.
  ssr: false,
  head: () => ({
    meta: [
      { title: "Analytics â€” NEXUS" },
      {
        name: "description",
        content: "Understand completion, cycle time, velocity, workload, and activity trends.",
      },
      { property: "og:title", content: "Analytics â€” NEXUS" },
      {
        property: "og:description",
        content: "Understand completion, cycle time, velocity, workload, and activity trends.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AnalyticsPage,
});
