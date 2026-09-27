import { rtcConfiguration } from "./webrtc";

/**
 * Owns the single RTCPeerConnection and the local microphone stream.
 *
 * Module-level singletons on purpose: React re-renders must never be able to
 * orphan a peer connection or leave a microphone track running, and a call is
 * inherently one-per-tab. `closeCall` is the only teardown path.
 */

let peerConnection: RTCPeerConnection | null = null;
let localStream: MediaStream | null = null;

/** Tears down any previous connection before opening a new one. */
export const createPeerConnection = (): RTCPeerConnection => {
  closeCall();

  peerConnection = new RTCPeerConnection(rtcConfiguration);

  return peerConnection;
};

export const getPeerConnection = (): RTCPeerConnection | null => peerConnection;

/** Cached so a reconnect or renegotiation does not re-prompt for the mic. */
export const getMicrophone = async (): Promise<MediaStream> => {
  if (localStream) {
    return localStream;
  }

  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("Microphone capture is not available in this browser");
  }

  localStream = await navigator.mediaDevices.getUserMedia({ audio: true });

  return localStream;
};

/** Flips every audio track and returns the new muted state. */
export const toggleMicrophone = (): boolean => {
  const tracks = localStream?.getAudioTracks() ?? [];

  if (tracks.length === 0) {
    return false;
  }

  const next = !tracks[0]?.enabled;

  tracks.forEach((track) => {
    track.enabled = next;
  });

  return next;
};

export const isMicrophoneMuted = (): boolean => {
  const tracks = localStream?.getAudioTracks() ?? [];

  return tracks.length > 0 ? !tracks[0]?.enabled : false;
};

/**
 * Releases the peer connection and stops every local track, so the browser's
 * recording indicator goes dark. Safe to call when nothing is open.
 */
export const closeCall = (): void => {
  if (peerConnection) {
    peerConnection.ontrack = null;
    peerConnection.onicecandidate = null;
    peerConnection.onconnectionstatechange = null;
    peerConnection.close();
    peerConnection = null;
  }

  if (localStream) {
    localStream.getTracks().forEach((track) => {
      track.stop();
    });

    localStream = null;
  }
};
