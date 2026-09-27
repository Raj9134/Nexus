import { createContext, useContext, useState } from "react";

const CallContext = createContext();

export const CallProvider = ({ children }) => {

    const [currentUserId, setCurrentUserId] = useState(null);

    const [callId, setCallId] = useState(null);

    const [caller, setCaller] = useState(null);

    const [receiver, setReceiver] = useState(null);

    const [isCallActive, setIsCallActive] = useState(false);

    const [isIncomingCall, setIsIncomingCall] = useState(false);

    const [callStartTime, setCallStartTime] = useState(null);

    const [isSpeakerOn, setIsSpeakerOn] = useState(true);

    return (
        <CallContext.Provider
            value={{
                currentUserId,
                setCurrentUserId,

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
            }}
        >
            {children}
        </CallContext.Provider>
    );

};

export const useCall = () => {

    return useContext(CallContext);

};