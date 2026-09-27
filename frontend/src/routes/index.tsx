import { createFileRoute } from "@tanstack/react-router";
import { LandingPage } from "@/pages/LandingPage";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "NEXUS — One workspace. Every team. Complete visibility." },
      {
        name: "description",
        content:
          "Plan projects, manage tasks, collaborate in real time, and understand team performance in one intelligent workspace.",
      },
      { property: "og:title", content: "NEXUS — Complete visibility for every team" },
      {
        property: "og:description",
        content:
          "Enterprise collaboration, project management, workflow, communication, and team productivity in one workspace.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LandingPage,
});
