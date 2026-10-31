# Aster 0.4 preview validation

Review date: 31 October 2026. Development host: Apple Silicon (M4), macOS 27. The app targets Apple Silicon Macs running macOS 15 or later. Results below describe this development host unless stated otherwise.

This is a preview with explicit command handlers, not a verified replacement for every keyboard/mouse workflow. An automated test, successful compilation, or an app's success message alone does not establish that a real app action completed.

## Verified for the 0.4 source

- **33 automated Node tests pass.** Coverage includes command parsing and rejection of negated/explanatory input, bounded Mac operations, website policy, reminder handling, local model request/output validation, dictation escaping, exact email drafts, contact choices and confirmation-token expiry/single use, and gesture state transitions.
- Gesture tests use synthetic landmarks and timed events. They cover tap/double tap, drag/release, tracking loss, two-hand zoom, scrolling, palm swipes, fist precedence and palm cancellation. They do not measure a real camera, hand accuracy, pointer ergonomics or app shortcut behavior.
- The production renderer build and Swift bridge compilation passed. The minimum native deployment target is macOS 15 for ScreenCaptureKit recording support.
- The final 0.4 app was rebuilt from the tested source and its ad hoc code signature verified. The app ZIP and SHA-256 checksum were generated. This establishes local integrity, not Apple notarization or a clean-machine installation test.
- Downloaded hand-tracker and neural-voice assets passed their recorded SHA-256 checks. The production dependency audit reported no known vulnerabilities at the time of the check; this is not an independent security audit.
- Source/distribution review found no embedded user workspace, personal absolute home path, cloud API credential or private key in the inspected source files. Generated models, dependencies, builds, captures and private workspace files are excluded from the source repository. Recheck the actual release archive before publishing.

## Live checks completed on the development Mac

- Entering **Open example.com** in the desktop app opened the Example Domain page in the default Dia browser; both the destination address and page were observed.
- Local Ollama listed Qwen 3.5 4B. A real conversational request returned a casual joke with no action, and an email-drafting request returned a subject/body. No email was sent.
- The packaged app's setup panel displayed permission/model status and the connected local model.
- A typing request while Accessibility was unavailable returned the missing-permission error. This verifies the failure path, not successful native typing.

## Remaining release and live checks

- Accessibility and Screen Recording entries were refreshed for the final packaged identity; the setup UI reports Accessibility authorized. Successful text insertion, focused-field dictation, labeled clicks, browser keys, app switching and desktop shortcuts still need live verification. Ad hoc rebuilds can invalidate permission identity.
- Verify a newly requested screenshot exists and is a valid PNG. A prior screenshot success message was observed, but its file was unavailable during later inspection; that does not count as a completed capture validation.
- Start and stop a short screen recording, verify a playable nonempty MP4, and exercise finalization on stop/quit. No completed recording validation is recorded here.
- Test microphone transcription, neural voice audibility, casual conversations, clap/snap wake false triggers/misses and recovery after interruption with the final package. Earlier voice builds generated and played valid local audio, but that is not a new full-session test of 0.4.
- Test real hands in varied lighting for move, tap, double tap, drag/drop, scrolling, zoom, fist pause, desktop switching, loss-of-tracking release and emergency stop. Synthetic tests do not complete these checks.
- Test Contacts permission and ambiguous names, Apple Mail/Calendar/Reminders reads, WhatsApp sign-in/draft display, email draft handoff and configured iPhone/Mac calling. No real message/email was sent and no call was placed for this validation.
- Run the committed GitHub workflow from a clean checkout and verify the published artifact and its checksum. A local package is not evidence of a successful remote build or published download.
- Test first-run setup, model installation/cancellation, permission onboarding, restart/persistence and upgrades on a separate clean Mac. Developer ID signing, hardened-runtime/entitlement review, Apple notarization and Gatekeeper installation testing remain pending.

## Current boundaries

Only Apple Silicon/macOS is supported. Intel Macs, Windows and Linux have not been built or tested. Gesture control uses the primary display and fixed keyboard shortcuts for zoom/desktops. Screen recordings contain video only and have a ten-minute limit. Recognition/model interpretation can be wrong, and some applications do not expose usable Accessibility controls.

Calls are handed to the Mac's configured phone handler; WhatsApp and email open drafts after recipient review/confirmation. There is no automatic message sending, incoming-call monitoring, call transcription, WhatsApp history sync, cloud LLM adapter, two-way Apple Reminders sync or Apple Calendar writing. Explicit click/Enter commands can submit a visible form or message. Account readers run on request after permission.

Aster reminders require Aster to be running, with overdue reminders checked on its next run. Wake requires the app/microphone to remain active on an awake, unlocked Mac. No login item is installed. Permission dialogs and unlocking remain user-controlled.
