# Extended command reference

See [README](../README.md) for the 0.4 screen, dictation, email and gesture additions. The controls below remain available.

## Voice controls

| Say | Result |
| --- | --- |
| Show dashboard / tasks / conversation / system / models / settings | Navigate Aster |
| Show commands / Close panel | Open or dismiss the reference |
| Add task finish my prototype | Save a task |
| Focus on finish my prototype | Select it and start a 25-minute timer |
| Complete current task / Complete task finish my prototype | Mark it complete |
| Read my tasks / Read my reminders / Read my notifications | Speak saved Aster items |
| Remind me to stretch in 20 minutes | Schedule an Aster reminder |
| Open Safari / Open Notes / Open Google Chrome | Launch a registered/common installed Mac application |
| Open YouTube / Open example.com in Chrome | Open that website in the default or named browser |
| Open Chrome and search for Mac tips / Search YouTube for C tutorials | Search Google or YouTube directly |
| Show controls / Click 3 / Click Send | List labeled controls in the frontmost app, then activate one |
| Type I will be there soon / Press Enter / Press Tab | Dictate into the focused text field, then operate keys |
| Call NAME / Call NUMBER | Resolve a contact/number, read it back, then wait for Confirm call |
| WhatsApp NAME saying MESSAGE | Prepare a recipient and message; Confirm WhatsApp opens a draft |
| Choose contact 2 / Confirm call / Confirm WhatsApp / Cancel | Select, confirm, or cancel a pending request |
| Enable clap wake / Set wake sensitivity to high / Set wake mode to single | Adjust sound wake by voice |
| Set volume to 40 percent / Mute speakers / Unmute speakers | Change Mac sound |
| Open sound / displays / Wi-Fi / Bluetooth / battery / keyboard settings | Open a System Settings panel |
| Next tab / Previous tab / New tab / Go back / Go forward / Reload page | Navigate the frontmost supported browser; Accessibility required |
| Scroll down / Scroll up | Scroll the frontmost supported browser; Accessibility required |
| System status | Read real Mac telemetry |
| Read calendar / Read mail / Sync reminders | Read permitted Apple services |
| Open WhatsApp / Gmail / Calendar | Open the service shortcut |
| Search for a topic | Open a browser search |
| Change your voice to George / Heart / Bella / Emma / Michael | Choose a local neural voice |
| Speak slower / Speak faster / Speak normally | Adjust speaking pace |
| List models / Use Qwen model | Discover or switch installed Ollama models |
| Open voice control settings | Open Apple's setup for system-wide clicking and dictation |

The local model also interprets conversational phrasing, such as “Could you bring up my task list please?” It returns at most one supported command, validated against the same command grammar. It cannot run arbitrary shell commands. Ambiguous or unsupported requests get a reply instead. Voice recognition and model intent can be imperfect; review the visible result. The model has no screen-reading access.

## Across the whole Mac

Aster now implements its own Accessibility-based “Show controls”, “Click”, “Type” and key commands. Activate another app by voice, then use these commands while it remains frontmost. “Type” inserts text without Enter; “Press Enter” or “Click Send” can submit it. Secure fields and standalone Terminal/iTerm/Warp are excluded. The Mac must be unlocked. Control numbers expire after 45 seconds and must be refreshed after changing windows. Some applications do not expose usable Accessibility controls. For those apps, enable **System Settings → Accessibility → Voice Control** as a fallback. Apple's commands include “Show numbers”, “Click 12”, and “Show commands”. Say “Aster, go to sleep” while using Apple Voice Control so ordinary commands are ignored by Aster. Coexistence and microphone behavior need a live check on your configuration; both speech systems may compete for input.

For Aster's typing, clicks, browser keys and camera pointer, allow **Aster** (or its **AsterBridge** helper if listed) under **Privacy & Security → Accessibility**. Aster can open the settings; it cannot approve its own access or bypass macOS dialogs.

Microphone, Speech Recognition, Camera, Calendar, Reminders and Mail Automation each have separate permissions. Camera is off by default. Enable it only for hand gestures. Mac pointer control remains separately armed and uses the primary display. Camera frames stay on device.

## What is actually connected

- **Qwen 3.5 4B / Ollama:** install it through Setup & permissions on a new Mac. Aster discovers the local engine and uses the selected model for conversation and interpreting supported requests. Other locally installed Ollama models appear in the model selector. One model runs at a time.
- **Kokoro neural voice:** bundled and synthesized locally. Heart is the default; four alternatives and installed system voices are available. First use may take a few seconds to load.
- **Telemetry:** actual CPU usage sampled between polls, used/total memory including cache, battery/power source, uptime, chip, and (desktop only) foreground app name. These are not fabricated statistics. Unavailable readings display a dash.
- **Apple Calendar, Reminders and Mail:** readers run only when requested and after authorization. Calendar shows seven days, Reminders shows incomplete items, and Mail shows unread subjects/senders. No two-way sync or sending.
- **WhatsApp:** opens the web app and supports contact-based draft links. “WhatsApp Alex saying Hello” requests Contacts access if needed, reads back the target/message, and waits for “Confirm WhatsApp”. It then opens a prefilled draft; it does not automatically press Send. Review the target chat and say “Click Send” to submit through app controls. Full international numbers are recommended. A browser sign-in is required.
- **Gmail:** opens the official web app; typing/click commands can operate accessible controls after sign-in. No Gmail API or inbox-body reader is connected.
- **Calls:** “Call Alex” looks up Apple Contacts (permission required); a full number also works without Contacts. If there are several numbers, say “Choose contact 2”. “Confirm call” hands the number to the Mac’s phone handler. Cellular calling requires an appropriately configured iPhone and Mac. macOS may present a final call prompt. Aster does not claim that opening the handler means the call connected. Accessible Answer/End buttons may be operated with explicit click commands; incoming-call detection and transcription are not implemented.
- **Cloud LLMs:** no OpenAI, Claude or Gemini credentials are configured, and this build has no cloud-provider adapters. They are shown as not connected. Do not paste secrets into voice/chat.

Aster's own tasks, reminders and chat persist locally. Reminders alert while Aster is running; overdue reminders are delivered when it resumes. Closing the red window button hides the app and stops camera/pointer control. Voice stays available if Hands-free is enabled; otherwise it stops. Say “Show Aster” to bring the window back. Reminder delivery continues. Quitting stops reminders until the next launch. No login item or background startup service is installed. The notification panel contains Aster's alerts, not every notification on the Mac.

