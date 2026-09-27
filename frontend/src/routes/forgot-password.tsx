import { createFileRoute } from "@tanstack/react-router";
import { AuthPage } from "@/pages/AuthPages";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [
      { title: "Recover your account — NEXUS" },
      { name: "description", content: "Request a secure password reset for your NEXUS account." },
      { property: "og:title", content: "Recover your account — NEXUS" },
      {
        property: "og:description",
        content: "Request a secure password reset for your NEXUS account.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <AuthPage mode="forgot" />,
});
