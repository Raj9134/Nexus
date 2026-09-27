import { createFileRoute } from "@tanstack/react-router";
import { requireAuth } from "@/lib/auth-guard";
import { FilesPage } from "@/pages/AppPages";

export const Route = createFileRoute("/files")({
  beforeLoad: requireAuth,
  // The session lives in localStorage, so this page cannot be decided on the
  // server. Skip SSR and let the guard run in the browser.
  ssr: false,
  head: () => ({
    meta: [
      { title: "Files â€” NEXUS" },
      {
        name: "description",
        content:
          "Manage workspace folders, technical documentation, reports, and project artifacts.",
      },
      { property: "og:title", content: "Files â€” NEXUS" },
      {
        property: "og:description",
        content:
          "Manage workspace folders, technical documentation, reports, and project artifacts.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: FilesPage,
});
