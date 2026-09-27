import { redirect } from "@tanstack/react-router";

import { isAuthenticated } from "@/services/api";

/**
 * Route `beforeLoad` guard for authenticated pages. Runs before the component
 * mounts, so a signed-out visitor never renders workspace shell data.
 *
 * The session lives in localStorage, which only exists in the browser. TanStack
 * runs beforeLoad on the server too, and there the check would always report
 * "signed out" and bounce a signed-in visitor to /login on every hard load or
 * deep link. So the guard only decides once we are in the browser; the server
 * renders the page and the client settles the redirect.
 */
export const requireAuth = () => {
  if (typeof window === "undefined") {
    return;
  }

  if (!isAuthenticated()) {
    throw redirect({ to: "/login" });
  }
};

/**
 * Keeps signed-in users out of the login and register screens. Deliberately not
 * applied to the recovery pages: someone who is signed in but locked out still
 * needs to reset their password or verify their email.
 */
export const requireGuest = () => {
  if (typeof window === "undefined") {
    return;
  }

  if (isAuthenticated()) {
    throw redirect({ to: "/app" });
  }
};
