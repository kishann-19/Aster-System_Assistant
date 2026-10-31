import React, { useState, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import {
  Orbit,
  LayoutDashboard,
  ListTodo,
  MessageSquare,
  PanelsTopLeft,
  Settings,
  ArrowUpRight,
  ArrowUp,
  Plus,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Hand,
  Mail,
  CalendarDays,
  Bell,
  Globe,
  Phone,
  Check,
  ChevronRight,
  Play,
  Pause,
  X,
  CheckCheck,
  Trash2,
  Link2,
  ShieldCheck,
  Command,
  Search,
  LoaderCircle,
  RefreshCw,
  ChevronLeft,
  Sun,
  Clock,
  ExternalLink,
  Focus,
  ArrowRight,
  Power,
} from "lucide-react";
import { parseCommand, createInitialState, dueReminders } from "./commands.mjs";
import GesturePanel from "./GesturePanel";
import SetupPanel from "./SetupPanel";
import { dictationInput } from "./desktop-commands.mjs";
import "./styles.css";
import "./hud.css";
import { Reactor, Telemetry, SystemPanel, CommandGuide } from "./CommandCenter";
import {
  services as localServices,
  chooseVoice,
  spokenText,
  playVoice,
  cancelVoice,
} from "./services.mjs";
const desktop = !!window.aster;
const services = [
  {
    id: "mail",
    name: "Mail",
    subtitle: "Open Gmail in your browser",
    icon: Mail,
    color: "peach",
  },
  {
    id: "whatsapp",
    name: "WhatsApp",
    subtitle: "Open WhatsApp Web",
    icon: MessageSquare,
    color: "mint",
  },
  {
    id: "calendar",
    name: "Calendar",
    subtitle: "Open Google Calendar",
    icon: CalendarDays,
    color: "lilac",
  },
  {
    id: "browser",
    name: "Browser",
    subtitle: "Search and browse",
    icon: Globe,
    color: "blue",
  },
  {
    id: "calls",
    name: "Calls",
    subtitle: "Say Call, followed by a contact or number",
    icon: Phone,
    color: "peach",
  },
  {
    id: "reminders",
    name: "Reminders",
    subtitle: "Open Apple Reminders",
    icon: Bell,
    color: "lilac",
  },
];
const urls = {
  mail: "https://mail.google.com",
  gmail: "https://mail.google.com",
  whatsapp: "https://web.whatsapp.com",
  calendar: "https://calendar.google.com",
  browser: "https://www.google.com",
  reminders: "x-apple-reminderkit://",
  calls: "facetime://",
  facetime: "facetime://",
};
const uid = () => crypto.randomUUID();
const time = (d) =>
  new Date(d).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
const shortDate = (d) =>
  new Date(d).toLocaleDateString([], { month: "short", day: "numeric" });
function App() {
  const [data, setData] = useState(createInitialState),
    [ready, setReady] = useState(false),
    [tab, setTab] = useState("Overview"),
    [now, setNow] = useState(Date.now()),
    [modal, setModal] = useState(null),
    [text, setText] = useState(""),
    [toast, setToast] = useState(""),
    [busy, setBusy] = useState(false),
    [phase, setPhase] = useState("ready"),
    [mic, setMic] = useState(false),
    [partial, setPartial] = useState(""),
    [camera, setCamera] = useState(false),
    [system, setSystem] = useState(false),
    [stopToken, setStopToken] = useState(0),
    [events, setEvents] = useState([]),
    [appleReminders, setAppleReminders] = useState([]),
    [mail, setMail] = useState(null),
    [syncing, setSyncing] = useState(""),
    [syncAt, setSyncAt] = useState({}),
    [models, setModels] = useState([]),
    [activeApp, setActiveApp] = useState(""),
    [trackApp, setTrackApp] = useState(false),
    [voices, setVoices] = useState([]),
    [aiStatus, setAiStatus] = useState("connecting"),
    [stats, setStats] = useState(null),
    [standby, setStandby] = useState(false),
    [uiControls, setUiControls] = useState(null),
    [pendingAction, setPendingAction] = useState(null),
    [setupOpen, setSetupOpen] = useState(false),
    [capture, setCapture] = useState({ phase: "idle" }),
    [dictation, setDictation] = useState(null);
  const dictationRef = useRef(null);
  dictationRef.current = dictation;
  const dataRef = useRef(data),
    commandRef = useRef(),
    wantMic = useRef(false),
    recognition = useRef(null),
    busyRef = useRef(false),
    conversationEnd = useRef(null),
    toastTimer = useRef(null),
    resumeTimer = useRef(null),
    voiceSession = useRef(0),
    standbyRef = useRef(false),
    autoStarted = useRef(false);
  dataRef.current = data;
  busyRef.current = busy;
  standbyRef.current = standby;
  const notify = (message) => {
    setToast(message);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 6500);
  };
  const update = (fn) => setData((prev) => fn(prev));
  useEffect(() => {
    (async () => {
      try {
        const saved = desktop
          ? await window.aster.load()
          : JSON.parse(localStorage.getItem("aster-workspace") || "null");
        if (desktop && saved?.settings?.setupCompleted !== true)
          setSetupOpen(true);
        if (saved?.version === 1)
          setData({
            ...saved,
            settings: {
              ...createInitialState().settings,
              ...saved.settings,
              voiceVersion: saved.settings?.voiceVersion ?? 0,
            },
          });
      } catch {
        notify("Could not read saved data. A new workspace is open.");
      }
      setReady(true);
    })();
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, []);
  useEffect(() => {
    if (!ready) return;
    try {
      if (desktop) window.aster.save(data).catch((e) => notify(e.message));
      else localStorage.setItem("aster-workspace", JSON.stringify(data));
    } catch {
      notify("Your workspace could not be saved.");
    }
  }, [data, ready]);
  async function refreshModels() {
    try {
      setAiStatus("connecting");
      const available = await localServices.models();
      setModels(available);
      setAiStatus(available.length ? "ready" : "empty");
      update((s) => {
        if (s.settings.modelConfigured) return s;
        const preferred =
          available.find((m) => m === "qwen3.5:4b") || available[0];
        return preferred
          ? {
              ...s,
              settings: {
                ...s.settings,
                model: preferred,
                modelConfigured: true,
              },
            }
          : s;
      });
      return available;
    } catch (e) {
      setAiStatus("offline");
      return [];
    }
  }
  useEffect(() => {
    if (!ready) return;
    refreshModels();
    localServices
      .voices()
      .then(({ voices: list }) => {
        setVoices(list);
        update((s) => {
          const v = chooseVoice(
            list,
            s.settings.voiceVersion === 3
              ? s.settings.voiceId
              : "kokoro:af_heart",
          );
          return v
            ? {
                ...s,
                settings: { ...s.settings, voiceId: v.id, voiceVersion: 3 },
              }
            : s;
        });
      })
      .catch(() => {
        notify(
          "The enhanced Mac voice service is unavailable. Reopen the updated app.",
        );
      });
  }, [ready]);
  useEffect(() => {
    if (!ready) return;
    let mounted = true;
    const poll = () =>
      localServices
        .telemetry()
        .then((s) => {
          if (mounted) {
            setStats(s);
            if (s.capturePhase)
              setCapture((prev) => ({ ...prev, phase: s.capturePhase }));
          }
        })
        .catch(() => {
          if (mounted) setStats(null);
        });
    poll();
    const id = setInterval(poll, 5000);
    return () => {
      mounted = false;
      clearInterval(id);
    };
  }, [ready]);
  useEffect(() => {
    if (
      !ready ||
      !desktop ||
      setupOpen ||
      autoStarted.current ||
      !voices.length
    )
      return;
    autoStarted.current = true;
    if (dataRef.current.settings.handsFree) {
      if (dataRef.current.settings.startInStandby) {
        setStandby(true);
        standbyRef.current = true;
      }
      wantMic.current = true;
      voiceSession.current++;
      listen();
    }
  }, [ready, voices, setupOpen]);
  useEffect(() => {
    if (!ready || !["empty", "offline"].includes(aiStatus)) return;
    const id = setInterval(refreshModels, 15000);
    return () => clearInterval(id);
  }, [ready, aiStatus]);
  useEffect(() => {
    if (desktop) return;
    const due = dueReminders(data.reminders, now);
    if (due.length)
      update((s) => ({
        ...s,
        reminders: s.reminders.map((r) =>
          due.some((x) => x.id === r.id) ? { ...r, notified: true } : r,
        ),
        notifications: [
          ...due.map((r) => ({
            id: uid(),
            title: r.title,
            body: "Reminder is due",
            at: new Date().toISOString(),
            read: false,
          })),
          ...s.notifications,
        ].slice(0, 100),
      }));
  }, [now]);
  useEffect(() => {
    conversationEnd.current?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
    });
  }, [data.history, partial]);
  function stopAll() {
    dictationRef.current = null;
    setDictation(null);
    window.aster?.capture({ action: "recordStop" }).catch(() => {});
    update((s) => ({ ...s, settings: { ...s.settings, handsFree: false } }));
    setPendingAction(null);
    window.aster?.cancelCommunication().catch(() => {});
    setStandby(false);
    standbyRef.current = false;
    wantMic.current = false;
    voiceSession.current++;
    clearTimeout(resumeTimer.current);
    setMic(false);
    setPartial("");
    setPhase("ready");
    setCamera(false);
    setSystem(false);
    setStopToken((t) => t + 1);
    recognition.current?.abort();
    speechSynthesis.cancel();
    cancelVoice();
    if (desktop) {
      window.aster.arm(false).catch(() => {});
      window.aster.native({ action: "speechStop" }).catch(() => {});
    }
  }
  useEffect(() => {
    const key = (e) => {
      if (e.key === "Escape") {
        stopAll();
        setModal(null);
      }
    };
    window.addEventListener("keydown", key);
    if (!desktop) return () => window.removeEventListener("keydown", key);
    const offState = window.aster.onState((s) => setData(s));
    const offStop = window.aster.onStop(stopAll);
    const offHide = window.aster.onHide(() => {
      setCamera(false);
      setSystem(false);
      setStopToken((t) => t + 1);
    });
    const offNative = window.aster.onNative((msg) => {
      if (msg.event === "capture") {
        setCapture(msg);
        if (msg.error) notify(msg.error);
        else if (msg.path) notify(msg.message);
        return;
      }
      if (
        msg.event === "wakeSound" &&
        wantMic.current &&
        standbyRef.current &&
        !busyRef.current
      ) {
        standbyRef.current = false;
        setStandby(false);
        commandRef.current("wake up");
        return;
      }
      if (msg.event === "partial") setPartial(msg.text);
      if (msg.event === "speechError") {
        wantMic.current = false;
        setMic(false);
        setPhase("ready");
        notify(msg.error);
      }
      if (msg.event === "transcript" && wantMic.current) {
        setPartial("");
        if (msg.text.trim()) commandRef.current(msg.text);
        else scheduleListen();
      }
    });
    return () => {
      window.removeEventListener("keydown", key);
      offState();
      offStop();
      offHide();
      offNative();
    };
  }, []);
  useEffect(() => {
    if (!trackApp || !desktop) return;
    const poll = () =>
      window.aster
        .native({ action: "activeApp" })
        .then((r) => setActiveApp(r.name))
        .catch(() => {});
    poll();
    const id = setInterval(poll, 4000);
    return () => clearInterval(id);
  }, [trackApp]);
  useEffect(() => {
    if (!camera && system) {
      setSystem(false);
      window.aster?.arm(false).catch(() => {});
    }
  }, [camera]);
  const focus = data.tasks.find((t) => t.id === data.focusId && !t.done),
    remaining = data.focusEnds
      ? Math.max(0, Math.min(1500, Math.ceil((data.focusEnds - now) / 1000)))
      : 1500;
  useEffect(() => {
    if (data.focusEnds && remaining === 0) {
      update((s) => ({
        ...s,
        focusEnds: null,
        notifications: [
          {
            id: uid(),
            title: "Focus session complete",
            body: "Take a moment to stretch and reset.",
            at: new Date().toISOString(),
            read: false,
          },
          ...s.notifications,
        ],
      }));
      notify("25-minute focus session complete. Time for a break.");
    }
  }, [remaining, data.focusEnds]);
  function scheduleListen() {
    clearTimeout(resumeTimer.current);
    if (wantMic.current) resumeTimer.current = setTimeout(() => listen(), 450);
  }
  async function listen() {
    if (!wantMic.current || busyRef.current) return;
    setPhase("listening");
    setMic(true);
    try {
      if (desktop) {
        await window.aster.native({
          action: "speechStart",
          wakeEnabled: !!dataRef.current.settings.soundWake,
          wakeMode: dataRef.current.settings.wakeMode,
          wakeThreshold: dataRef.current.settings.wakeThreshold,
        });
        return;
      }
      const Speech = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!Speech)
        throw Error(
          "Voice input needs the Mac app, or a browser that supports speech recognition.",
        );
      const rec = new Speech();
      recognition.current = rec;
      rec.lang = "en-IN";
      rec.interimResults = true;
      rec.continuous = false;
      let final = "";
      rec.onresult = (e) => {
        let preview = "";
        for (const r of e.results) {
          preview += r[0].transcript;
          if (r.isFinal) final = r[0].transcript;
        }
        setPartial(preview);
      };
      rec.onerror = (e) => {
        if (e.error === "aborted") return;
        wantMic.current = false;
        setMic(false);
        setPhase("ready");
        notify("Voice input: " + e.error);
      };
      rec.onend = () => {
        setPartial("");
        if (!wantMic.current) return;
        if (final) commandRef.current(final);
        else scheduleListen();
      };
      rec.start();
    } catch (e) {
      wantMic.current = false;
      setMic(false);
      setPhase("ready");
      notify(e.message);
    }
  }
  function toggleMic() {
    autoStarted.current = true;
    update((s) => ({
      ...s,
      settings: { ...s.settings, handsFree: !wantMic.current },
    }));
    setStandby(false);
    standbyRef.current = false;
    if (wantMic.current) {
      wantMic.current = false;
      voiceSession.current++;
      clearTimeout(resumeTimer.current);
      recognition.current?.abort();
      window.aster?.native({ action: "speechStop" }).catch(() => {});
      setMic(false);
      setPartial("");
      setPhase("ready");
      speechSynthesis.cancel();
      cancelVoice();
    } else {
      wantMic.current = true;
      voiceSession.current++;
      listen();
    }
  }
  async function speak(message, force = false) {
    if (!dataRef.current.settings.voice && !force) return;
    setPhase("speaking");
    speechSynthesis.cancel();
    try {
      await playVoice(
        spokenText(message),
        dataRef.current.settings.voiceId || "kokoro:af_heart",
        Number(dataRef.current.settings.voiceRate) || 0.48,
      );
    } catch (e) {
      notify("Voice playback failed: " + e.message);
    }
  }
  async function previewVoice() {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    recognition.current?.abort();
    if (desktop)
      await window.aster.native({ action: "speechStop" }).catch(() => {});
    await speak(
      "Hello, I’m Aster. Let’s make your day a little easier. What would you like to work on?",
      true,
    );
    setPhase("ready");
    busyRef.current = false;
    setBusy(false);
    scheduleListen();
  }
  async function openService(id) {
    try {
      if (id === "calls" || id === "facetime") {
        setModal("call");
        return;
      }
      if (desktop) await window.aster.open(id);
      else window.open(urls[id], "_blank", "noopener,noreferrer");
    } catch (e) {
      notify(e.message);
    }
  }
  async function sync(kind) {
    if (!desktop) {
      notify(
        "Open the Mac app to connect Apple " +
          (kind === "mail" ? "Mail" : kind) +
          ".",
      );
      return;
    }
    setSyncing(kind);
    try {
      const r = await window.aster.native({ action: kind });
      if (kind === "calendar") setEvents(r.events);
      if (kind === "reminders") setAppleReminders(r.reminders);
      if (kind === "mail") setMail(r);
      setSyncAt((s) => ({ ...s, [kind]: new Date().toISOString() }));
      notify("Apple " + kind + " refreshed.");
    } catch (e) {
      notify(e.message);
    } finally {
      setSyncing("");
    }
  }
  function addTask(title) {
    const task = {
      id: uid(),
      title: title.trim().slice(0, 200),
      done: false,
      created: new Date().toISOString(),
    };
    if (!task.title) return;
    update((s) => ({ ...s, tasks: [...s.tasks, task] }));
    return task;
  }
  function focusTask(task) {
    update((s) => ({
      ...s,
      focusId: task.id,
      focusEnds: Date.now() + 25 * 60000,
    }));
  }
  function addReminder(title, due) {
    if (
      !title.trim() ||
      !Number.isFinite(Date.parse(due)) ||
      Date.parse(due) <= Date.now()
    ) {
      notify("Add a title and choose a future time.");
      return false;
    }
    update((s) => ({
      ...s,
      reminders: [
        ...s.reminders,
        {
          id: uid(),
          title: title.trim().slice(0, 200),
          due: new Date(due).toISOString(),
          done: false,
          notified: false,
        },
      ],
    }));
    return true;
  }
  function toggleTask(id) {
    update((s) => ({
      ...s,
      tasks: s.tasks.map((t) => (t.id === id ? { ...t, done: !t.done } : t)),
      ...(s.focusId === id ? { focusId: null, focusEnds: null } : {}),
    }));
  }
  async function runCommand(input) {
    if (!input.trim() || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setPhase("thinking");
    setText("");
    if (desktop) window.aster.native({ action: "speechStop" }).catch(() => {});
    else recognition.current?.abort();
    const current = dataRef.current;
    update((s) => ({
      ...s,
      history: [...s.history, { role: "user", text: input }].slice(-80),
    }));
    const sessionAtStart = voiceSession.current;
    let answer = "",
      routedReply = "";
    try {
      let c = parseCommand(input);
      if (c.type === "chat" && current.settings.model) {
        const messages = [
          ...current.history
            .filter((m) => m.role === "user" || m.role === "assistant")
            .slice(-10),
          { role: "user", text: input },
        ].map((m) => ({ role: m.role, content: m.text }));
        const routed = await localServices.route(
          current.settings.model,
          messages,
        );
        if (sessionAtStart !== voiceSession.current)
          throw Error("Request stopped.");
        if (routed.command) c = routed.command;
        else routedReply = routed.reply;
      }
      switch (c.type) {
        case "setup":
          setSetupOpen(true);
          answer =
            "Opening setup. macOS permission prompts need your approval.";
          break;
        case "capture": {
          if (!desktop) throw Error("Screen tools need the Mac app.");
          const result = await window.aster.capture(c);
          if (result.phase) setCapture((s) => ({ ...s, phase: result.phase }));
          answer = result.message || "Screen tool ready.";
          if (result.path)
            update((s) => ({
              ...s,
              notifications: [
                {
                  id: uid(),
                  title: answer,
                  body: result.path,
                  at: new Date().toISOString(),
                  read: false,
                },
                ...s.notifications,
              ].slice(0, 100),
            }));
          break;
        }
        case "shortcut": {
          if (!desktop) throw Error("Mac shortcuts need the Mac app.");
          if (c.operation === "lock") {
            setDictation(null);
            dictationRef.current = null;
            setCamera(false);
            setSystem(false);
            setStopToken((t) => t + 1);
            await window.aster.arm(false);
            await window.aster
              .capture({ action: "recordStop" })
              .catch(() => {});
            setStandby(true);
            standbyRef.current = true;
          }
          answer = (
            await window.aster.control({
              action: "shortcut",
              operation: c.operation,
            })
          ).message;
          break;
        }
        case "dictation": {
          if (!desktop)
            throw Error("Continuous dictation requires the Mac app.");
          if (c.enabled) {
            const target = await window.aster.ui({
              action: "uiDictationStart",
            });
            if (sessionAtStart !== voiceSession.current)
              throw Error("Request stopped.");
            dictationRef.current = target;
            setDictation(target);
            wantMic.current = true;
            setMic(true);
            setStandby(false);
            standbyRef.current = false;
            answer =
              "Dictation started in " +
              target.app +
              ". Say Stop dictation to finish. Say Command before a control, such as Command press Enter. I pause between utterances; wait for Listening.";
          } else {
            dictationRef.current = null;
            setDictation(null);
            answer = "Dictation stopped. Back to conversation and commands.";
          }
          break;
        }
        case "gestures": {
          if (c.system) {
            if (!desktop) throw Error("Whole-Mac gestures need the Mac app.");
            await window.aster.arm(true);
            if (sessionAtStart !== voiceSession.current) {
              await window.aster.arm(false);
              throw Error("Request stopped.");
            }
            setSystem(true);
          }
          if (sessionAtStart !== voiceSession.current)
            throw Error("Request stopped.");
          setCamera(true);
          answer = c.system
            ? "Camera starting with Mac control armed. Quick pinch to tap, hold to drag, two fingers to scroll, two pinches to zoom and an open palm swipe for desktops."
            : "Camera starting. Enable Mac gestures for control outside Aster.";
          break;
        }
        case "emailDraft": {
          if (!desktop)
            throw Error("Email drafting into your mail app needs the Mac app.");
          if (!current.settings.model)
            throw Error(
              "Install the local conversation model from Show setup first.",
            );
          const draft = await window.aster.draftEmail(
            current.settings.model,
            c.brief,
          );
          if (sessionAtStart !== voiceSession.current)
            throw Error("Request stopped.");
          const plan = await window.aster.prepareCommunication({
            kind: "email",
            target: c.target,
            subject: draft.subject,
            text: draft.body,
          });
          setPendingAction({
            ...plan,
            selected: plan.choices.length === 1 ? 0 : null,
          });
          answer =
            "Email draft. Subject: " +
            draft.subject +
            ". " +
            draft.body +
            " Recipients: " +
            plan.choices
              .map((x, i) => i + 1 + ", " + x.name + ", " + x.address)
              .join("; ") +
            ". " +
            (plan.choices.length === 1
              ? "Say Confirm email to open it, or Cancel."
              : "Say Choose contact followed by a number.");
          break;
        }
        case "help":
          setModal("commands");
          answer =
            "You can say: Open YouTube. Open Chrome and search for a topic. Show controls, then click a number. Type, followed by your text. Press Enter. Call, followed by a contact or number. WhatsApp a name saying your message. Or Go to sleep, then clap twice to wake me. Computer controls need Accessibility permission.";
          break;
        case "standby":
          setStandby(true);
          standbyRef.current = true;
          answer = wantMic.current
            ? "Standing by. My microphone stays on. Say Aster followed by your next command."
            : "Microphone is off. Enable voice to use wake-name standby.";
          break;
        case "wake":
          setStandby(false);
          standbyRef.current = false;
          answer =
            (new Date().getHours() < 12
              ? "Good morning"
              : new Date().getHours() < 17
                ? "Good afternoon"
                : "Good evening") +
            (current.settings.name ? ", " + current.settings.name : "") +
            ". Aster is ready. What can I do for you?";
          break;
        case "dismiss":
          setModal(null);
          answer = "Panel closed.";
          break;
        case "navigate": {
          if (desktop) await window.aster.reveal();
          const pages = {
            dashboard: "Overview",
            overview: "Overview",
            tasks: "Tasks",
            conversation: "Conversation",
            connections: "Connections",
            system: "System",
            models: "System",
          };
          if (pages[c.page]) {
            setTab(pages[c.page]);
            setModal(null);
          } else
            setModal(c.page === "reminders list" ? "allReminders" : c.page);
          answer = "Showing " + c.page + ".";
          break;
        }
        case "handsfree":
          update((s) => ({
            ...s,
            settings: { ...s.settings, handsFree: c.enabled },
          }));
          wantMic.current = c.enabled;
          setMic(c.enabled);
          answer = c.enabled
            ? "Hands-free mode enabled. I’ll listen again after each reply and when the Mac app opens."
            : "Hands-free mode disabled.";
          break;
        case "voice": {
          const map = {
            heart: "af_heart",
            bella: "af_bella",
            michael: "am_michael",
            emma: "bf_emma",
            george: "bm_george",
          };
          const voiceId = "kokoro:" + map[c.name];
          dataRef.current = {
            ...dataRef.current,
            settings: { ...dataRef.current.settings, voiceId },
          };
          update((s) => ({ ...s, settings: { ...s.settings, voiceId } }));
          answer = "Voice changed to " + c.name + ".";
          break;
        }
        case "pace":
          dataRef.current = {
            ...dataRef.current,
            settings: { ...dataRef.current.settings, voiceRate: c.value },
          };
          update((s) => ({
            ...s,
            settings: { ...s.settings, voiceRate: c.value },
          }));
          answer = "Speaking pace updated.";
          break;
        case "listModels": {
          const list = await refreshModels();
          setTab("System");
          setModal(null);
          answer = list.length
            ? "Available local models: " +
              list.join(", ") +
              ". Cloud models need your own account credentials."
            : "No local models are available. Check the local AI connection.";
          break;
        }
        case "model": {
          const list = await refreshModels();
          const matches = list.filter(
            (m) =>
              m.toLowerCase() === c.name || m.toLowerCase().includes(c.name),
          );
          if (matches.length === 1) {
            update((s) => ({
              ...s,
              settings: {
                ...s.settings,
                model: matches[0],
                modelConfigured: true,
              },
            }));
            answer = "Using " + matches[0] + ".";
          } else
            answer = matches.length
              ? "More than one model matches. Say the full model name."
              : "That model is not installed. Available models: " +
                list.join(", ") +
                ".";
          break;
        }
        case "soundWake":
          update((s) => ({
            ...s,
            settings: { ...s.settings, soundWake: c.enabled },
          }));
          answer = c.enabled
            ? "Sound wake enabled. Say Go to sleep, then " +
              (current.settings.wakeMode === "single"
                ? "clap or snap once"
                : "clap or snap twice") +
              " to wake me."
            : "Sound wake disabled. You can still say Aster to wake me from standby.";
          break;
        case "wakeMode":
          update((s) => ({
            ...s,
            settings: { ...s.settings, wakeMode: c.mode },
          }));
          answer = "Sound wake now uses " + c.mode + " impulses.";
          break;
        case "wakeThreshold":
          update((s) => ({
            ...s,
            settings: { ...s.settings, wakeThreshold: c.threshold },
          }));
          answer =
            "Wake sensitivity updated. Say Go to sleep before trying it.";
          break;
        case "accessibility":
          if (!desktop) throw Error("Computer control requires the Mac app.");
          {
            const result = await window.aster.native({
              action: "requestAccessibility",
            });
            answer = result.accessibility
              ? "Computer control is authorized."
              : "Enable Aster or AsterBridge in the Accessibility settings. macOS requires you to approve this once.";
          }
          break;
        case "ui": {
          if (!desktop)
            throw Error("Typing and clicking other apps require the Mac app.");
          const r = await window.aster.ui(c);
          if (c.action === "uiControls") {
            setUiControls(r);
            answer = r.controls.length
              ? "Controls in " +
                r.app +
                ": " +
                r.controls
                  .slice(0, 12)
                  .map((x) => x.number + ", " + x.label)
                  .join("; ") +
                ". Say Click followed by a number."
              : r.app +
                " has no labeled controls available. Try Apple Voice Control.";
          } else {
            setUiControls(null);
            answer = r.message;
          }
          break;
        }
        case "communication": {
          if (!desktop)
            throw Error(
              "Calls and WhatsApp contact lookup require the Mac app.",
            );
          const plan = await window.aster.prepareCommunication(c);
          setPendingAction({
            ...plan,
            selected: plan.choices.length === 1 ? 0 : null,
          });
          answer =
            plan.choices.length === 1
              ? "Ready to " +
                (c.kind === "call"
                  ? "call "
                  : "open a " + c.kind + " draft for ") +
                plan.choices[0].name +
                ", " +
                (plan.choices[0].phone || plan.choices[0].address) +
                ". " +
                (c.text ? "Message: " + c.text + ". " : "") +
                "Say Confirm " +
                c.kind +
                " or Cancel."
              : "Matching contacts: " +
                plan.choices
                  .map(
                    (x, i) =>
                      i + 1 + ", " + x.name + ", " + (x.phone || x.address),
                  )
                  .join("; ") +
                ". Say Choose contact followed by the number.";
          break;
        }
        case "chooseContact": {
          if (
            !pendingAction ||
            pendingAction.expires < Date.now() ||
            !pendingAction.choices[c.number - 1]
          ) {
            answer =
              "No matching pending choice. Start the call or WhatsApp request again.";
            break;
          }
          const selected = c.number - 1,
            x = pendingAction.choices[selected];
          setPendingAction({ ...pendingAction, selected });
          answer =
            "Selected " +
            x.name +
            ", " +
            (x.phone || x.address) +
            ". " +
            (pendingAction.text
              ? "Message: " + pendingAction.text + ". "
              : "") +
            "Say Confirm " +
            pendingAction.kind +
            " or Cancel.";
          break;
        }
        case "confirmCommunication": {
          if (
            !pendingAction ||
            pendingAction.kind !== c.kind ||
            pendingAction.selected == null
          )
            throw Error(
              "There is no selected " + c.kind + " request to confirm.",
            );
          const result = await window.aster.confirmCommunication(
            pendingAction.choices[pendingAction.selected].token,
            c.kind,
          );
          setPendingAction(null);
          answer = result.message;
          break;
        }
        case "cancelCommunication":
          setPendingAction(null);
          if (desktop) await window.aster.cancelCommunication();
          answer = "Pending call or message request cancelled.";
          break;
        case "web": {
          let url = c.url;
          if (c.action === "search") {
            const bases = {
              google: "https://www.google.com/search?q=",
              youtube: "https://www.youtube.com/results?search_query=",
              duckduckgo: "https://duckduckgo.com/?q=",
            };
            url = bases[c.engine] + encodeURIComponent(c.query);
          }
          if (desktop) await window.aster.browse(c);
          else {
            const opened = window.open(url, "_blank", "noopener,noreferrer");
            notify(
              "Opening your browser. If no tab appears, allow pop-ups or use the Mac app.",
            );
          }
          answer =
            c.action === "search"
              ? "Searching " + c.engine + " for " + c.query + "."
              : "Opened " + (c.label || c.url) + ".";
          break;
        }
        case "mac": {
          const result = await localServices.control(c);
          answer = result.message || "Mac command completed.";
          if (c.pane === "voice control")
            answer =
              "Voice Control settings opened. Enable Apple Voice Control once for clicks, dictation and menus throughout your Mac. Then say Aster, go to sleep while using those commands.";
          break;
        }
        case "telemetry": {
          const r = await localServices.telemetry();
          setStats(r);
          answer =
            "Your Mac has " +
            (r.memoryTotal / 1073741824).toFixed(0) +
            " gigabytes of memory. " +
            (r.battery != null
              ? "Battery is " + r.battery + " percent. "
              : "") +
            (r.name ? "Active app: " + r.name + ". " : "") +
            (r.cpu != null ? "CPU load is " + r.cpu + " percent." : "");
          break;
        }
        case "read": {
          if (c.kind === "tasks") {
            const items = current.tasks.filter((x) => !x.done);
            answer = items.length
              ? "Your open tasks: " + items.map((x) => x.title).join("; ") + "."
              : "No open tasks.";
          } else if (c.kind === "reminders") {
            const items = current.reminders.filter((x) => !x.done);
            answer = items.length
              ? "Your reminders: " +
                items
                  .map(
                    (x) =>
                      x.title +
                      " on " +
                      shortDate(x.due) +
                      " at " +
                      time(x.due),
                  )
                  .join("; ") +
                "."
              : "No pending reminders.";
          } else {
            answer = current.notifications.length
              ? current.notifications
                  .slice(0, 5)
                  .map((x) => x.title + ". " + x.body)
                  .join(" ")
              : "No notifications.";
          }
          break;
        }
        case "completeNamed": {
          const matches = current.tasks.filter(
            (t) => !t.done && t.title.toLowerCase() === c.title.toLowerCase(),
          );
          if (matches.length === 1) {
            toggleTask(matches[0].id);
            answer = "Completed " + matches[0].title + ".";
          } else
            answer =
              "Say the exact name of an open task. Say Read my tasks to hear the list.";
          break;
        }
        case "sync": {
          if (!desktop)
            throw Error("Apple service access requires the Mac app.");
          const r = await window.aster.native({ action: c.kind });
          setSyncAt((s) => ({ ...s, [c.kind]: new Date().toISOString() }));
          if (c.kind === "calendar") {
            setEvents(r.events);
            const upcoming = r.events.filter(
              (e) => Date.parse(e.end) > Date.now(),
            );
            answer = upcoming.length
              ? "Upcoming events: " +
                upcoming
                  .slice(0, 4)
                  .map(
                    (e) =>
                      e.title +
                      " on " +
                      shortDate(e.start) +
                      " at " +
                      time(e.start),
                  )
                  .join("; ")
              : "No upcoming events in the next seven days.";
          } else if (c.kind === "mail") {
            setMail(r);
            answer =
              "You have " +
              r.count +
              " unread messages. " +
              r.messages
                .slice(0, 3)
                .map((m) => m.title + " from " + m.sender)
                .join("; ");
          } else {
            setAppleReminders(r.reminders);
            answer = r.reminders.length
              ? "Apple reminders: " +
                r.reminders
                  .slice(0, 5)
                  .map((r) => r.title)
                  .join("; ")
              : "No incomplete Apple reminders.";
          }
          break;
        }
        case "mute":
          update((s) => ({
            ...s,
            settings: { ...s.settings, handsFree: false },
          }));
          wantMic.current = false;
          setMic(false);
          clearTimeout(resumeTimer.current);
          answer = "Microphone off.";
          break;
        case "stopGestures":
          setCamera(false);
          setSystem(false);
          window.aster?.arm(false);
          answer = "Hand control is off.";
          break;
        case "time":
          answer = "It’s " + time(new Date()) + ".";
          break;
        case "task":
          addTask(c.title);
          answer = "Added “" + c.title + "” to your tasks.";
          break;
        case "focus": {
          const t =
            current.tasks.find(
              (t) => !t.done && t.title.toLowerCase() === c.title.toLowerCase(),
            ) || addTask(c.title);
          focusTask(t);
          answer =
            "Let’s focus on " +
            c.title +
            ". Your 25-minute session has started.";
          break;
        }
        case "pauseFocus":
          update((s) => ({ ...s, focusEnds: null }));
          answer =
            "Focus timer stopped. Your task is still here when you’re ready.";
          break;
        case "completeFocus":
          if (current.focusId) {
            toggleTask(current.focusId);
            answer = "Your current task is marked complete.";
          } else answer = "Choose a current task first.";
          break;
        case "reminder":
          addReminder(c.title, c.due);
          answer =
            "I’ll remind you to " +
            c.title +
            " on " +
            shortDate(c.due) +
            " at " +
            time(c.due) +
            ". Keep Aster running for the alert.";
          break;
        case "clarifyReminder":
          answer = c.message;
          break;
        case "open":
          await openService(c.app);
          answer = ["calls", "facetime"].includes(c.app)
            ? "Enter the person’s number or email, then continue in FaceTime."
            : "Opened " + c.app + ".";
          break;
        case "search":
          if (desktop) await window.aster.search(c.query);
          else
            window.open(
              "https://www.google.com/search?q=" + encodeURIComponent(c.query),
              "_blank",
              "noopener,noreferrer",
            );
          answer = "Opened a browser search for " + c.query + ".";
          break;
        case "agenda": {
          const tasks = current.tasks.filter((t) => !t.done),
            reminders = current.reminders.filter((r) => !r.done);
          answer =
            "You have " +
            tasks.length +
            " open task" +
            (tasks.length === 1 ? "" : "s") +
            " and " +
            reminders.length +
            " reminder" +
            (reminders.length === 1 ? "" : "s") +
            "." +
            (tasks.length
              ? " Next up: " +
                tasks
                  .slice(0, 3)
                  .map((t) => t.title)
                  .join(", ") +
                "."
              : "") +
            (events.length
              ? " Your next synced event is " +
                events[0].title +
                " at " +
                time(events[0].start) +
                "."
              : " Connect Apple Calendar to include your events.");
          break;
        }
        default:
          answer =
            routedReply ||
            "Say Show commands to hear my controls, or connect a local model in Settings for conversation.";
      }
    } catch (e) {
      answer =
        "I couldn’t complete that: " +
        e.message.replace(
          /^Error invoking remote method '[^']+': (?:Error: )?/,
          "",
        );
    }
    update((s) => ({
      ...s,
      history: [...s.history, { role: "assistant", text: answer }].slice(-80),
    }));
    if (sessionAtStart === voiceSession.current) await speak(answer);
    setBusy(false);
    busyRef.current = false;
    setPhase("ready");
    scheduleListen();
  }
  async function insertDictation(input) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setPhase("thinking");
    const target = dictationRef.current,
      token = voiceSession.current;
    try {
      await window.aster.native({ action: "speechStop" });
      if (token !== voiceSession.current || target !== dictationRef.current)
        return;
      await window.aster.ui({
        action: "uiType",
        text: input + " ",
        dictationToken: target.token,
      });
    } catch (e) {
      dictationRef.current = null;
      setDictation(null);
      notify(e.message);
      await speak(
        "Dictation stopped. The field changed or could not accept text. Focus a text field and say Start dictation again.",
      );
    } finally {
      busyRef.current = false;
      setBusy(false);
      setPhase("ready");
      scheduleListen();
    }
  }
  async function toggleMacGestures() {
    try {
      const enabled = !system;
      const token = voiceSession.current;
      await window.aster.arm(enabled);
      if (token !== voiceSession.current) {
        await window.aster.arm(false);
        return;
      }
      setSystem(enabled);
    } catch (e) {
      notify(e.message);
    }
  }
  commandRef.current = (input) => {
    if (dictationRef.current) {
      const result = dictationInput(input);
      if (result.text) {
        insertDictation(result.text);
        return;
      }
      input = result.command;
    }
    if (standbyRef.current) {
      if (!/^(?:hey\s+)?aster\b/i.test(input)) {
        scheduleListen();
        return;
      }
      setStandby(false);
      standbyRef.current = false;
      if (/^(?:hey\s+)?aster[,.! ]*$/i.test(input)) input = "wake up";
    }
    runCommand(input);
  };
  const unread = data.notifications.filter((n) => !n.read).length,
    openTasks = data.tasks.filter((t) => !t.done),
    completed = data.tasks.filter((t) => t.done).length;
  const greeting =
    new Date(now).getHours() < 12
      ? "Good morning"
      : new Date(now).getHours() < 17
        ? "Good afternoon"
        : "Good evening";
  const pendingReminders = data.reminders
    .filter((r) => !r.done)
    .sort((a, b) => Date.parse(a.due) - Date.parse(b.due));
  const upcomingEvents = events.filter((e) => Date.parse(e.end) > now);
  function TaskList({ full = false }) {
    return (
      <div className="task-list">
        {(full ? data.tasks : openTasks.slice(0, 4)).map((t) => (
          <div className={"task-row " + (t.done ? "completed" : "")} key={t.id}>
            <button
              className="check-button"
              aria-label={"Complete " + t.title}
              onClick={() => toggleTask(t.id)}
            >
              {t.done && <Check size={12} />}
            </button>
            <span>
              {t.title}
              {data.focusId === t.id && !t.done && <small>IN FOCUS</small>}
            </span>
            {!t.done && (
              <button
                className="icon-button task-focus"
                title="Focus on task"
                aria-label={"Focus on " + t.title}
                onClick={() => focusTask(t)}
              >
                <Play size={13} />
              </button>
            )}
            {full && (
              <button
                className="icon-button"
                aria-label={"Delete " + t.title}
                onClick={() =>
                  update((s) => ({
                    ...s,
                    tasks: s.tasks.filter((x) => x.id !== t.id),
                    ...(s.focusId === t.id
                      ? { focusId: null, focusEnds: null }
                      : {}),
                  }))
                }
              >
                <Trash2 size={13} />
              </button>
            )}
          </div>
        ))}
        {!data.tasks.length && (
          <div className="empty-task">
            <div className="empty-check">
              <Check size={19} />
            </div>
            <span>Mission queue is empty.</span>
            <small>Say “Add task” followed by your objective.</small>
            <button className="text-button" onClick={() => setModal("task")}>
              Create a task <Plus size={13} />
            </button>
          </div>
        )}
        {!full && data.tasks.length > 0 && openTasks.length === 0 && (
          <div className="empty-task">
            <CheckCheck />
            <span>You’re all caught up.</span>
            <small>Make room for something new.</small>
          </div>
        )}
      </div>
    );
  }
  function Conversation() {
    return (
      <>
        <div className="conversation-messages">
          {data.history.map((m, i) => (
            <div className={"message " + m.role} key={i}>
              {m.role === "assistant" && (
                <div className="avatar">
                  <Orbit size={15} />
                </div>
              )}
              <div>
                <small>{m.role === "assistant" ? "ASTER" : "YOU"}</small>
                <p>{m.text}</p>
              </div>
            </div>
          ))}
          {busy && (
            <div className="thinking">
              <i />
              <i />
              <i /> Aster is {phase === "speaking" ? "speaking" : "thinking"}…
            </div>
          )}
          {partial && <div className="partial">{partial}</div>}
          <div ref={conversationEnd} />
        </div>
      </>
    );
  }
  return (
    <div className="app-shell">
      {setupOpen && (
        <SetupPanel
          stats={stats}
          aiStatus={aiStatus}
          onClose={() => {
            setSetupOpen(false);
            update((s) => ({
              ...s,
              settings: { ...s.settings, setupCompleted: true },
            }));
          }}
          onVoice={() => {
            setSetupOpen(false);
            update((s) => ({
              ...s,
              settings: { ...s.settings, setupCompleted: true },
            }));
            if (!wantMic.current) toggleMic();
          }}
          onCommand={runCommand}
          onModels={refreshModels}
        />
      )}
      {(capture.phase !== "idle" || dictation) && (
        <div className="activity-banner" role="status">
          {capture.phase !== "idle" && (
            <span>
              <i className="record-dot" />
              Screen recording · {capture.phase} · video only{" "}
              <button onClick={() => runCommand("Stop recording")}>
                Stop & save
              </button>
            </span>
          )}
          {dictation && (
            <span>
              Dictation → {dictation.app}{" "}
              <button onClick={() => runCommand("Stop dictation")}>
                Stop dictation
              </button>
            </span>
          )}
        </div>
      )}
      <aside className="sidebar">
        <div className="window-space" />
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setTab("Overview");
          }}
        >
          <div className="brand-mark">
            <Orbit size={29} strokeWidth={1} />
          </div>
          <span>
            aster<span className="brand-period">.</span>
          </span>
        </a>
        <div className="workspace-label">PERSONAL COMMAND SYSTEM</div>
        <nav>
          {[
            [LayoutDashboard, "Overview"],
            [ListTodo, "Tasks"],
            [MessageSquare, "Conversation"],
            [PanelsTopLeft, "Connections"],
            [Command, "System"],
          ].map(([Icon, label]) => (
            <button
              key={label}
              aria-label={label}
              className={"nav-item " + (tab === label ? "selected" : "")}
              onClick={() => setTab(label)}
            >
              <Icon size={18} />
              <span>{label}</span>
              {label === "Tasks" && <small>{openTasks.length}</small>}
              {tab === label && <i />}
            </button>
          ))}
        </nav>
        <div className="sidebar-divider" />
        <GesturePanel
          active={camera}
          setActive={setCamera}
          system={system}
          onArm={toggleMacGestures}
          stopToken={stopToken}
          onError={notify}
        />
        <div className="sidebar-bottom">
          <div className="privacy-note">
            <ShieldCheck size={15} />
            <span>LOCAL INTELLIGENCE / MAC</span>
          </div>
          <button
            className="nav-item"
            aria-label="Settings"
            onClick={() => setModal("settings")}
          >
            <Settings size={18} />
            <span>Settings</span>
          </button>
          <div className="profile">
            <div className="profile-avatar">
              {data.settings.name?.charAt(0).toUpperCase() || "Y"}
            </div>
            <div>
              <strong>{data.settings.name || "Your workspace"}</strong>
              <small>{desktop ? "On this Mac" : "Browser preview"}</small>
            </div>
            <span className="status-dot green" />
          </div>
        </div>
      </aside>
      <main className="main">
        <header className="topbar">
          <div className="breadcrumb">
            Command center <ChevronRight size={13} />
            <strong>{tab}</strong>
          </div>
          <div className="header-actions">
            <span className="date-label">
              {new Date(now).toLocaleDateString([], {
                weekday: "short",
                month: "short",
                day: "numeric",
              })}
            </span>
            <span className="separator" />
            <button
              className="icon-button notification-button"
              aria-label="Notifications"
              onClick={() => setModal("notifications")}
            >
              <Bell size={18} />
              {unread > 0 && <i />}
            </button>
            <button
              className="keyboard-hint"
              onClick={stopAll}
              title="Stop camera, voice, and pointer"
            >
              <Command size={12} /> ⇧ Esc
            </button>
          </div>
        </header>
        <div className="workspace">
          <div className="main-column">
            <div className="page-title">
              <div>
                <div className="eyebrow">
                  <span className="tiny-star">✳</span> ASTER / OPERATING
                  ENVIRONMENT
                </div>
                <h1>
                  {tab === "Overview"
                    ? "Command center"
                    : tab === "Tasks"
                      ? "Mission queue"
                      : tab === "Conversation"
                        ? "Communication log"
                        : tab === "System"
                          ? "System control"
                          : "Connected services"}
                </h1>
                <p>
                  {tab === "Overview"
                    ? "Your Mac. Your intelligence. Under voice control."
                    : tab === "Tasks"
                      ? "Track objectives and direct your next focus session."
                      : tab === "Conversation"
                        ? "Requests, actions, and responses in one channel."
                        : tab === "System"
                          ? "Live Mac status, model connections, and voice capabilities."
                          : "Calendar, communications, and daily operations."}
                </p>
              </div>
              <span className="mode-pill">
                <span className="status-dot green" />
                {desktop ? "MAC WORKSPACE" : "LOCAL PREVIEW"}
              </span>
            </div>
            {(tab === "Overview" || tab === "System") && (
              <Telemetry stats={stats} />
            )}
            {tab === "System" && (
              <SystemPanel
                stats={stats}
                desktop={desktop}
                models={models}
                model={data.settings.model}
                aiStatus={aiStatus}
                onCommand={runCommand}
                onModel={(m) =>
                  update((s) => ({
                    ...s,
                    settings: {
                      ...s.settings,
                      model: m,
                      modelConfigured: true,
                    },
                  }))
                }
              />
            )}
            {tab === "Overview" && (
              <>
                <Reactor
                  phase={phase}
                  mic={mic}
                  standby={standby}
                  soundWake={data.settings.soundWake}
                  wakeMode={data.settings.wakeMode}
                  partial={partial}
                  model={data.settings.model}
                  aiStatus={aiStatus}
                  onToggle={toggleMic}
                  busy={busy}
                />
                <section className="focus-card">
                  <div className="focus-icon">
                    <Focus size={21} />
                  </div>
                  <div className="focus-content">
                    <div className="eyebrow">
                      ACTIVE OBJECTIVE{" "}
                      {data.focusEnds && (
                        <span className="focus-live">● IN PROGRESS</span>
                      )}
                    </div>
                    <h3>{focus?.title || "No active objective"}</h3>
                    <p>
                      {stats?.name
                        ? "Active app: " + stats.name
                        : trackApp && activeApp
                          ? "Active app: " + activeApp
                          : focus
                            ? "Focus protocol is ready."
                            : "Choose a task and start a 25-minute focus session."}
                    </p>
                  </div>
                  <div className="focus-actions">
                    {focus ? (
                      <>
                        <span className="timer">
                          {String(Math.floor(remaining / 60)).padStart(2, "0")}
                          <span>:</span>
                          {String(remaining % 60).padStart(2, "0")}
                        </span>
                        <button
                          className="round-button"
                          aria-label={
                            data.focusEnds
                              ? "Stop focus timer"
                              : "Start focus timer"
                          }
                          onClick={() =>
                            update((s) => ({
                              ...s,
                              focusEnds: s.focusEnds
                                ? null
                                : Date.now() + 1500000,
                            }))
                          }
                        >
                          {data.focusEnds ? (
                            <Pause size={16} />
                          ) : (
                            <Play size={16} />
                          )}
                        </button>
                        <button
                          className="round-button"
                          aria-label="Complete current task"
                          onClick={() => toggleTask(focus.id)}
                        >
                          <Check size={16} />
                        </button>
                      </>
                    ) : (
                      <button
                        className="soft-button"
                        onClick={() => setModal("focus")}
                      >
                        Set a focus <ArrowUpRight size={14} />
                      </button>
                    )}
                  </div>
                </section>
                <div className="lower-grid">
                  <section className="panel tasks-panel">
                    <div className="panel-heading">
                      <h3>
                        Mission queue{" "}
                        <span className="count">{openTasks.length}</span>
                      </h3>
                      <button
                        className="icon-button"
                        aria-label="Add task"
                        onClick={() => setModal("task")}
                      >
                        <Plus size={17} />
                      </button>
                    </div>
                    <TaskList />
                    <button
                      className="panel-footer"
                      onClick={() => setTab("Tasks")}
                    >
                      View all tasks <ArrowUpRight size={14} />
                    </button>
                  </section>
                  <section className="panel quick-panel">
                    <div className="panel-heading">
                      <h3>App launchpad</h3>
                      <ArrowUpRight size={16} />
                    </div>
                    <div className="shortcut-grid">
                      {services
                        .slice(0, 4)
                        .map(({ id, name, icon: Icon, color }) => (
                          <button key={id} onClick={() => openService(id)}>
                            <span className={"service-icon " + color}>
                              <Icon size={18} />
                            </span>
                            <span>{name}</span>
                            <ArrowUpRight size={12} />
                          </button>
                        ))}
                    </div>
                    <button
                      className="panel-footer"
                      onClick={() => setTab("Connections")}
                    >
                      Manage connections <ArrowUpRight size={14} />
                    </button>
                  </section>
                </div>
              </>
            )}
            {tab === "Tasks" && (
              <>
                <div className="task-summary">
                  <span>
                    <strong>{openTasks.length}</strong> to do
                  </span>
                  <span>
                    <strong>{completed}</strong> completed
                  </span>
                  <button
                    className="primary-button"
                    onClick={() => setModal("task")}
                  >
                    <Plus size={16} /> Add task
                  </button>
                </div>
                <section className="panel full-tasks">
                  <TaskList full />
                </section>
                <div className="subtle-callout">
                  <Focus size={19} />
                  <span>
                    Use the play button beside any task to make it your current
                    focus.
                  </span>
                </div>
              </>
            )}
            {tab === "Conversation" && (
              <section className="panel conversation-panel">
                <div className="panel-heading">
                  <h3>
                    <Orbit size={16} /> Aster
                  </h3>
                  <span className="muted">
                    {data.settings.model || "Essential commands"}
                  </span>
                </div>
                <Conversation />
              </section>
            )}
            {tab === "Connections" && (
              <>
                <section className="connection-intro">
                  <ShieldCheck size={22} />
                  <div>
                    <h3>Connected on your terms.</h3>
                    <p>
                      Shortcuts open your browser or Mac apps. Connect Apple
                      services below to bring their data into Aster.
                    </p>
                  </div>
                </section>
                <div className="connections-grid">
                  {services.map(({ id, name, subtitle, icon: Icon, color }) => (
                    <section className="panel connection-card" key={id}>
                      <span className={"service-icon " + color}>
                        <Icon size={21} />
                      </span>
                      <h3>{name}</h3>
                      <p>{subtitle}</p>
                      <span className="connection-tag">APP SHORTCUT</span>
                      <button
                        className="soft-button"
                        onClick={() => openService(id)}
                      >
                        Open {name}
                        <ArrowUpRight size={14} />
                      </button>
                    </section>
                  ))}
                </div>
                <section className="panel apple-connect">
                  <div className="panel-heading">
                    <h3>Bring your day into Aster</h3>
                    <span className="muted">Apple services · read only</span>
                  </div>
                  {[
                    [
                      "calendar",
                      "Apple Calendar",
                      "Next 7 days of events",
                      CalendarDays,
                    ],
                    [
                      "reminders",
                      "Apple Reminders",
                      "Incomplete reminders",
                      Bell,
                    ],
                    ["mail", "Apple Mail", "Unread subjects and senders", Mail],
                  ].map(([id, name, desc, Icon]) => (
                    <div className="connect-row" key={id}>
                      <Icon size={19} />
                      <div>
                        <strong>{name}</strong>
                        <p>
                          {syncAt[id]
                            ? "Refreshed at " + time(syncAt[id])
                            : desc}
                        </p>
                      </div>
                      <button
                        disabled={!!syncing}
                        className="soft-button"
                        onClick={() => sync(id)}
                      >
                        {syncing === id ? (
                          <LoaderCircle className="spin" size={14} />
                        ) : syncAt[id] ? (
                          <RefreshCw size={14} />
                        ) : (
                          <Link2 size={14} />
                        )}{" "}
                        {syncAt[id] ? "Refresh" : "Connect"}
                      </button>
                    </div>
                  ))}
                </section>
              </>
            )}
            {pendingAction && (
              <section className="panel pending-action">
                <div className="eyebrow">AWAITING YOUR VOICE CONFIRMATION</div>
                <h3>
                  {pendingAction.kind === "call"
                    ? "Call"
                    : pendingAction.kind + " draft"}
                </h3>
                {pendingAction.choices.map((c, i) => (
                  <p key={c.token}>
                    {i + 1}. {c.name} · {c.phone || c.address}
                    {pendingAction.selected === i ? " · SELECTED" : ""}
                  </p>
                ))}
                {pendingAction.text && (
                  <blockquote>{pendingAction.text}</blockquote>
                )}
                <small>
                  Say “
                  {pendingAction.selected == null
                    ? "Choose contact 1"
                    : "Confirm " + pendingAction.kind}
                  ” or “Cancel”. Expires in two minutes.
                </small>
              </section>
            )}
            {uiControls && (
              <section className="panel controls-panel">
                <div className="panel-heading">
                  <h3>Controls in {uiControls.app}</h3>
                  <span className="muted">
                    Say “Click” and the number · refresh after 45 seconds
                  </span>
                </div>
                <div>
                  {uiControls.controls.map((c) => (
                    <p key={c.number}>
                      <span>{c.number}</span>
                      {c.label}
                    </p>
                  ))}
                </div>
              </section>
            )}
            <div className="command-area">
              {tab !== "Conversation" && data.history.length > 1 && (
                <div className="last-response">
                  <Orbit size={15} />
                  <p>
                    {
                      data.history.filter((m) => m.role === "assistant").at(-1)
                        ?.text
                    }
                  </p>
                  <button
                    className="icon-button"
                    aria-label="View conversation"
                    onClick={() => setTab("Conversation")}
                  >
                    <ArrowUpRight size={15} />
                  </button>
                </div>
              )}
              <form
                className="command-bar"
                onSubmit={(e) => {
                  e.preventDefault();
                  runCommand(text);
                }}
              >
                <Orbit size={20} />
                <input
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Voice is primary. Type a command if needed…"
                  aria-label="Message Aster"
                  maxLength={2000}
                />
                <button
                  type="button"
                  className={"icon-button " + (mic ? "mic-active" : "")}
                  disabled={busy}
                  aria-label={mic ? "Stop listening" : "Start voice input"}
                  onClick={toggleMic}
                >
                  {mic ? <MicOff size={17} /> : <Mic size={17} />}
                </button>
                <button
                  className="send-button"
                  disabled={busy || !text.trim()}
                  aria-label="Send message"
                >
                  {busy ? (
                    <LoaderCircle size={17} className="spin" />
                  ) : (
                    <ArrowUp size={18} />
                  )}
                </button>
              </form>
              <div className="command-hints">
                <span>TRY SAYING</span>
                <button
                  onClick={() => setText("Remind me to stretch in 20 minutes")}
                >
                  “Remind me to stretch”
                </button>
                <span>·</span>
                <button onClick={() => setText("What is on my agenda?")}>
                  “What’s my agenda?”
                </button>
                <span className="command-privacy">
                  {desktop ? "Saved on your Mac" : "Saved in this browser"}
                </span>
              </div>
            </div>
          </div>
          <aside className="right-column">
            <div className="day-heading">
              <div>
                <span className="eyebrow">SCHEDULE / LIVE FEED</span>
                <h2>
                  {new Date(now).toLocaleDateString([], { weekday: "long" })}
                  <span>{new Date(now).getDate()}</span>
                </h2>
              </div>
              <CalendarDays size={19} />
            </div>
            <section className="agenda-section">
              <div className="panel-heading">
                <h3>Coming up</h3>
                <button
                  className="icon-button"
                  aria-label="Refresh Apple Calendar"
                  onClick={() => sync("calendar")}
                  disabled={!!syncing}
                >
                  <RefreshCw
                    size={14}
                    className={syncing === "calendar" ? "spin" : ""}
                  />
                </button>
              </div>
              <div className="agenda-list">
                {upcomingEvents.slice(0, 4).map((e) => (
                  <div className="agenda-item" key={e.id + e.start}>
                    <span className="agenda-time">
                      {e.allDay ? "ALL DAY" : time(e.start)}
                      <small>{shortDate(e.start)}</small>
                    </span>
                    <div>
                      <strong>{e.title}</strong>
                      <small>{e.calendar}</small>
                    </div>
                  </div>
                ))}
                {!upcomingEvents.length && (
                  <div className="agenda-empty">
                    <CalendarDays size={25} strokeWidth={1} />
                    <p>
                      {syncAt.calendar
                        ? "Your calendar has room."
                        : "Your day, connected."}
                    </p>
                    <span>
                      {syncAt.calendar
                        ? "No upcoming events in the next 7 days."
                        : "Bring your Apple Calendar into view."}
                    </span>
                    <button
                      className="text-button"
                      disabled={!!syncing}
                      onClick={() => sync("calendar")}
                    >
                      {syncAt.calendar
                        ? "Refresh calendar"
                        : "Connect calendar"}{" "}
                      <ArrowRight size={13} />
                    </button>
                  </div>
                )}
              </div>
            </section>
            <section className="reminder-section">
              <div className="panel-heading">
                <h3>
                  Reminders{" "}
                  <span className="count">{pendingReminders.length}</span>
                </h3>
                <button
                  className="icon-button"
                  aria-label="Add reminder"
                  onClick={() => setModal("reminder")}
                >
                  <Plus size={16} />
                </button>
              </div>
              {pendingReminders.slice(0, 5).map((r) => (
                <div
                  className={
                    "reminder-item " +
                    (Date.parse(r.due) <= now ? "overdue" : "")
                  }
                  key={r.id}
                >
                  <button
                    className="check-button"
                    aria-label={"Complete reminder " + r.title}
                    onClick={() =>
                      update((s) => ({
                        ...s,
                        reminders: s.reminders.map((x) =>
                          x.id === r.id ? { ...x, done: true } : x,
                        ),
                      }))
                    }
                  />
                  <div>
                    <strong>{r.title}</strong>
                    <small>
                      {Date.parse(r.due) <= now ? "Due · " : ""}
                      {shortDate(r.due)} · {time(r.due)}
                    </small>
                  </div>
                  <button
                    className="icon-button"
                    aria-label={"Delete reminder " + r.title}
                    onClick={() =>
                      update((s) => ({
                        ...s,
                        reminders: s.reminders.filter((x) => x.id !== r.id),
                      }))
                    }
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
              {!pendingReminders.length && (
                <div className="reminder-empty">
                  <div className="reminder-illustration">
                    <Bell size={20} />
                    <span>+</span>
                  </div>
                  <p>No pending reminders.</p>
                  <small>Say “Remind me” with a task and time.</small>
                  <button
                    className="text-button"
                    onClick={() => setModal("reminder")}
                  >
                    Set a reminder <Plus size={13} />
                  </button>
                </div>
              )}
              {pendingReminders.length > 5 && (
                <button
                  className="text-button"
                  onClick={() => setModal("allReminders")}
                >
                  View all {pendingReminders.length} reminders
                </button>
              )}
              {appleReminders.length > 0 && (
                <div className="apple-reminders">
                  <div className="eyebrow">FROM APPLE REMINDERS</div>
                  {appleReminders.slice(0, 5).map((r) => (
                    <p key={r.id}>
                      {r.title}
                      <small>{r.due ? shortDate(r.due) : "No due date"}</small>
                    </p>
                  ))}
                </div>
              )}
            </section>
            <section className="inbox-section">
              <div className="panel-heading">
                <h3>Inbox preview</h3>
                <Mail size={15} />
              </div>
              {mail ? (
                <>
                  <div className="inbox-count">
                    {mail.count} unread in Apple Mail
                  </div>
                  {mail.messages.slice(0, 3).map((m, i) => (
                    <div className="mail-row" key={i}>
                      <span className="status-dot" />
                      <div>
                        <strong>{m.title}</strong>
                        <small>{m.sender}</small>
                      </div>
                    </div>
                  ))}
                  <button className="text-button" onClick={() => sync("mail")}>
                    Refresh inbox <RefreshCw size={12} />
                  </button>
                </>
              ) : (
                <div className="inbox-empty">
                  <span>Mail connection is not active.</span>
                  <button className="text-button" onClick={() => sync("mail")}>
                    Connect Apple Mail <ArrowRight size={13} />
                  </button>
                </div>
              )}
            </section>
            <div className="day-note">
              <Command size={18} />
              <p>
                VOICE COMMAND REFERENCE
                <br />
                <button
                  className="text-button"
                  onClick={() => setModal("commands")}
                >
                  Say “Show commands” <ArrowUpRight size={12} />
                </button>
              </p>
            </div>
          </aside>
        </div>
        <footer className="statusbar">
          <span>
            <span className="status-dot green" />
            ASTER <i>·</i>{" "}
            {standby
              ? "Standby · say Aster"
              : phase === "ready"
                ? "Awaiting command"
                : phase.charAt(0).toUpperCase() + phase.slice(1)}
          </span>
          <span>
            {system
              ? "MAC POINTER ENABLED"
              : camera
                ? "APP GESTURES ENABLED"
                : "GESTURES OFF"}{" "}
            <i>·</i> {time(now)}
          </span>
        </footer>
      </main>
      {toast && (
        <div className="toast" role="status">
          <Orbit size={18} />
          <span>{toast}</span>
          <button
            className="icon-button"
            aria-label="Dismiss message"
            onClick={() => setToast("")}
          >
            <X size={16} />
          </button>
        </div>
      )}
      {modal && (
        <div className="modal-backdrop" onClick={() => setModal(null)}>
          <section
            className={
              "modal " + (modal === "settings" ? "settings-modal" : "")
            }
            role="dialog"
            aria-modal="true"
            aria-label={
              modal === "task"
                ? "Add task"
                : modal === "reminder"
                  ? "Add reminder"
                  : modal === "settings"
                    ? "Settings"
                    : modal
            }
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="modal-close icon-button"
              aria-label="Close dialog"
              onClick={() => setModal(null)}
            >
              <X size={19} />
            </button>
            {["task", "focus"].includes(modal) && (
              <>
                <div className="modal-symbol">
                  <ListTodo />
                </div>
                <h2>
                  {modal === "focus"
                    ? "Give one thing your focus."
                    : "Make a little space."}
                </h2>
                <p>
                  {modal === "focus"
                    ? "Choose an existing task or start something new."
                    : "What would you like to get done?"}
                </p>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const title = new FormData(e.currentTarget).get("title");
                    const t = addTask(title);
                    if (t && modal === "focus") focusTask(t);
                    setModal(null);
                  }}
                >
                  <label>
                    Task name
                    <input
                      autoFocus
                      name="title"
                      required
                      maxLength={200}
                      placeholder="e.g. Finish my project proposal"
                    />
                  </label>
                  <button className="primary-button">
                    {modal === "focus" ? "Start 25-minute focus" : "Add task"}
                    <ArrowRight size={15} />
                  </button>
                </form>
                {modal === "focus" && openTasks.length > 0 && (
                  <div className="focus-picker">
                    {openTasks.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => {
                          focusTask(t);
                          setModal(null);
                        }}
                      >
                        {t.title}
                        <Play size={14} />
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
            {modal === "reminder" && (
              <>
                <div className="modal-symbol">
                  <Bell />
                </div>
                <h2>A little nudge, later.</h2>
                <p>
                  {desktop
                    ? "Reminders alert while Aster is running, even with its window closed."
                    : "In this preview, reminders appear while the page is open."}
                </p>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const f = new FormData(e.currentTarget);
                    if (addReminder(f.get("title"), f.get("due")))
                      setModal(null);
                  }}
                >
                  <label>
                    Remind me to
                    <input
                      autoFocus
                      name="title"
                      placeholder="Take a break"
                      required
                      maxLength={200}
                    />
                  </label>
                  <label>
                    When
                    <input
                      type="datetime-local"
                      name="due"
                      required
                      defaultValue={new Date(
                        Date.now() +
                          30 * 60000 -
                          new Date().getTimezoneOffset() * 60000,
                      )
                        .toISOString()
                        .slice(0, 16)}
                    />
                  </label>
                  <button className="primary-button">
                    Set reminder
                    <Bell size={15} />
                  </button>
                </form>
              </>
            )}
            {modal === "call" && (
              <>
                <div className="modal-symbol">
                  <Phone />
                </div>
                <h2>Make a connection.</h2>
                <p>
                  Continue in FaceTime to place your call. Phone calls need your
                  iPhone’s Calls on Other Devices setup.
                </p>
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const address = new FormData(e.currentTarget).get(
                      "address",
                    );
                    try {
                      if (desktop) await window.aster.call(address);
                      else
                        window.location.href =
                          "facetime:" + encodeURIComponent(address);
                      setModal(null);
                    } catch (err) {
                      notify(err.message);
                    }
                  }}
                >
                  <label>
                    Phone number or email
                    <input
                      autoFocus
                      name="address"
                      required
                      placeholder="Phone number or Apple Account email"
                    />
                  </label>
                  <button className="primary-button">
                    Continue in FaceTime
                    <ArrowUpRight size={15} />
                  </button>
                </form>
              </>
            )}
            {modal === "notifications" && (
              <>
                <div className="modal-symbol">
                  <Bell />
                </div>
                <h2>Your notifications.</h2>
                <p>Reminders and focus updates from Aster.</p>
                {!data.notifications.length ? (
                  <div className="empty-state">
                    Nothing needs your attention right now.
                  </div>
                ) : (
                  <>
                    <button
                      className="text-button"
                      onClick={() =>
                        update((s) => ({
                          ...s,
                          notifications: s.notifications.map((n) => ({
                            ...n,
                            read: true,
                          })),
                        }))
                      }
                    >
                      Mark all as read <CheckCheck size={15} />
                    </button>
                    <div className="notification-list">
                      {data.notifications.map((n) => (
                        <div key={n.id} className={n.read ? "read" : ""}>
                          <span className="status-dot" />
                          <div>
                            <strong>{n.title}</strong>
                            <p>{n.body}</p>
                            <small>
                              {shortDate(n.at)} · {time(n.at)}
                            </small>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </>
            )}
            {modal === "allReminders" && (
              <>
                <h2>Your reminders.</h2>
                <div className="notification-list">
                  {pendingReminders.map((r) => (
                    <div key={r.id}>
                      <button
                        className="check-button"
                        aria-label={"Complete reminder " + r.title}
                        onClick={() =>
                          update((s) => ({
                            ...s,
                            reminders: s.reminders.map((x) =>
                              x.id === r.id ? { ...x, done: true } : x,
                            ),
                          }))
                        }
                      />
                      <div>
                        <strong>{r.title}</strong>
                        <p>
                          {shortDate(r.due)} · {time(r.due)}
                        </p>
                      </div>
                      <button
                        className="icon-button"
                        aria-label={"Delete reminder " + r.title}
                        onClick={() =>
                          update((s) => ({
                            ...s,
                            reminders: s.reminders.filter((x) => x.id !== r.id),
                          }))
                        }
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}
            {modal === "commands" && (
              <>
                <div className="modal-symbol">
                  <Mic />
                </div>
                <h2>Voice command reference</h2>
                <p>
                  Speak while the status reads Listening. Aster pauses input
                  during replies. Say “Close panel” to return.
                </p>
                <CommandGuide />
              </>
            )}
            {modal === "settings" && (
              <>
                <div className="modal-symbol">
                  <Settings />
                </div>
                <h2>Assistant configuration</h2>
                <button
                  className="soft-button"
                  onClick={() => {
                    setModal(null);
                    setSetupOpen(true);
                  }}
                >
                  Setup & permissions
                </button>
                <p>Permissions are requested only when you enable a feature.</p>
                <div className="setting-row">
                  <div>
                    <strong>Hands-free on launch</strong>
                    <small>
                      Start listening when the Mac app opens. Say “Go to sleep”
                      for wake-name standby.
                    </small>
                  </div>
                  <button
                    className={
                      "switch " + (data.settings.handsFree ? "on" : "")
                    }
                    aria-label="Hands-free on launch"
                    role="switch"
                    aria-checked={!!data.settings.handsFree}
                    onClick={() =>
                      update((s) => ({
                        ...s,
                        settings: {
                          ...s.settings,
                          handsFree: !s.settings.handsFree,
                        },
                      }))
                    }
                  >
                    <i />
                  </button>
                </div>
                <div className="setting-row">
                  <div>
                    <strong>Clap / snap wake</strong>
                    <small>
                      Experimental sound detection while in standby. Other sharp
                      sounds can trigger it. Microphone must stay on.
                    </small>
                  </div>
                  <button
                    className={
                      "switch " + (data.settings.soundWake ? "on" : "")
                    }
                    aria-label="Clap or snap wake"
                    role="switch"
                    aria-checked={!!data.settings.soundWake}
                    onClick={() =>
                      update((s) => ({
                        ...s,
                        settings: {
                          ...s.settings,
                          soundWake: !s.settings.soundWake,
                        },
                      }))
                    }
                  >
                    <i />
                  </button>
                </div>
                <div className="voice-options">
                  <label>
                    Wake sound
                    <select
                      aria-label="Wake sound"
                      value={data.settings.wakeMode || "double"}
                      onChange={(e) =>
                        update((s) => ({
                          ...s,
                          settings: { ...s.settings, wakeMode: e.target.value },
                        }))
                      }
                    >
                      <option value="double">Two claps / snaps</option>
                      <option value="single">One clap / snap</option>
                    </select>
                  </label>
                  <label>
                    Sensitivity
                    <select
                      aria-label="Wake sensitivity"
                      value={data.settings.wakeThreshold || 0.45}
                      onChange={(e) =>
                        update((s) => ({
                          ...s,
                          settings: {
                            ...s.settings,
                            wakeThreshold: Number(e.target.value),
                          },
                        }))
                      }
                    >
                      <option value={0.2}>High</option>
                      <option value={0.45}>Balanced</option>
                      <option value={0.7}>Low</option>
                    </select>
                  </label>
                </div>
                <div className="setting-row">
                  <div>
                    <strong>Start in standby</strong>
                    <small>
                      Wait for “Aster” or the wake sound when the app opens.
                    </small>
                  </div>
                  <button
                    className={
                      "switch " + (data.settings.startInStandby ? "on" : "")
                    }
                    aria-label="Start in standby"
                    role="switch"
                    aria-checked={!!data.settings.startInStandby}
                    onClick={() =>
                      update((s) => ({
                        ...s,
                        settings: {
                          ...s.settings,
                          startInStandby: !s.settings.startInStandby,
                        },
                      }))
                    }
                  >
                    <i />
                  </button>
                </div>
                <label>
                  Your name
                  <input
                    value={data.settings.name}
                    maxLength={40}
                    placeholder="What should I call you?"
                    onChange={(e) =>
                      update((s) => ({
                        ...s,
                        settings: { ...s.settings, name: e.target.value },
                      }))
                    }
                  />
                </label>
                <div className="setting-row">
                  <div>
                    <strong>Spoken replies</strong>
                    <small>Aster reads its responses aloud.</small>
                  </div>
                  <button
                    className={"switch " + (data.settings.voice ? "on" : "")}
                    aria-label="Spoken replies"
                    role="switch"
                    aria-checked={data.settings.voice}
                    onClick={() =>
                      update((s) => ({
                        ...s,
                        settings: { ...s.settings, voice: !s.settings.voice },
                      }))
                    }
                  >
                    <i />
                  </button>
                </div>
                <label>
                  Aster’s voice
                  <select
                    aria-label="Aster voice"
                    value={data.settings.voiceId || ""}
                    onChange={(e) =>
                      update((s) => ({
                        ...s,
                        settings: { ...s.settings, voiceId: e.target.value },
                      }))
                    }
                  >
                    {voices.map((v) => (
                      <option value={v.id} key={v.id}>
                        {v.name} · {v.language}
                        {v.quality === 3
                          ? " · Neural"
                          : v.quality > 1
                            ? " · Enhanced"
                            : " · System"}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="voice-options">
                  <label>
                    Speaking pace
                    <select
                      aria-label="Speaking pace"
                      value={data.settings.voiceRate || 0.48}
                      onChange={(e) =>
                        update((s) => ({
                          ...s,
                          settings: {
                            ...s.settings,
                            voiceRate: Number(e.target.value),
                          },
                        }))
                      }
                    >
                      <option value={0.42}>Relaxed</option>
                      <option value={0.48}>Natural</option>
                      <option value={0.54}>Brisk</option>
                    </select>
                  </label>
                  <button
                    className="soft-button"
                    disabled={busy || !voices.length}
                    onClick={previewVoice}
                  >
                    <Volume2 size={14} /> Preview voice
                  </button>
                </div>
                <div className="setting-row">
                  <div>
                    <strong>Control the Mac pointer</strong>
                    <small>
                      Enable the camera first. Requires Accessibility.
                    </small>
                  </div>
                  <button
                    className={"switch " + (system ? "on" : "")}
                    aria-label="Control the Mac pointer"
                    role="switch"
                    aria-checked={system}
                    disabled={!desktop || !camera}
                    onClick={async () => {
                      try {
                        const enabled = await window.aster.arm(!system);
                        setSystem(enabled);
                      } catch (e) {
                        notify(e.message);
                      }
                    }}
                  >
                    <i />
                  </button>
                </div>
                {desktop && (
                  <button
                    className="text-button"
                    onClick={() =>
                      window.aster
                        .native({ action: "requestAccessibility" })
                        .then((s) =>
                          notify(
                            s.accessibility
                              ? "Accessibility is enabled."
                              : "Enable Aster in the Accessibility settings, then return here.",
                          ),
                        )
                        .catch((e) => notify(e.message))
                    }
                  >
                    Review Accessibility permission <ExternalLink size={13} />
                  </button>
                )}
                <div className="setting-divider" />
                <div className="setting-row">
                  <div>
                    <strong>Local conversation model</strong>
                    <small>
                      {aiStatus === "ready"
                        ? "Connected on this Mac · no API key needed."
                        : aiStatus === "connecting"
                          ? "Connecting to the local model…"
                          : "Reconnect to the model on this Mac."}
                    </small>
                  </div>
                  <button
                    className="soft-button"
                    onClick={async () => {
                      const m = await refreshModels();
                      notify(
                        m.length
                          ? "Local model connected."
                          : "No local model available yet.",
                      );
                    }}
                  >
                    <RefreshCw size={14} /> Reconnect
                  </button>
                </div>
                <label>
                  Conversation mode
                  <select
                    value={data.settings.model}
                    onChange={(e) =>
                      update((s) => ({
                        ...s,
                        settings: {
                          ...s.settings,
                          model: e.target.value,
                          modelConfigured: true,
                        },
                      }))
                    }
                  >
                    <option value="">
                      Essential commands · no AI required
                    </option>
                    {[
                      ...new Set([
                        ...models,
                        ...(data.settings.model ? [data.settings.model] : []),
                      ]),
                    ].map((m) => (
                      <option key={m}>{m}</option>
                    ))}
                  </select>
                </label>
                <p className="settings-note">
                  Hand video stays on this device. Speech may be processed by
                  Apple or your browser’s speech service. Local AI receives
                  recent conversation messages, including any service summaries
                  you asked Aster to read. It can request supported commands.
                  Cloud models are not connected.
                </p>
                <div className="safety-strip">
                  <Command size={15} />
                  <strong>⇧ Esc</strong>
                  <span>
                    Stop voice, camera, and pointer from anywhere in the Mac
                    app.
                  </span>
                </div>
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
createRoot(document.getElementById("root")).render(<App />);
