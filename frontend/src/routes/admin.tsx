import { createFileRoute } from "@tanstack/react-router";
import { requireAuth } from "@/lib/auth-guard";
import { AdminPage } from "@/pages/AppPages";

export const Route = createFileRoute("/admin")({
  beforeLoad: requireAuth,
  // The session lives in localStorage, so this page cannot be decided on the
  // server. Skip SSR and let the guard run in the browser.
  ssr: false,
  head: () => ({
    meta: [
      { title: "Admin Dashboard â€” NEXUS" },
      {
        name: "description",
        content: "Manage users, organizations, roles, permissions, security, and system settings.",
      },
      { property: "og:title", content: "Admin Dashboard â€” NEXUS" },
      {
        property: "og:description",
        content: "Manage users, organizations, roles, permissions, security, and system settings.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AdminPage,
});
