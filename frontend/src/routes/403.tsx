import { createFileRoute } from "@tanstack/react-router";
import { ErrorPage } from "@/pages/ErrorPages";

export const Route = createFileRoute("/403")({
  head: () => ({
    meta: [
      { title: "Access Denied — NEXUS" },
      {
        name: "description",
        content: "You do not have permission to view this NEXUS workspace area.",
      },
      { property: "og:title", content: "Access Denied — NEXUS" },
      {
        property: "og:description",
        content: "You do not have permission to view this NEXUS workspace area.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <ErrorPage code="403" />,
});
