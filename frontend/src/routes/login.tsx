import { createFileRoute } from "@tanstack/react-router";
import { requireGuest } from "@/lib/auth-guard";
import { AuthPage } from "@/pages/AuthPages";

export const Route = createFileRoute("/login")({
  beforeLoad: requireGuest,
  head: () => ({
    meta: [
      { title: "Welcome back — NEXUS" },
      { name: "description", content: "Sign in to your secure NEXUS enterprise workspace." },
      { property: "og:title", content: "Welcome back — NEXUS" },
      { property: "og:description", content: "Sign in to your secure NEXUS enterprise workspace." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <AuthPage mode="login" />,
});
