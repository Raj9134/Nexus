import { createFileRoute } from "@tanstack/react-router";
import { requireAuth } from "@/lib/auth-guard";
import { SettingsPage } from "@/pages/AppPages";

export const Route = createFileRoute("/settings")({
  beforeLoad: requireAuth,
  // The session lives in localStorage, so this page cannot be decided on the
  // server. Skip SSR and let the guard run in the browser.
  ssr: false,
  head: () => ({
    meta: [
      { title: "Settings â€” NEXUS" },
      {
        name: "description",
        content:
          "Configure profile, account, security, notifications, appearance, and organization preferences.",
      },
      { property: "og:title", content: "Settings â€” NEXUS" },
      {
        property: "og:description",
        content:
          "Configure profile, account, security, notifications, appearance, and organization preferences.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SettingsPage,
});
