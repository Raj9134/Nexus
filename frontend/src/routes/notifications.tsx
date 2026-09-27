import { createFileRoute } from "@tanstack/react-router";
import { requireAuth } from "@/lib/auth-guard";
import { NotificationsPage } from "@/pages/AppPages";

export const Route = createFileRoute("/notifications")({
  beforeLoad: requireAuth,
  // The session lives in localStorage, so this page cannot be decided on the
  // server. Skip SSR and let the guard run in the browser.
  ssr: false,
  head: () => ({
    meta: [
      { title: "Notifications â€” NEXUS" },
      {
        name: "description",
        content: "Review mentions, task updates, project changes, and system alerts.",
      },
      { property: "og:title", content: "Notifications â€” NEXUS" },
      {
        property: "og:description",
        content: "Review mentions, task updates, project changes, and system alerts.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: NotificationsPage,
});
