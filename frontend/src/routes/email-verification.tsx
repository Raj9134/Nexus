import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { AuthPage } from "@/pages/AuthPages";

// The verification link carries ?token=..., so treat it as a real route param.
export const Route = createFileRoute("/email-verification")({
  validateSearch: z.object({ token: z.string().optional() }),
  head: () => ({
    meta: [
      { title: "Verify email — NEXUS" },
      {
        name: "description",
        content: "Verify your email address to activate your NEXUS workspace.",
      },
      { property: "og:title", content: "Verify email — NEXUS" },
      {
        property: "og:description",
        content: "Verify your email address to activate your NEXUS workspace.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <AuthPage mode="verify" />,
});
