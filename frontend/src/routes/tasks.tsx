import { createFileRoute } from "@tanstack/react-router";
import { requireAuth } from "@/lib/auth-guard";
import { TasksPage } from "@/pages/AppPages";

export const Route = createFileRoute("/tasks")({
  beforeLoad: requireAuth,
  // The session lives in localStorage, so this page cannot be decided on the
  // server. Skip SSR and let the guard run in the browser.
  ssr: false,
  head: () => ({
    meta: [
      { title: "My Tasks â€” NEXUS" },
      {
        name: "description",
        content: "Prioritize and manage tasks across every project in the NEXUS workspace.",
      },
      { property: "og:title", content: "My Tasks â€” NEXUS" },
      {
        property: "og:description",
        content: "Prioritize and manage tasks across every project in the NEXUS workspace.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TasksPage,
});
