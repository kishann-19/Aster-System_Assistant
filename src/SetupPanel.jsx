import React, { useState, useEffect } from "react";
import { X, Check, ArrowUpRight, Download, ShieldCheck } from "lucide-react";
export default function SetupPanel({
  stats,
  aiStatus,
  onClose,
  onVoice,
  onCommand,
  onModels,
}) {
  const [progress, setProgress] = useState(null),
    [working, setWorking] = useState(false),
    [error, setError] = useState("");
  useEffect(() => window.aster?.onSetup(setProgress), []);
  const install = async () => {
    setWorking(true);
    setError("");
    try {
      await window.aster.setupAI();
      await onModels();
    } catch (e) {
      setError(
        e.message.replace(
          /^Error invoking remote method '[^']+': (?:Error: )?/,
          "",
        ),
      );
    } finally {
      setWorking(false);
    }
  };
  return (
    <div className="setup-overlay">
      <section
        className="setup-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="setup-title"
      >
        <button
          className="icon-button setup-close"
          aria-label="Close setup"
          onClick={onClose}
        >
          <X />
        </button>
        <span className="module-tag">WELCOME TO ASTER · MAC EDITION</span>
        <h2 id="setup-title">Make this Mac yours to command.</h2>
        <p>
          A one-time setup, then use your voice and hands. macOS requires you to
          approve its permission dialogs yourself.
        </p>
        <div className="setup-step">
          <span>01</span>
          <div>
            <h3>Voice & conversation</h3>
            <p>
              Microphone + Speech Recognition for commands. The local model
              handles casual chat, jokes, explanations and email drafting.
            </p>
            <button className="soft-button" onClick={onVoice}>
              {stats?.microphone === 3 && stats?.speech === 3
                ? "Start voice"
                : "Enable voice"}{" "}
              <ArrowUpRight size={14} />
            </button>
            {aiStatus === "ready" ? (
              <small className="setup-ready">
                <Check size={14} /> Local model connected
              </small>
            ) : (
              <>
                <p className="fine-print">
                  Apple Silicon · allow about 6 GB free disk space and a stable
                  connection. The model downloads from Ollama. No subscription
                  or API key.
                </p>
                <button
                  className="soft-button"
                  disabled={working || !window.aster}
                  onClick={install}
                >
                  <Download size={14} />
                  {working ? "Installing…" : "Install local conversation model"}
                </button>
                {working && (
                  <button
                    className="text-button"
                    onClick={() => window.aster.cancelSetup()}
                  >
                    Cancel download
                  </button>
                )}
              </>
            )}
            {progress && (
              <p role="status">
                {progress.message}
                {progress.percent != null ? " " + progress.percent + "%" : ""}
              </p>
            )}
            {error && (
              <p role="alert" className="setup-error">
                {error}
              </p>
            )}
          </div>
        </div>
        <div className="setup-step">
          <span>02</span>
          <div>
            <h3>Typing, clicks & hand control</h3>
            <p>
              {stats?.accessibility
                ? "Accessibility is authorized."
                : "Enable Aster in Privacy & Security → Accessibility."}{" "}
              Camera permission is requested when you enable gestures.
            </p>
            <button
              className="soft-button"
              onClick={() => onCommand("Enable computer control")}
            >
              Review computer control <ArrowUpRight size={14} />
            </button>
          </div>
        </div>
        <div className="setup-step">
          <span>03</span>
          <div>
            <h3>Screen tools & your apps</h3>
            <p>
              {stats?.screenCapture
                ? "Screen capture is authorized."
                : "Screenshots and recordings need Screen & System Audio Recording permission."}{" "}
              Sign in to WhatsApp and your mail app normally. Contact-name
              lookup asks for Contacts access when first used. Phone calls need
              your iPhone calling setup.
            </p>
            <button
              className="soft-button"
              onClick={() => onCommand("Open screen recording settings")}
            >
              Open screen permissions <ArrowUpRight size={14} />
            </button>
          </div>
        </div>
        <p className="fine-print">
          <ShieldCheck size={14} /> Camera processing, speech replies and the
          model run locally. Speech recognition may use Apple’s service if
          on-device recognition is unavailable. Camera and recording start only
          when requested. “Stop listening” turns the microphone off.
        </p>
        <button className="primary-button" onClick={onClose}>
          Open command center <ArrowUpRight size={15} />
        </button>
      </section>
    </div>
  );
}
