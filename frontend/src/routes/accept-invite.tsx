import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { AcceptInvitePage } from "@/pages/AcceptInvitePage";

// The invitation link carries ?token=..., so treat it as a real search param.
export const Route = createFileRoute("/accept-invite")({
  validateSearch: z.object({ token: z.string().optional() }),
  // A signed-out invitee has to reach this page, and the session check happens
  // in the browser, so this route must not be decided on the server.
  ssr: false,
  head: () => ({
    meta: [
      { title: "Accept invitation — NEXUS" },
      {
        name: "description",
        content: "Join a NEXUS workspace you have been invited to.",
      },
      { property: "og:title", content: "Accept invitation — NEXUS" },
      {
        property: "og:description",
        content: "Join a NEXUS workspace you have been invited to.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AcceptInviteRoute,
});

function AcceptInviteRoute() {
  const { token } = Route.useSearch();

  return <AcceptInvitePage token={token ?? ""} />;
}
