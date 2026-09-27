import { useEffect, useRef } from "react";
import Call from "./components/Call";
import socket from "./socket";
import { useCall } from "./CallContext";

import {
    closeCallConnection,
    createPeerConnection,
    getMicrophone,
    getPeerConnection
} from "./callManager";


function App() {

    const {
        currentUserId,
        setCurrentUserId,
        setCallId,
        setCaller,
        setReceiver,
        setIsCallActive,
        setIsIncomingCall,
        setCallStartTime,
        isSpeakerOn
    } = useCall();


    const remoteAudioRef = useRef(null);


    useEffect(() => {

        const userId =
            "6ab7cb3fd60d530b10a1bbcb";

        setCurrentUserId(userId);

        socket.emit(
            "joinRoom",
            userId
        );

        console.log(
            "Joined NEXUS socket room:",
            userId
        );

    }, [setCurrentUserId]);


    useEffect(() => {

        if (remoteAudioRef.current) {

            remoteAudioRef.current.muted =
                !isSpeakerOn;

        }

    }, [isSpeakerOn]);


    useEffect(() => {

        const handleIncomingCall = (data) => {

            console.log(
                "Incoming call received:",
                data
            );

            setCallId(data.callId);

            setCaller(data.caller);

            setReceiver(currentUserId);

            setIsIncomingCall(true);

        };


        socket.on(
            "incomingCall",
            handleIncomingCall
        );


        return () => {

            socket.off(
                "incomingCall",
                handleIncomingCall
            );

        };

    }, [
        currentUserId,
        setCallId,
        setCaller,
        setReceiver,
        setIsIncomingCall
    ]);


    useEffect(() => {

        const handleCallAccepted = async (data) => {

            try {

                console.log(
                    "Call accepted by receiver:",
                    data
                );


                const microphone =
                    await getMicrophone();


                const peerConnection =
                    createPeerConnection();


                peerConnection.ontrack =
                    (event) => {

                        console.log(
                            "Remote audio received"
                        );

                        if (
                            remoteAudioRef.current &&
                            event.streams[0]
                        ) {

                            remoteAudioRef.current.srcObject =
                                event.streams[0];

                        }

                    };


                peerConnection.onicecandidate =
                    (event) => {

                        if (event.candidate) {

                            socket.emit(
                                "iceCandidate",
                                {
                                    caller: currentUserId,
                                    receiver: data.receiver,
                                    callId: data.callId,
                                    candidate: event.candidate
                                }
                            );

                        }

                    };


                peerConnection.onconnectionstatechange =
                    () => {

                        console.log(
                            "WebRTC connection state:",
                            peerConnection.connectionState
                        );

                    };


                microphone
                    .getTracks()
                    .forEach((track) => {

                        peerConnection.addTrack(
                            track,
                            microphone
                        );

                    });


                const offer =
                    await peerConnection.createOffer();


                await peerConnection.setLocalDescription(
                    offer
                );


                socket.emit(
                    "webrtcOffer",
                    {
                        caller: currentUserId,
                        receiver: data.receiver,
                        callId: data.callId,
                        offer: offer
                    }
                );


                console.log(
                    "WebRTC offer sent"
                );

            } catch (error) {

                console.log(
                    "Error starting WebRTC:",
                    error.message
                );

            }

        };


        socket.on(
            "callAccepted",
            handleCallAccepted
        );


        return () => {

            socket.off(
                "callAccepted",
                handleCallAccepted
            );

        };

    }, [currentUserId]);


    useEffect(() => {

        const handleWebRTCOffer = async (data) => {

            try {

                console.log(
                    "WebRTC offer received:",
                    data
                );


                const microphone =
                    await getMicrophone();


                const peerConnection =
                    createPeerConnection();


                peerConnection.ontrack =
                    (event) => {

                        console.log(
                            "Remote audio received"
                        );

                        if (
                            remoteAudioRef.current &&
                            event.streams[0]
                        ) {

                            remoteAudioRef.current.srcObject =
                                event.streams[0];

                        }

                    };


                peerConnection.onicecandidate =
                    (event) => {

                        if (event.candidate) {

                            socket.emit(
                                "iceCandidate",
                                {
                                    caller: data.caller,
                                    receiver: currentUserId,
                                    callId: data.callId,
                                    candidate: event.candidate
                                }
                            );

                        }

                    };


                peerConnection.onconnectionstatechange =
                    () => {

                        console.log(
                            "WebRTC connection state:",
                            peerConnection.connectionState
                        );

                    };


                microphone
                    .getTracks()
                    .forEach((track) => {

                        peerConnection.addTrack(
                            track,
                            microphone
                        );

                    });


                await peerConnection.setRemoteDescription(
                    new RTCSessionDescription(
                        data.offer
                    )
                );


                const answer =
                    await peerConnection.createAnswer();


                await peerConnection.setLocalDescription(
                    answer
                );


                socket.emit(
                    "webrtcAnswer",
                    {
                        caller: data.caller,
                        receiver: currentUserId,
                        callId: data.callId,
                        answer: answer
                    }
                );


                setIsCallActive(true);

                setCallStartTime(Date.now());

                setIsIncomingCall(false);


                console.log(
                    "WebRTC answer sent"
                );

            } catch (error) {

                console.log(
                    "Error handling WebRTC offer:",
                    error.message
                );

            }

        };


        socket.on(
            "webrtcOffer",
            handleWebRTCOffer
        );


        return () => {

            socket.off(
                "webrtcOffer",
                handleWebRTCOffer
            );

        };

    }, [
        currentUserId,
        setIsCallActive,
        setIsIncomingCall,
        setCallStartTime
    ]);


    useEffect(() => {

        const handleWebRTCAnswer = async (data) => {

            try {

                console.log(
                    "WebRTC answer received:",
                    data
                );


                const peerConnection =
                    getPeerConnection();


                if (!peerConnection) {

                    console.log(
                        "Peer connection not found"
                    );

                    return;

                }


                await peerConnection.setRemoteDescription(
                    new RTCSessionDescription(
                        data.answer
                    )
                );


                setIsCallActive(true);

                setCallStartTime(Date.now());


                console.log(
                    "WebRTC connection established"
                );

            } catch (error) {

                console.log(
                    "Error handling WebRTC answer:",
                    error.message
                );

            }

        };


        socket.on(
            "webrtcAnswer",
            handleWebRTCAnswer
        );


        return () => {

            socket.off(
                "webrtcAnswer",
                handleWebRTCAnswer
            );

        };

    }, [
        setIsCallActive,
        setCallStartTime
    ]);


    useEffect(() => {

        const handleICECandidate = async (data) => {

            try {

                console.log(
                    "ICE candidate received:",
                    data
                );


                const peerConnection =
                    getPeerConnection();


                if (!peerConnection) {

                    console.log(
                        "Peer connection not found"
                    );

                    return;

                }


                await peerConnection.addIceCandidate(
                    new RTCIceCandidate(
                        data.candidate
                    )
                );


                console.log(
                    "ICE candidate added"
                );

            } catch (error) {

                console.log(
                    "Error adding ICE candidate:",
                    error.message
                );

            }

        };


        socket.on(
            "iceCandidate",
            handleICECandidate
        );


        return () => {

            socket.off(
                "iceCandidate",
                handleICECandidate
            );

        };

    }, []);


    useEffect(() => {

        const handleCallRejected = (data) => {

            console.log(
                "Call rejected by receiver:",
                data
            );


            closeCallConnection();


            setCallId(null);

            setCaller(null);

            setReceiver(null);

            setIsCallActive(false);

            setIsIncomingCall(false);

            setCallStartTime(null);

        };


        socket.on(
            "callRejected",
            handleCallRejected
        );


        return () => {

            socket.off(
                "callRejected",
                handleCallRejected
            );

        };

    }, [
        setCallId,
        setCaller,
        setReceiver,
        setIsCallActive,
        setIsIncomingCall,
        setCallStartTime
    ]);


    useEffect(() => {

        const handleCallEnded = (data) => {

            console.log(
                "Call ended by other user:",
                data
            );


            closeCallConnection();


            setCallId(null);

            setCaller(null);

            setReceiver(null);

            setIsCallActive(false);

            setIsIncomingCall(false);

            setCallStartTime(null);


            if (remoteAudioRef.current) {

                remoteAudioRef.current.srcObject =
                    null;

            }

        };


        socket.on(
            "callEnded",
            handleCallEnded
        );


        return () => {

            socket.off(
                "callEnded",
                handleCallEnded
            );

        };

    }, [
        setCallId,
        setCaller,
        setReceiver,
        setIsCallActive,
        setIsIncomingCall,
        setCallStartTime
    ]);


    return (
        <div>

            <h1>
                NEXUS
            </h1>

            <p>
                Collaboration Platform
            </p>

            <audio
                ref={remoteAudioRef}
                autoPlay
                muted={!isSpeakerOn}
            />

            <Call />

        </div>
    );

}


export default App;