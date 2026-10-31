# Aster

**A voice and camera-gesture assistant for your Mac.** A technical command center, local conversation, neural speech, tasks and reminders, and explicit controls for apps, websites and writing.

**0.4 preview · Apple Silicon · macOS 15 or later.** This is an experimental community build, not universal or error-free computer control. Intel Macs, Windows and Linux are not supported. See [validation](VALIDATION.md) for what has actually been tested.

## Get started

If a packaged preview is available under [Releases](https://github.com/kishann-19/Aster-System_Assistant/releases), download `Aster-Mac.zip`, verify its SHA-256 checksum, extract it and place Aster in Applications before granting permissions. Current builds are ad hoc signed and **not Apple-notarized**; a friction-free public installation is still pending Developer ID signing and notarization. Do not disable macOS security protections. Building from source is available below.

Open Aster, then **Settings → Setup & permissions** (or say “Show setup”). Enable voice, review Accessibility for typing/clicks/gestures, and enable Screen & System Audio Recording only if you use captures. On a new Mac, the **Install local conversation model** button downloads Ollama and Qwen 3.5 4B. Allow roughly 6 GB of free space and internet access for setup. No subscription or API key is required. Camera processing and Kokoro voice generation run locally.

## Try saying

| You say | Aster does |
| --- | --- |
| Open YouTube / Open example.com in Safari | Opens the website |
| Open browser and search for C tutorials | Opens a web search |
| Open Notes / Open WhatsApp | Opens an app or service |
| Show controls, then Click 3 | Lists and activates labeled app controls |
| Type I will be there soon | Types into the focused normal text field |
| Start dictation | Inserts each spoken utterance into the same field |
| Stop dictation | Returns to conversation and commands |
| Command press Enter | Operates a key while in dictation mode |
| Take a screenshot / SS | Saves the primary screen as PNG |
| Start screen recording / Stop recording | Records and saves silent MP4, up to ten minutes |
| Open captures | Shows Pictures/Aster Captures |
| Call Alex / Confirm call | Resolves a contact, reads back, hands off to the phone app |
| WhatsApp Alex saying I will be late | Reviews a recipient/message before opening a draft |
| Confirm WhatsApp | Opens the WhatsApp draft; review it before saying Click Send |
| Write an email to Alex about tomorrow’s meeting | Drafts with the local model; asks for review |
| Email to alex@example.com subject Hello saying How are you? | Prepares an exact email draft |
| Confirm email | Opens it in the default mail app; it is not sent automatically |
| Lock my screen | Requests the Mac lock shortcut |
| Enable Mac gestures / Stop gestures | Starts or stops camera-based Mac control |
| Next desktop / Zoom in | Sends the corresponding Mac/app shortcut |
| Tell me a joke / Let’s chat / Help me think this through | Has a casual conversation using the local model |

Say **“Go to sleep”**, then **“Aster, wake up”** or clap/snap twice for a greeting. Sound wake is experimental: sharp noises can trigger it and quiet snaps may be missed. It works only while Aster is running in standby with its microphone on, on an awake/unlocked Mac. Sensitivity and single/double sound options are in Settings.

Speech input pauses while Aster prepares or speaks a reply; wait for **Listening**. “Stop listening” turns the microphone off. Restart it with the voice button. During dictation, ordinary phrases are literal text; prefix a control with **“Command”**. Dictation stops if the target field changes. It is not suitable for passwords or terminal commands.

## Hand gestures

Enable the camera, then **Enable whole-Mac control**. Accessibility permission is required. Use good light and keep your hand in view.

| Gesture | Result |
| --- | --- |
| Point with index finger | Move the primary-display cursor |
| Quick thumb–index pinch, then relax slightly | Tap/click |
| Two quick pinches | Double click |
| Hold a pinch for about 0.4 seconds, then move | Drag; release to drop |
| Index + middle fingers raised, move vertically | Scroll |
| Pinch with both hands, spread/close the hands | App zoom in/out via Command-plus/minus |
| Fully open palm, swipe sideways | Cancels tap/drag, then previous/next desktop via Control-arrow |
| Closed fist | Pause pointer movement |

Zoom depends on app shortcuts; desktop switching depends on Mission Control shortcuts and existing desktops. These are not native multi-touch trackpad events. Control is limited to the primary display. A watchdog releases a held mouse button if tracking/renderer events stop. Camera tracking and clap/snap accuracy require calibration and live testing on each Mac.

## Accounts and limits

WhatsApp uses its web app and requires sign-in. Email drafts use your default mail app. Contacts access is requested for name lookup; direct addresses/numbers work without it. Phone calls require [Apple’s iPhone/Mac calling setup](https://support.apple.com/en-ca/102405) and may have a final macOS prompt. Incoming-call detection, call transcription, WhatsApp history sync and automatic sending are not implemented. Apple Mail, Calendar and Reminders provide requested read-only summaries. Cloud LLM providers are not connected.

Some apps do not expose usable Accessibility controls; Apple Voice Control can be a fallback after its separate setup. Aster cannot bypass permission dialogs, unlock your Mac, operate every app, or guarantee accurate voice/gesture interpretation. Explicit Enter/click actions may submit a form or message. Review the active target.

**Stop controls:** Escape in Aster or Command-Shift-Escape globally. This also requests recording finalization. Closing Aster hides it; hands-free voice can continue if enabled. Quitting stops Aster reminders until next launch. No login item is installed.

## Build from source

Install Node.js 22.12+ and Apple Command Line Tools on an Apple Silicon Mac, then run in this folder:

```sh
npm ci
npm run setup
npm test
npm run desktop
```

`npm run setup` downloads Electron, the hand tracker and neural voice assets and compiles the Swift bridge. It does not grant OS permissions. For local conversation use the in-app installer, or `npm run setup-ai`.

```sh
npm run dev       # Browser preview at http://127.0.0.1:5173
npm run package   # Build release/Aster-darwin-arm64/Aster.app
node scripts/archive.mjs # ZIP and SHA-256 checksum
```

The browser preview supports the dashboard, tasks and local AI/voice service; native Mac control requires the desktop app. The GitHub workflow builds downloadable preview artifacts on an Apple Silicon runner. Version tags publish prereleases.

## Project

React/Vite UI → isolated Electron IPC → Swift bridges for Speech, Accessibility, ScreenCaptureKit and Apple services. The local LLM proposes only allowed commands. Direct typing, capture, communication and locking use explicit command grammar. No arbitrary shell tool is exposed.

- [Detailed commands and integration notes](docs/COMMANDS.md)
- [Privacy and permissions](docs/PRIVACY.md)
- [Validation and remaining live checks](VALIDATION.md)
- [Build/release guide](docs/RELEASING.md)
- [Security](SECURITY.md) · [Third-party notices](THIRD_PARTY_NOTICES.md) · [MIT license](LICENSE)
