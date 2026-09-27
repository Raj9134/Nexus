import rtcConfiguration from "./webrtc";

let peerConnection = null;
let localStream = null;


export const createPeerConnection = () => {

    if (peerConnection) {

        peerConnection.close();

    }

    peerConnection =
        new RTCPeerConnection(
            rtcConfiguration
        );

    return peerConnection;

};


export const getPeerConnection = () => {

    return peerConnection;

};


export const getLocalStream = () => {

    return localStream;

};


export const getMicrophone = async () => {

    if (localStream) {

        return localStream;

    }

    localStream =
        await navigator.mediaDevices.getUserMedia({
            audio: true
        });

    return localStream;

};


export const toggleMicrophone = () => {

    if (!localStream) {

        return false;

    }

    const audioTracks =
        localStream.getAudioTracks();

    if (audioTracks.length === 0) {

        return false;

    }

    const currentState =
        audioTracks[0].enabled;

    audioTracks.forEach((track) => {

        track.enabled = !currentState;

    });

    return !currentState;

};


export const closeCallConnection = () => {

    if (peerConnection) {

        peerConnection.ontrack = null;

        peerConnection.onicecandidate = null;

        peerConnection.close();

        peerConnection = null;

    }

    if (localStream) {

        localStream
            .getTracks()
            .forEach((track) => {

                track.stop();

            });

        localStream = null;

    }

};