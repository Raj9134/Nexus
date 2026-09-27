const uploadAudio = async (audioFile) => {

    if (!audioFile) {
        throw new Error("Audio file is required");
    }

    const audioUrl = `/uploads/audio/${audioFile.filename}`;

    return audioUrl;
};

module.exports = {
    uploadAudio
};