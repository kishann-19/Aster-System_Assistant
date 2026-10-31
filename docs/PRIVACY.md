# Privacy and permissions

Aster is an opt-in Mac controller. It does not bypass macOS permissions.

- Microphone and Apple Speech: commands and experimental clap/snap wake while listening. Apple may process audio if on-device recognition is unavailable. Aster does not save microphone recordings.
- Camera: MediaPipe processes hand landmarks locally. Aster does not upload or save camera video.
- Accessibility: discovers labeled controls in the frontmost window and posts explicitly requested keyboard/mouse actions. Secure fields and standalone Terminal/iTerm/Warp dictation are excluded. This is not a general security boundary for arbitrary third-party apps.
- Screen & System Audio Recording: screenshots and video only after an explicit command. Videos contain no microphone or system audio. Captures are stored in `~/Pictures/Aster Captures/`, are not uploaded, and may contain sensitive visible information.
- Contacts: resolves a name for calls, WhatsApp or email drafts only when requested. Several matches require selection. Requests expire in two minutes.
- Calendar, Reminders and Mail Automation: on-demand read-only summaries. No calendar writing or automatic email sending.

Tasks, reminders, settings and recent conversation are plaintext under `~/Library/Application Support/aster-assistant/workspace.json`. User data, captures, credentials and model weights are excluded from Git. No passwords, cloud API credentials or login cookies are requested by Aster; sign-ins remain in the browser or mail app.

The local Ollama API listens on `127.0.0.1:11434`. Recent conversation, including any account summary the user asked Aster to read aloud, may be sent to that local model. It is not an internet-facing service and is not authenticated against other local processes. The development preview also exposes local AI/voice routes with host/origin checks. Do not expose either service to a network.

Downloads during setup: official Ollama engine and model, Google Hand Landmarker, and Kokoro voice assets from Hugging Face. Browser searches, website visits, WhatsApp links and mail drafts contact their respective services when requested. There is no Aster analytics service.

“Stop listening” turns off microphone input. “Stop gestures” stops the camera and pointer. “Stop recording” saves the recording. Escape in Aster or Command-Shift-Escape globally stops active controls and requests recording finalization. Quit ends Aster; the local Ollama server can remain running until the Mac restarts.
