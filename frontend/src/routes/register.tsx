import { createFileRoute } from "@tanstack/react-router";
import { requireGuest } from "@/lib/auth-guard";
import { AuthPage } from "@/pages/AuthPages";

export const Route = createFileRoute("/register")({
  beforeLoad: requireGuest,
  head: () => ({
    meta: [
      { title: "Create your NEXUS account" },
      { name: "description", content: "Start a NEXUS workspace for your team and projects." },
      { property: "og:title", content: "Create your NEXUS account" },
      {
        property: "og:description",
        content: "Start a NEXUS workspace for your team and projects.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <AuthPage mode="register" />,
});
