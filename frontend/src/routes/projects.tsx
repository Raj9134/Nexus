import { createFileRoute } from "@tanstack/react-router";
import { requireAuth } from "@/lib/auth-guard";
import { ProjectsPage } from "@/pages/AppPages";

export const Route = createFileRoute("/projects")({
  beforeLoad: requireAuth,
  // The session lives in localStorage, so this page cannot be decided on the
  // server. Skip SSR and let the guard run in the browser.
  ssr: false,
  head: () => ({
    meta: [
      { title: "Projects â€” NEXUS" },
      {
        name: "description",
        content: "Review project health, progress, members, deadlines, and delivery status.",
      },
      { property: "og:title", content: "Projects â€” NEXUS" },
      {
        property: "og:description",
        content: "Review project health, progress, members, deadlines, and delivery status.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProjectsPage,
});
