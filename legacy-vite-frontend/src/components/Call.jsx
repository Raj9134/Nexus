import { useEffect, useRef, useState } from "react";
import socket from "../socket";
import { useCall } from "../CallContext";

import {
    closeCallConnection,
    toggleMicrophone
} from "../callManager";


function Call() {

    const {
        currentUserId,

        callId,
        setCallId,

        caller,
        setCaller,

        receiver,
        setReceiver,

        isCallActive,
        setIsCallActive,

        isIncomingCall,
        setIsIncomingCall,

        callStartTime,
        setCallStartTime,

        isSpeakerOn,
        setIsSpeakerOn
    } = useCall();


    const [callDuration, setCallDuration] = useState(0);

    const [isMuted, setIsMuted] = useState(false);

    const missedCallTimerRef = useRef(null);


    useEffect(() => {

        if (isCallActive) {

            if (missedCallTimerRef.current) {

                clearTimeout(
                    missedCallTimerRef.current
                );

                missedCallTimerRef.current = null;

            }

        }


        if (!isCallActive || !callStartTime) {

            setCallDuration(0);

            return;

        }


        const interval = setInterval(() => {

            const elapsed =
                Math.floor(
                    (Date.now() - callStartTime) / 1000
                );

            setCallDuration(elapsed);

        }, 1000);


        return () => {

            clearInterval(interval);

        };

    }, [
        isCallActive,
        callStartTime
    ]);


    useEffect(() => {

        return () => {

            if (missedCallTimerRef.current) {

                clearTimeout(
                    missedCallTimerRef.current
                );

            }

        };

    }, []);


    const formatDuration = (seconds) => {

        const minutes =
            Math.floor(seconds / 60);

        const remainingSeconds =
            seconds % 60;


        return (
            String(minutes).padStart(2, "0") +
            ":" +
            String(remainingSeconds).padStart(2, "0")
        );

    };


    const handleMuteToggle = () => {

        const microphoneEnabled =
            toggleMicrophone();

        setIsMuted(!microphoneEnabled);

    };


    const handleSpeakerToggle = () => {

        setIsSpeakerOn(
            !isSpeakerOn
        );

    };


    const startCall = async () => {

        try {

            const receiverId =
                "6ab7cb55d60d530b10a1bbcc";


            const token =
                localStorage.getItem("token");


            const response =
                await fetch(
                    "http://localhost:5000/api/calls",
                    {
                        method: "POST",

                        headers: {
                            "Content-Type": "application/json",
                            "Authorization": `Bearer ${token}`
                        },

                        body: JSON.stringify({
                            receiver: receiverId
                        })
                    }
                );


            const data =
                await response.json();


            if (!response.ok) {

                console.log(
                    "Call creation failed:",
                    data
                );

                return;

            }


            setCallId(data.call._id);

            setCaller(currentUserId);

            setReceiver(receiverId);


            socket.emit(
                "callUser",
                {
                    caller: currentUserId,
                    receiver: receiverId,
                    callId: data.call._id
                }
            );


            console.log(
                "Calling user:",
                receiverId
            );


            missedCallTimerRef.current =
                setTimeout(
                    async () => {

                        try {

                            const token =
                                localStorage.getItem("token");


                            const response =
                                await fetch(
                                    `http://localhost:5000/api/calls/${data.call._id}/miss`,
                                    {
                                        method: "PUT",

                                        headers: {
                                            "Authorization": `Bearer ${token}`
                                        }
                                    }
                                );


                            const missedCallData =
                                await response.json();


                            if (!response.ok) {

                                console.log(
                                    "Missed call update failed:",
                                    missedCallData
                                );

                                return;

                            }


                            socket.emit(
                                "callMissed",
                                {
                                    caller: currentUserId,
                                    receiver: receiverId,
                                    callId: data.call._id
                                }
                            );


                            setCallId(null);

                            setCaller(null);

                            setReceiver(null);

                            setIsCallActive(false);

                            setIsIncomingCall(false);

                            setCallStartTime(null);


                            console.log(
                                "Call marked as missed"
                            );

                        } catch (error) {

                            console.log(
                                "Error marking call as missed:",
                                error.message
                            );

                        }

                    },
                    30000
                );

        } catch (error) {

            console.log(
                "Error starting call:",
                error.message
            );

        }

    };


    const acceptCall = async () => {

        try {

            if (missedCallTimerRef.current) {

                clearTimeout(
                    missedCallTimerRef.current
                );

                missedCallTimerRef.current = null;

            }


            const token =
                localStorage.getItem("token");


            const response =
                await fetch(
                    `http://localhost:5000/api/calls/${callId}/accept`,
                    {
                        method: "PUT",

                        headers: {
                            "Authorization": `Bearer ${token}`
                        }
                    }
                );


            const data =
                await response.json();


            if (!response.ok) {

                console.log(
                    "Accept call failed:",
                    data
                );

                return;

            }


            socket.emit(
                "callAccepted",
                {
                    caller: caller,
                    receiver: currentUserId,
                    callId: callId
                }
            );


            setIsIncomingCall(false);

            setIsCallActive(true);


            console.log(
                "Call accepted"
            );

        } catch (error) {

            console.log(
                "Error accepting call:",
                error.message
            );

        }

    };


    const rejectCall = async () => {

        try {

            if (missedCallTimerRef.current) {

                clearTimeout(
                    missedCallTimerRef.current
                );

                missedCallTimerRef.current = null;

            }


            const token =
                localStorage.getItem("token");


            const response =
                await fetch(
                    `http://localhost:5000/api/calls/${callId}/reject`,
                    {
                        method: "PUT",

                        headers: {
                            "Authorization": `Bearer ${token}`
                        }
                    }
                );


            const data =
                await response.json();


            if (!response.ok) {

                console.log(
                    "Reject call failed:",
                    data
                );

                return;

            }


            socket.emit(
                "callRejected",
                {
                    caller: caller,
                    receiver: currentUserId,
                    callId: callId
                }
            );


            closeCallConnection();


            setCallId(null);

            setCaller(null);

            setReceiver(null);

            setIsCallActive(false);

            setIsIncomingCall(false);

            setCallStartTime(null);

            setIsMuted(false);


            console.log(
                "Call rejected"
            );

        } catch (error) {

            console.log(
                "Error rejecting call:",
                error.message
            );

        }

    };


    const endCall = async () => {

        try {

            if (missedCallTimerRef.current) {

                clearTimeout(
                    missedCallTimerRef.current
                );

                missedCallTimerRef.current = null;

            }


            const token =
                localStorage.getItem("token");


            const response =
                await fetch(
                    `http://localhost:5000/api/calls/${callId}/end`,
                    {
                        method: "PUT",

                        headers: {
                            "Authorization": `Bearer ${token}`
                        }
                    }
                );


            const data =
                await response.json();


            if (!response.ok) {

                console.log(
                    "End call failed:",
                    data
                );

                return;

            }


            socket.emit(
                "endCall",
                {
                    caller: caller,
                    receiver: receiver,
                    callId: callId,
                    userId: currentUserId
                }
            );


            closeCallConnection();


            setIsCallActive(false);

            setIsIncomingCall(false);

            setCallId(null);

            setCaller(null);

            setReceiver(null);

            setCallStartTime(null);

            setIsMuted(false);


            console.log(
                "Call ended"
            );

        } catch (error) {

            console.log(
                "Error ending call:",
                error.message
            );

        }

    };


    return (
        <div>

            {!callId && (
                <button onClick={startCall}>
                    Start Voice Call
                </button>
            )}


            {callId && !isCallActive && !isIncomingCall && (
                <p>
                    Calling...
                </p>
            )}


            {isIncomingCall && (
                <div>

                    <p>
                        Incoming Voice Call
                    </p>

                    <button onClick={acceptCall}>
                        Accept
                    </button>

                    <button onClick={rejectCall}>
                        Reject
                    </button>

                </div>
            )}


            {isCallActive && (
                <div>

                    <p>
                        Voice Call Active
                    </p>

                    <p>
                        {formatDuration(callDuration)}
                    </p>

                    <button onClick={handleMuteToggle}>
                        {isMuted ? "Unmute" : "Mute"}
                    </button>

                    <button onClick={handleSpeakerToggle}>
                        {isSpeakerOn
                            ? "Speaker Off"
                            : "Speaker On"}
                    </button>

                    <button onClick={endCall}>
                        End Call
                    </button>

                </div>
            )}

        </div>
    );

}


export default Call;