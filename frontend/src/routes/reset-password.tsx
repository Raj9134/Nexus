import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { AuthPage } from "@/pages/AuthPages";

// The reset link carries ?token=..., so treat it as a real route param instead
// of reading window.location by hand.
export const Route = createFileRoute("/reset-password")({
  validateSearch: z.object({ token: z.string().optional() }),
  head: () => ({
    meta: [
      { title: "Reset password — NEXUS" },
      { name: "description", content: "Create a new secure password for your NEXUS account." },
      { property: "og:title", content: "Reset password — NEXUS" },
      {
        property: "og:description",
        content: "Create a new secure password for your NEXUS account.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <AuthPage mode="reset" />,
});
