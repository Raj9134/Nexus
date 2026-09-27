/**
 * ICE configuration for every peer connection the app opens.
 *
 * A STUN server only is enough for host candidates, which is all a
 * same-network or localhost call needs. Two peers behind separate NATs will
 * not connect without a TURN relay, so set VITE_TURN_URL (plus
 * VITE_TURN_USERNAME / VITE_TURN_CREDENTIAL) before deploying.
 */
const iceServers: RTCIceServer[] = [
  {
    urls: "stun:stun.l.google.com:19302",
  },
];

const turnUrl = import.meta.env["VITE_TURN_URL"] as string | undefined;

if (turnUrl) {
  // exactOptionalPropertyTypes is on, so the optional fields are only present
  // when they actually have a value.
  const turn: RTCIceServer = { urls: turnUrl };
  const username = import.meta.env["VITE_TURN_USERNAME"] as string | undefined;
  const credential = import.meta.env["VITE_TURN_CREDENTIAL"] as string | undefined;

  if (username !== undefined) {
    turn.username = username;
  }

  if (credential !== undefined) {
    turn.credential = credential;
  }

  iceServers.push(turn);
}

export const rtcConfiguration: RTCConfiguration = {
  iceServers,
};

export default rtcConfiguration;
