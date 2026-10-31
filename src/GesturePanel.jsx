import React, { useEffect, useRef, useState } from "react";
import { Hand, MousePointer2 } from "lucide-react";
import { classifyHand } from "./gestures.mjs";
import { createGestureEngine } from "./gesture-engine.mjs";

export default function GesturePanel({
  active,
  setActive,
  system,
  onArm,
  stopToken,
  onError,
}) {
  const video = useRef(null),
    canvas = useRef(null),
    cursor = useRef(null),
    systemRef = useRef(system),
    engineRef = useRef(null);
  const [status, setStatus] = useState("Camera is off");
  useEffect(() => {
    systemRef.current = system;
    engineRef.current?.reset();
    window.aster?.pointer({ kind: "release" });
  }, [system]);
  useEffect(() => {
    if (stopToken) setActive(false);
  }, [stopToken]);
  useEffect(() => {
    if (!active) {
      setStatus("Camera is off");
      return;
    }
    let disposed = false,
      stream,
      detector,
      frame,
      last = 0,
      lastVideo = -1,
      identity = null,
      appDrag = null;
    let smooth = { x: 0.5, y: 0.5 };
    const engine = createGestureEngine();
    engineRef.current = engine;
    const clean = () => {
      cancelAnimationFrame(frame);
      stream?.getTracks().forEach((t) => t.stop());
      detector?.close();
      engine.reset();
      window.aster?.pointer({ kind: "release" });
      if (cursor.current) cursor.current.style.display = "none";
    };
    const dispatch = (e) => {
      if (systemRef.current) {
        window.aster?.pointer(e);
        return;
      }
      const x = (e.x ?? smooth.x) * innerWidth,
        y = (e.y ?? smooth.y) * innerHeight,
        target = document.elementFromPoint(x, y);
      if (e.kind === "move" && cursor.current) {
        cursor.current.style.display = "block";
        cursor.current.style.transform = `translate(${x}px,${y}px)`;
      }
      if (e.kind === "click") {
        const el = target?.closest("button,a,input,select,textarea");
        el?.focus();
        el?.click();
      }
      if (e.kind === "doubleClick")
        target?.dispatchEvent(
          new MouseEvent("dblclick", {
            bubbles: true,
            clientX: x,
            clientY: y,
            detail: 2,
          }),
        );
      if (e.kind === "scroll") {
        let el = target;
        while (el && el.scrollHeight <= el.clientHeight + 1)
          el = el.parentElement;
        (el || document.scrollingElement)?.scrollBy(0, -e.delta);
      }
      if (e.kind === "down") appDrag = target;
      if (e.kind === "up") appDrag = null;
      // OS dragging, zoom and desktop switching require the armed Mac bridge.
    };
    async function start() {
      try {
        setStatus("Starting camera…");
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480, frameRate: 24 },
          audio: false,
        });
        if (disposed) {
          clean();
          return;
        }
        video.current.srcObject = stream;
        await video.current.play();
        setStatus("Loading hand tracker…");
        const { HandLandmarker, FilesetResolver } = await import(
          "@mediapipe/tasks-vision"
        );
        const files = await FilesetResolver.forVisionTasks(
          new URL("./wasm", document.baseURI).href,
        );
        const options = {
          baseOptions: {
            modelAssetPath: new URL(
              "./models/hand_landmarker.task",
              document.baseURI,
            ).href,
            delegate: "GPU",
          },
          runningMode: "VIDEO",
          numHands: 2,
          minHandDetectionConfidence: 0.65,
          minTrackingConfidence: 0.65,
        };
        try {
          detector = await HandLandmarker.createFromOptions(files, options);
        } catch {
          options.baseOptions.delegate = "CPU";
          detector = await HandLandmarker.createFromOptions(files, options);
        }
        if (disposed) {
          clean();
          return;
        }
        const run = (now) => {
          if (disposed) return;
          frame = requestAnimationFrame(run);
          if (
            now - last < 42 ||
            !video.current ||
            video.current.currentTime === lastVideo
          )
            return;
          last = now;
          lastVideo = video.current.currentTime;
          try {
            const result = detector.detectForVideo(video.current, now),
              ctx = canvas.current?.getContext("2d");
            ctx?.clearRect(0, 0, 640, 480);
            const tracked = result.landmarks.map((points, i) => ({
              points,
              label: result.handedness[i]?.[0]?.categoryName || String(i),
            }));
            if (identity && tracked.length) {
              const n = tracked.findIndex((h) => h.label === identity);
              if (n < 0) {
                engine.reset().forEach(dispatch);
                identity = null;
              } else if (n > 0)
                [tracked[0], tracked[n]] = [tracked[n], tracked[0]];
            }
            if (tracked.length) identity = tracked[0].label;
            for (const { points } of tracked)
              if (ctx) {
                ctx.strokeStyle = "#68eaff";
                ctx.lineWidth = 2;
                for (const [a, b] of [
                  [0, 1],
                  [1, 2],
                  [2, 3],
                  [3, 4],
                  [0, 5],
                  [5, 6],
                  [6, 7],
                  [7, 8],
                  [5, 9],
                  [9, 10],
                  [10, 11],
                  [11, 12],
                  [9, 13],
                  [13, 14],
                  [14, 15],
                  [15, 16],
                  [13, 17],
                  [17, 18],
                  [18, 19],
                  [19, 20],
                  [17, 0],
                ]) {
                  ctx.beginPath();
                  ctx.moveTo((1 - points[a].x) * 640, points[a].y * 480);
                  ctx.lineTo((1 - points[b].x) * 640, points[b].y * 480);
                  ctx.stroke();
                }
                for (const p of points) {
                  ctx.beginPath();
                  ctx.arc((1 - p.x) * 640, p.y * 480, 3, 0, 2 * Math.PI);
                  ctx.fillStyle = "#fff";
                  ctx.fill();
                }
              }
            const hands = tracked.map(({ points }) => classifyHand(points));
            if (hands.length) {
              smooth.x += (hands[0].x - smooth.x) * 0.35;
              smooth.y += (hands[0].y - smooth.y) * 0.35;
              hands[0] = { ...hands[0], ...smooth };
            }
            const { events, status: label } = engine.step(hands, now);
            events.forEach(dispatch);
            if (cursor.current && (systemRef.current || !hands.length))
              cursor.current.style.display = "none";
            setStatus(label);
          } catch (e) {
            onError("Hand tracking stopped: " + e.message);
            setActive(false);
            clean();
          }
        };
        frame = requestAnimationFrame(run);
      } catch (e) {
        if (!disposed) {
          onError(
            e.name === "NotAllowedError"
              ? "Allow Aster camera access in your privacy settings."
              : e.message,
          );
          setActive(false);
        }
        clean();
      }
    }
    start();
    return () => {
      disposed = true;
      clean();
    };
  }, [active]);
  return (
    <section className="gesture-card">
      <div className="section-line">
        <span>
          <Hand size={15} /> HAND CONTROL
        </span>
        <button
          className={"switch " + (active ? "on" : "")}
          role="switch"
          aria-checked={active}
          aria-label="Hand control"
          onClick={() => setActive(!active)}
        >
          <i />
        </button>
      </div>
      <div className={"camera-box " + (active ? "live" : "")}>
        <video ref={video} muted playsInline />
        <canvas ref={canvas} width="640" height="480" />
        {!active && (
          <div className="camera-empty">
            <Hand size={32} strokeWidth={1} />
            <span>Your hand. Your cursor.</span>
            <small>Enable camera to begin</small>
          </div>
        )}
        {active && (
          <span className="camera-live">
            <i /> LIVE · LOCAL
          </span>
        )}
      </div>
      <div className="camera-status">
        <span className={"status-dot " + (active ? "green" : "")} />
        {status}
      </div>
      <div className="gesture-legend">
        <span>
          <MousePointer2 size={13} /> Point
        </span>
        <span>👌 Tap / hold</span>
        <span>Ⅱ Scroll</span>
      </div>
      {active && (
        <>
          <button
            className={"soft-button " + (system ? "armed" : "")}
            onClick={onArm}
          >
            {system ? "Mac control armed · disarm" : "Enable whole-Mac control"}
          </button>
          <small className="gesture-help">
            Pinch, relax slightly: tap. Twice: double tap. Hold: drag. Two pinches: zoom.
            Full palm: cancel / swipe desktops. Fist: pause.
          </small>
        </>
      )}
      <div className="gesture-cursor" ref={cursor} />
    </section>
  );
}
