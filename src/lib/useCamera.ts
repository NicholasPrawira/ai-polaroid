"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type Facing = "user" | "environment";
export type Zoom = 1 | 2 | 3;

const CAPTURE_SIZE = 1024;

export function useCamera() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [facing, setFacing] = useState<Facing>("environment");
  const [zoom, setZoom] = useState<Zoom>(1);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function start() {
      setReady(false);
      setError(null);

      streamRef.current?.getTracks().forEach((t) => t.stop());

      if (!navigator.mediaDevices?.getUserMedia) {
        setError(
          "This browser can't open the camera. getUserMedia needs a secure context (https or localhost).",
        );
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: facing,
            width: { ideal: 1920 },
            height: { ideal: 1920 },
          },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        setReady(true);
      } catch (err) {
        if (cancelled) return;
        const name = err instanceof Error ? err.name : "";
        setError(
          name === "NotAllowedError"
            ? "Camera permission was denied. Allow access in your browser settings, then reload."
            : name === "NotFoundError"
              ? "No camera found on this device."
              : "Could not start the camera.",
        );
      }
    }

    start();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [facing]);

  const flip = useCallback(
    () => setFacing((f) => (f === "user" ? "environment" : "user")),
    [],
  );

  /** Grabs a centre-cropped square frame as a JPEG data URL. Digital zoom
   *  just tightens the crop before scaling up — same region the live
   *  preview shows via its own CSS scale, so the print matches what was
   *  framed on screen. */
  const capture = useCallback((): string | null => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return null;

    const side = Math.min(video.videoWidth, video.videoHeight) / zoom;
    const sx = (video.videoWidth - side) / 2;
    const sy = (video.videoHeight - side) / 2;

    const canvas = document.createElement("canvas");
    canvas.width = CAPTURE_SIZE;
    canvas.height = CAPTURE_SIZE;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    // The preview is mirrored for the selfie cam; un-mirror so the saved photo
    // matches what the lens actually saw.
    if (facing === "user") {
      ctx.translate(CAPTURE_SIZE, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, sx, sy, side, side, 0, 0, CAPTURE_SIZE, CAPTURE_SIZE);

    return canvas.toDataURL("image/jpeg", 0.92);
  }, [facing, zoom]);

  return { videoRef, facing, flip, zoom, setZoom, capture, error, ready };
}
