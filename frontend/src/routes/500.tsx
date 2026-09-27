import { createFileRoute } from "@tanstack/react-router";
import { ErrorPage } from "@/pages/ErrorPages";

export const Route = createFileRoute("/500")({
  head: () => ({
    meta: [
      { title: "Server Error — NEXUS" },
      {
        name: "description",
        content: "NEXUS encountered an error while loading this workspace area.",
      },
      { property: "og:title", content: "Server Error — NEXUS" },
      {
        property: "og:description",
        content: "NEXUS encountered an error while loading this workspace area.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <ErrorPage code="500" />,
});
