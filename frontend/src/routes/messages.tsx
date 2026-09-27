import { createFileRoute } from "@tanstack/react-router";
import { requireAuth } from "@/lib/auth-guard";
import { MessagesPage } from "@/pages/AppPages";

export const Route = createFileRoute("/messages")({
  beforeLoad: requireAuth,
  // The session lives in localStorage, so this page cannot be decided on the
  // server. Skip SSR and let the guard run in the browser.
  ssr: false,
  head: () => ({
    meta: [
      { title: "Messages â€” NEXUS" },
      {
        name: "description",
        content: "Collaborate with channels, direct messages, reactions, and shared context.",
      },
      { property: "og:title", content: "Messages â€” NEXUS" },
      {
        property: "og:description",
        content: "Collaborate with channels, direct messages, reactions, and shared context.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MessagesPage,
});
