import { createFileRoute } from "@tanstack/react-router";
import { requireAuth } from "@/lib/auth-guard";
import { CalendarPage } from "@/pages/AppPages";

export const Route = createFileRoute("/calendar")({
  beforeLoad: requireAuth,
  // The session lives in localStorage, so this page cannot be decided on the
  // server. Skip SSR and let the guard run in the browser.
  ssr: false,
  head: () => ({
    meta: [
      { title: "Team Calendar â€” NEXUS" },
      {
        name: "description",
        content: "Coordinate planning, reviews, milestones, meetings, and delivery deadlines.",
      },
      { property: "og:title", content: "Team Calendar â€” NEXUS" },
      {
        property: "og:description",
        content: "Coordinate planning, reviews, milestones, meetings, and delivery deadlines.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CalendarPage,
});
