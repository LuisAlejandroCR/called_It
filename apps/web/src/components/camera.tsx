import { useEffect, useRef, useState } from "react";
import type { Call } from "@/lib/review";

export function Camera({ call, onCapture }: { call: Call; onCapture: (sample?: object) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const mounted = useRef(false);
  const [status, setStatus] = useState("Camera is off. Allow access only when ready.");
  const [active, setActive] = useState(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; stream.current?.getTracks().forEach(t => t.stop()); }; }, []);
  const start = async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("Camera unavailable in this browser or context.");
      const s = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      if (!mounted.current) { s.getTracks().forEach(t => t.stop()); return; }
      stream.current?.getTracks().forEach(t => t.stop()); stream.current = s;
      if (video.current) { video.current.srcObject = s; await video.current.play(); }
      setActive(true); setStatus("Camera on. Capture checks only the selected zone.");
    } catch (error) { stream.current?.getTracks().forEach(t => t.stop()); stream.current = null; setActive(false); const name = typeof error === "object" && error !== null && "name" in error && typeof error.name === "string" ? error.name : "UnknownError"; setStatus(`Camera could not start (${name}). Use UNKNOWN without camera.`); }
  };
  const capture = async () => {
    try {
      const v = video.current; if (!v || !v.videoWidth || !v.videoHeight || !stream.current?.active) throw new Error();
      const canvas = document.createElement("canvas"); canvas.width = 128; canvas.height = 128;
      const ctx = canvas.getContext("2d", { willReadFrequently: true }); if (!ctx) throw new Error();
      const z = call.zone; if (z.w * v.videoWidth < 16 || z.h * v.videoHeight < 16 || stream.current.getVideoTracks().length !== 1 || stream.current.getVideoTracks().some(t => t.muted || t.readyState !== "live")) throw new Error("Insufficient camera input"); const capturedAt = new Date().toISOString();
      ctx.drawImage(v, z.x * v.videoWidth, z.y * v.videoHeight, z.w * v.videoWidth, z.h * v.videoHeight, 0, 0, 128, 128);
      const pixels = ctx.getImageData(0, 0, 128, 128).data; let red = 0, light = 0;
      for (let i = 0; i < pixels.length; i += 4) { const r = pixels[i]!, g = pixels[i + 1]!, b = pixels[i + 2]!; if (r >= 150 && r > g * 1.4 && r > b * 1.4) red++; light += (r + g + b) / 3; }
      const digest = await crypto.subtle.digest("SHA-256", pixels); const hash = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join("");
      onCapture({ kind: "red-pixel-v1", count: 16384, red, meanLight: light / 16384, hash, capturedAt });
    } catch { setStatus("Capture failed. Sending UNKNOWN without camera."); onCapture(); }
  };
  return <section className="surface p-4 space-y-3" aria-label="Camera demo">
    <h2 className="font-bold">Camera · red pixel demo</h2><p className="text-sm">Ask whether at least 20% of the selected zone is strongly red. This is an uncalibrated demo, not object recognition.</p>
    <div className="relative aspect-video bg-foreground"><video ref={video} className="w-full h-full object-fill" playsInline muted /><div className="absolute border-2 border-zone pointer-events-none" style={{ left: `${call.zone.x * 100}%`, top: `${call.zone.y * 100}%`, width: `${call.zone.w * 100}%`, height: `${call.zone.h * 100}%` }} /></div>
    <p role="status" className="text-sm">{status}</p>
    <div className="flex flex-wrap gap-2"><button className="rounded-lg border px-3 py-2" onClick={() => void start()}>Enable camera</button><button className="rounded-lg bg-primary text-white px-3 py-2 disabled:opacity-50" disabled={!active || call.status !== "awaiting_suggestion"} onClick={() => void capture()}>Capture zone</button></div>
    <p className="text-xs">Pixels stay in this browser; only aggregate measurements, capture time and hash are sent to the local server. Local input can be forged.</p>
  </section>;
}





