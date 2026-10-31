# Build and release

Use an Apple Silicon Mac with macOS 15+, Node 22.12+ and Apple Command Line Tools.

```
npm ci
npm run setup
npm test
npm run package
node scripts/archive.mjs
```

`release/Aster-Mac.zip` contains the app, native helper, hand tracker and neural voice. Ollama and the several-GB conversation model install from Aster's setup panel on the recipient's machine. No personal workspace is bundled.

The GitHub workflow runs tests/builds on a fresh Apple Silicon runner and uploads a ZIP and SHA-256 checksum. A `v*` tag publishes a **prerelease**. Do not promote to a stable release until the live checks in VALIDATION pass on clean machines. A successful compilation is not proof that permissions, speech, gestures, calls or screen capture work on another Mac.

Current packages use ad hoc signing for local integrity. Developer ID signing and Apple notarization are not configured. A smooth public installation requires an Apple Developer signing identity, hardened runtime/entitlement review, notarization, and a clean-machine Gatekeeper test. Do not ask users to disable Gatekeeper or strip quarantine attributes. They can instead build from the reviewed source until a notarized download is available.

Keep the app in `/Applications` before granting permissions. Replacing ad hoc builds can invalidate permission identity. Retest after upgrades. Intel, Windows and Linux distributions are not currently supported.
