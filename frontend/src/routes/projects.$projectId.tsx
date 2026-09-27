import { createFileRoute } from "@tanstack/react-router";
import { requireAuth } from "@/lib/auth-guard";
import { ProjectDetailPage } from "@/pages/AppPages";

export const Route = createFileRoute("/projects/$projectId")({
  beforeLoad: requireAuth,
  // The session lives in localStorage, so this page cannot be decided on the
  // server. Skip SSR and let the guard run in the browser.
  ssr: false,
  head: () => ({
    meta: [
      { title: "Project workspace — NEXUS" },
      {
        name: "description",
        content: "Plan project work across boards, tasks, timelines, files, chat, and analytics.",
      },
      { property: "og:title", content: "Project workspace — NEXUS" },
      {
        property: "og:description",
        content: "Plan project work across boards, tasks, timelines, files, chat, and analytics.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProjectDetailPage,
});
