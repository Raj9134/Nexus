import { createFileRoute } from "@tanstack/react-router";
import { requireAuth } from "@/lib/auth-guard";
import { AuditPage } from "@/pages/AppPages";

export const Route = createFileRoute("/audit")({
  beforeLoad: requireAuth,
  // The session lives in localStorage, so this page cannot be decided on the
  // server. Skip SSR and let the guard run in the browser.
  ssr: false,
  head: () => ({
    meta: [
      { title: "Audit Logs â€” NEXUS" },
      {
        name: "description",
        content: "Review enterprise audit history for users, roles, projects, and system changes.",
      },
      { property: "og:title", content: "Audit Logs â€” NEXUS" },
      {
        property: "og:description",
        content: "Review enterprise audit history for users, roles, projects, and system changes.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuditPage,
});
