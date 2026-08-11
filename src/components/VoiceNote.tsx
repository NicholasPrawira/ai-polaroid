"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MicIcon, PauseIcon, PlayIcon, StopIcon, TrashIcon } from "./Chrome";

const MAX_DURATION_S = 30;

/** Peak height (px) each bar eases up to — varied so the row reads as a
 *  waveform rather than identical bars ticking in lockstep. */
const VOICE_BAR_PEAKS = [8, 13, 6, 15, 9, 12, 7, 14, 8, 11, 6, 13];

function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  for (const type of ["audio/webm", "audio/mp4", "audio/ogg"]) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return undefined;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/**
 * Voice memory attached to a photo — a companion to the typed caption, not
 * a replacement. Records up to MAX_DURATION_S seconds via MediaRecorder and
 * uploads on stop; once a note exists this renders a small inline player
 * instead of the record control.
 */
export function VoiceNote({
  voiceUrl,
  onRecord,
  onDelete,
}: {
  voiceUrl: string | null;
  onRecord: (blob: Blob) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [phase, setPhase] = useState<"idle" | "recording" | "uploading" | "deleting">(
    "idle",
  );
  const [elapsed, setElapsed] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const clearTimer = useCallback(() => {
    if (intervalRef.current !== null) window.clearInterval(intervalRef.current);
    intervalRef.current = null;
  }, []);

  useEffect(() => stopStream, [stopStream]);
  useEffect(() => clearTimer, [clearTimer]);

  const startRecording = useCallback(async () => {
    setError(null);
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setError("Microphone access is needed to record a voice note.");
      return;
    }
    streamRef.current = stream;

    const mimeType = pickMimeType();
    const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
    chunksRef.current = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onstop = async () => {
      clearTimer();
      stopStream();
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
      setPhase("uploading");
      try {
        await onRecord(blob);
      } catch {
        setError("Couldn't save the voice note. Try again.");
      }
      setPhase("idle");
    };

    recorderRef.current = recorder;
    recorder.start();
    setPhase("recording");
    setElapsed(0);
    intervalRef.current = window.setInterval(() => {
      setElapsed((prev) => {
        const next = prev + 1;
        if (next >= MAX_DURATION_S) recorderRef.current?.stop();
        return next;
      });
    }, 1000);
  }, [clearTimer, onRecord, stopStream]);

  const stopRecording = useCallback(() => {
    recorderRef.current?.stop();
  }, []);

  const handleDelete = useCallback(async () => {
    setPhase("deleting");
    setError(null);
    try {
      await onDelete();
    } catch {
      setError("Couldn't remove the voice note. Try again.");
    }
    setPhase("idle");
  }, [onDelete]);

  const togglePlayback = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) audio.pause();
    else audio.play();
  }, [playing]);

  if (voiceUrl && phase !== "deleting") {
    return (
      <div className="flex items-center gap-1">
        <audio
          ref={audioRef}
          src={voiceUrl}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)}
        />
        <button
          type="button"
          onClick={togglePlayback}
          aria-label={playing ? "Pause voice note" : "Play voice note"}
          className="grid h-7 w-7 place-items-center rounded-full text-[var(--color-on-surface)] transition-colors hover:bg-[var(--color-surface-container)]"
        >
          {playing ? <PauseIcon size={14} /> : <PlayIcon size={14} />}
        </button>
        <button
          type="button"
          onClick={handleDelete}
          aria-label="Delete voice note"
          className="grid h-7 w-7 place-items-center rounded-full text-[var(--color-on-surface-variant)] transition-colors hover:bg-[var(--color-surface-container)]"
        >
          <TrashIcon />
        </button>
        {error && (
          <span className="type-timestamp-sm text-[var(--color-error)]">{error}</span>
        )}
      </div>
    );
  }

  const listening = phase === "recording";

  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={listening ? stopRecording : startRecording}
        disabled={phase === "uploading"}
        aria-label={listening ? "Stop recording" : "Record a voice note"}
        aria-pressed={listening}
        className={`flex items-center overflow-hidden rounded-full border p-1.5 transition-[padding] duration-300 disabled:opacity-50 ${
          listening
            ? "border-[var(--color-error)] pr-2.5 text-[var(--color-error)]"
            : "border-transparent text-[var(--color-on-surface)] hover:bg-[var(--color-surface-container)]"
        }`}
      >
        <span className="grid h-4 w-4 shrink-0 place-items-center">
          {listening ? (
            <StopIcon size={12} />
          ) : (
            <MicIcon size={15} />
          )}
        </span>

        {/* Frequency bars + timer — only takes up space while recording,
            so the pill grows open instead of the icon just swapping. */}
        <span
          className={`flex items-center gap-2 overflow-hidden transition-[width,margin] duration-300 ${
            listening ? "ml-2 w-[104px]" : "ml-0 w-0"
          }`}
        >
          <span className="flex items-center gap-0.5" aria-hidden>
            {VOICE_BAR_PEAKS.map((peak, i) => (
              <span
                key={i}
                className={`w-0.5 rounded-full bg-current ${listening ? "animate-voice-bar" : ""}`}
                style={{
                  height: 3,
                  ["--voice-bar-peak" as string]: `${peak}px`,
                  animationDelay: `${i * 90}ms`,
                }}
              />
            ))}
          </span>
          <span className="type-timestamp-sm w-9 tabular-nums">
            {formatTime(elapsed)}
          </span>
        </span>
      </button>
      {error && (
        <span className="type-timestamp-sm text-[var(--color-error)]">{error}</span>
      )}
    </div>
  );
}
