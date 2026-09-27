import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { VoiceRecorder, type VoiceRecording } from "@/components/nexus/VoiceRecorder";
import { VoicePlayer } from "@/components/nexus/VoicePlayer";

/**
 * Voice messages.
 *
 * Two bugs lived here. serializeMessage omitted messageType, audioUrl and
 * duration, so a voice note rendered as an empty text message with nothing to
 * play. And MediaRecorder tags its blob `audio/webm;codecs=opus`, while the
 * backend's audio filter matches the multipart content type against a fixed
 * list, so the codec suffix was rejected outright.
 */

class FakeMediaRecorder {
  static instances: FakeMediaRecorder[] = [];

  ondataavailable: ((event: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  state = "inactive";
  stream: { getTracks: () => Array<{ stop: () => void }> } = {
    getTracks: () => [{ stop: vi.fn() }],
  };

  constructor() {
    FakeMediaRecorder.instances.push(this);
  }

  start() {
    this.state = "recording";
  }

  stop() {
    this.state = "inactive";
    this.onstop?.();
  }
}

let tracks: Array<{ stop: () => void }>;

const installRecorder = () => {
  FakeMediaRecorder.instances = [];
  tracks = [{ stop: vi.fn() }];

  vi.stubGlobal("MediaRecorder", FakeMediaRecorder as unknown as typeof MediaRecorder);
  vi.stubGlobal("navigator", {
    ...window.navigator,
    mediaDevices: {
      getUserMedia: vi.fn(async () => ({ getTracks: () => tracks })),
    },
  });
};

/** Delivers the chunk MediaRecorder would emit, without stopping. */
const deliverChunk = () => {
  FakeMediaRecorder.instances.at(-1)?.ondataavailable?.({
    data: new Blob(["opus-bytes"], { type: "audio/webm;codecs=opus" }),
  });
};

/** Clicks send, which stops the recorder and hands the blob to onSend. */
const stopAndSend = async (user: ReturnType<typeof userEvent.setup>) => {
  deliverChunk();
  await user.click(screen.getByLabelText("Send the recording"));
};

beforeEach(() => {
  installRecorder();
});

/**
 * jsdom implements no object-URL support, so it is stubbed per test. The
 * cleanup effect calls URL.revokeObjectURL on unmount, so both methods have to
 * survive on whatever the global resolves to at that later point.
 */
const stubObjectUrls = () => {
  const createObjectURL = vi.fn(() => "blob:clip");
  const revokeObjectURL = vi.fn();

  /*
    Assigned onto window.URL rather than replacing the global binding, because
    the cleanup effect runs during unmount and resolves URL from the window,
    not from whatever the module scope captured.
  */
  window.URL.createObjectURL = createObjectURL as unknown as typeof URL.createObjectURL;
  window.URL.revokeObjectURL = revokeObjectURL as unknown as typeof URL.revokeObjectURL;

  return { createObjectURL, revokeObjectURL };
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("VoiceRecorder", () => {
  it("offers a record control when idle", () => {
    render(<VoiceRecorder onSend={vi.fn()} />);

    expect(screen.getByLabelText("Record a voice message")).toBeInTheDocument();
  });

  it("asks for the microphone and starts recording", async () => {
    const user = userEvent.setup();
    render(<VoiceRecorder onSend={vi.fn()} />);

    await user.click(screen.getByLabelText("Record a voice message"));

    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({ audio: true });
    expect(FakeMediaRecorder.instances).toHaveLength(1);
    expect(screen.getByLabelText("Send the recording")).toBeInTheDocument();
  });

  it("strips the codec suffix the backend would reject", async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();
    render(<VoiceRecorder onSend={onSend} />);

    await user.click(screen.getByLabelText("Record a voice message"));
    await stopAndSend(user);

    await waitFor(() => expect(onSend).toHaveBeenCalledTimes(1));

    const recording = onSend.mock.calls[0]?.[0] as VoiceRecording;

    // audio/webm;codecs=opus is what MediaRecorder produces, and the backend
    // compares the content type against ["audio/webm"] exactly.
    expect(recording.blob.type).toBe("audio/webm");
    expect(recording.blob.type).not.toContain("codecs");
  });

  it("reports a whole number of seconds, which the backend requires", async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();
    render(<VoiceRecorder onSend={onSend} />);

    await user.click(screen.getByLabelText("Record a voice message"));
    await stopAndSend(user);

    await waitFor(() => expect(onSend).toHaveBeenCalledTimes(1));

    const recording = onSend.mock.calls[0]?.[0] as VoiceRecording;

    // duration must be a positive number, so a sub-second recording cannot
    // send 0 and be refused.
    expect(Number.isInteger(recording.duration)).toBe(true);
    expect(recording.duration).toBeGreaterThan(0);
  });

  it("releases the microphone when recording stops", async () => {
    const user = userEvent.setup();
    render(<VoiceRecorder onSend={vi.fn()} />);

    await user.click(screen.getByLabelText("Record a voice message"));
    await stopAndSend(user);

    await waitFor(() => expect(tracks[0]?.stop).toHaveBeenCalled());
  });

  it("discards the recording and stops the microphone on cancel", async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();
    const onCancel = vi.fn();
    render(<VoiceRecorder onSend={onSend} onCancel={onCancel} />);

    await user.click(screen.getByLabelText("Record a voice message"));
    await user.click(screen.getByLabelText("Discard"));

    expect(onSend).not.toHaveBeenCalled();
    expect(onCancel).toHaveBeenCalledTimes(1);
    // A discarded recording must not keep the browser's mic indicator lit.
    expect(tracks[0]?.stop).toHaveBeenCalled();
  });

  it("explains a denied microphone instead of failing silently", async () => {
    const user = userEvent.setup();

    vi.stubGlobal("navigator", {
      ...window.navigator,
      mediaDevices: {
        getUserMedia: vi.fn(async () => {
          const error = new Error("denied");
          error.name = "NotAllowedError";
          throw error;
        }),
      },
    });

    render(<VoiceRecorder onSend={vi.fn()} />);

    await user.click(screen.getByLabelText("Record a voice message"));

    expect(await screen.findByText(/permission was denied/i)).toBeInTheDocument();
  });

  it("cannot start when disabled", async () => {
    const user = userEvent.setup();
    render(<VoiceRecorder onSend={vi.fn()} disabled />);

    await user.click(screen.getByLabelText("Record a voice message"));

    expect(navigator.mediaDevices.getUserMedia).not.toHaveBeenCalled();
  });
});

describe("VoicePlayer", () => {
  it("fetches the clip with the access token and plays it from an object URL", async () => {
    window.localStorage.setItem("nexus.accessToken", "test-token");

    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      blob: async () => new Blob(["audio"], { type: "audio/webm" }),
    }));

    vi.stubGlobal("fetch", fetchMock);
    stubObjectUrls();

    render(<VoicePlayer messageId="m1" seconds={4} />);

    // A bare src would 401, because the audio route sits behind auth.
    const call = fetchMock.mock.calls[0] as unknown as [string, RequestInit];

    expect(call[0]).toContain("/messages/voice/m1");
    expect(new Headers(call[1].headers).get("Authorization")).toBe("Bearer test-token");

    expect(await screen.findByText("0:04")).toBeInTheDocument();
  });

  it("releases the object URL when unmounted", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        blob: async () => new Blob(["audio"], { type: "audio/webm" }),
      })),
    );

    const { createObjectURL, revokeObjectURL } = stubObjectUrls();

    const { unmount } = render(<VoicePlayer messageId="m1" seconds={2} />);

    await waitFor(() => expect(createObjectURL).toHaveBeenCalled());

    unmount();

    // Otherwise every played message leaks its buffer.
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:clip");
  });

  it("reports a failed fetch rather than showing a dead player", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 500 })),
    );
    stubObjectUrls();

    render(<VoicePlayer messageId="m1" seconds={2} />);

    expect(await screen.findByText(/Could not load/i)).toBeInTheDocument();
  });
});
