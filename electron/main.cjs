const {
  app,
  BrowserWindow,
  ipcMain,
  shell,
  Notification,
  globalShortcut,
  session,
  Menu,
  systemPreferences,
  powerMonitor,
} = require("electron");
const { spawn } = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const ai = require("./ai.cjs");
const mac = require("./system.cjs");
const comm = require("./communications.cjs").createCommunications(
  native,
  (url) => shell.openExternal(url),
);
const { SERVICES, validState, trustedFrame } = require("./security.cjs");
if (process.env.ASTER_TEST_DATA)
  app.setPath("userData", process.env.ASTER_TEST_DATA);
if (!app.requestSingleInstanceLock()) {
  app.quit();
  process.exit(0);
}
app.on("second-instance", () => {
  if (app.isReady()) show();
});
let armGeneration = 0;
let win,
  helper,
  armed = false,
  buffer = "",
  nextId = 0,
  state,
  store,
  quitting = false,
  lastPointer = 0;
const pending = new Map();
const entry = path.join(__dirname, "../dist/index.html");
const nativePath = () =>
  app.isPackaged
    ? path.join(process.resourcesPath, "AsterBridge")
    : path.join(__dirname, "../native/build/AsterBridge");
function emit(channel, data) {
  if (win && !win.isDestroyed()) win.webContents.send(channel, data);
}
function native(command) {
  return new Promise((resolve, reject) => {
    if (!helper) {
      reject(
        new Error("The Mac bridge is unavailable. Rebuild the desktop app."),
      );
      return;
    }
    const id = ++nextId;
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(
        new Error(
          "Permission request timed out. Check System Settings → Privacy & Security and try again.",
        ),
      );
    }, 90000);
    pending.set(id, { resolve, reject, timer });
    helper.stdin.write(JSON.stringify({ ...command, id }) + "\n");
  });
}
function startHelper() {
  if (process.platform !== "darwin" || !fs.existsSync(nativePath())) return;
  helper = spawn(nativePath(), [], { stdio: ["pipe", "pipe", "pipe"] });
  helper.stdout.on("data", (chunk) => {
    buffer += chunk;
    let idx;
    while ((idx = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 1);
      try {
        const msg = JSON.parse(line);
        if (msg.id && pending.has(msg.id)) {
          const p = pending.get(msg.id);
          clearTimeout(p.timer);
          pending.delete(msg.id);
          msg.error ? p.reject(new Error(msg.error)) : p.resolve(msg);
        } else emit("native:event", msg);
      } catch {}
    }
  });
  helper.stderr.on("data", () => {});
  helper.on("error", () => {});
  helper.on("exit", () => {
    helper = null;
    armed = false;
    for (const p of pending.values()) {
      clearTimeout(p.timer);
      p.reject(new Error("Mac bridge stopped. Restart Aster."));
    }
    pending.clear();
    emit("controls:stop", {});
  });
}
function save() {
  const tmp = store + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(state), { mode: 0o600 });
  fs.renameSync(tmp, store);
}
function releasePointer() {
  if (helper)
    helper.stdin.write(
      JSON.stringify({ action: "pointer", kind: "release" }) + "\n",
    );
}
function stop() {
  armGeneration++;
  releasePointer();
  if (helper) native({ action: "recordStop" }).catch(() => {});
  comm.cancel();
  armed = false;
  if (helper) {
    helper.stdin.write(JSON.stringify({ action: "speechStop" }) + "\n");
    helper.stdin.write(JSON.stringify({ action: "ttsStop" }) + "\n");
  }
  emit("controls:stop", {});
}
function show() {
  if (!win || win.isDestroyed()) createWindow();
  win.show();
  win.focus();
}
function createWindow() {
  win = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 980,
    minHeight: 700,
    title: "Aster",
    backgroundColor: "#050d18",
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 20, y: 22 },
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      backgroundThrottling: false,
    },
  });
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  win.webContents.on("will-navigate", (e) => e.preventDefault());
  win.on("close", (e) => {
    if (!quitting) {
      e.preventDefault();
      if (state?.settings?.handsFree) {
        armed = false;
        releasePointer();
        emit("controls:hide", {});
      } else stop();
      win.hide();
    }
  });
  win.webContents.on("render-process-gone", () => {
    releasePointer();
    armed = false;
  });
  win.loadFile(entry);
}
function handle(name, fn) {
  ipcMain.handle(name, async (e, ...args) => {
    if (!trustedFrame(e, entry)) throw Error("Untrusted frame");
    return fn(...args);
  });
}
app.whenReady().then(async () => {
  const { createInitialState, dueReminders } = await import(
    "../src/commands.mjs"
  );
  store = path.join(app.getPath("userData"), "workspace.json");
  try {
    state = JSON.parse(fs.readFileSync(store, "utf8"));
    if (!validState(state)) throw Error();
  } catch {
    state = createInitialState();
  }
  startHelper();
  session.defaultSession.setPermissionRequestHandler(
    async (wc, permission, callback, details) => {
      const trusted =
        wc === win?.webContents &&
        details.requestingUrl === require("node:url").pathToFileURL(entry).href;
      if (!trusted || permission !== "media") {
        callback(false);
        return;
      }
      try {
        const types = details.mediaTypes || [];
        const checks = await Promise.all(
          types.map((t) =>
            systemPreferences.askForMediaAccess(
              t === "video" ? "camera" : "microphone",
            ),
          ),
        );
        callback(types.length > 0 && checks.every(Boolean));
      } catch {
        callback(false);
      }
    },
  );
  session.defaultSession.setPermissionCheckHandler(
    (wc, permission, origin, details) =>
      wc === win?.webContents && permission === "media" && details.isMainFrame,
  );
  handle("state:load", () => state);
  handle("state:save", (s) => {
    if (!validState(s)) throw Error("Invalid workspace");
    state = s;
    save();
    return true;
  });
  handle("service:open", async (name) => {
    if (!Object.hasOwn(SERVICES, name)) throw Error("Unknown service");
    await shell.openExternal(SERVICES[name]);
    return true;
  });
  handle("web:search", async (query) => {
    if (typeof query !== "string" || query.length > 500)
      throw Error("Invalid search");
    await shell.openExternal(
      "https://www.google.com/search?q=" + encodeURIComponent(query),
    );
    return true;
  });
  handle("call:open", async (address) => {
    if (typeof address !== "string" || !/^\+?[\w@.\- ]{3,100}$/.test(address))
      throw Error("Enter a phone number or email address");
    await shell.openExternal("facetime:" + encodeURIComponent(address.trim()));
    return true;
  });
  handle("native:command", (cmd) => {
    if (
      !cmd ||
      ![
        "status",
        "speechStart",
        "speechStop",
        "calendar",
        "reminders",
        "mail",
        "activeApp",
        "requestAccessibility",
      ].includes(cmd.action)
    )
      throw Error("Unknown command");
    return native({
      action: cmd.action,
      ...(cmd.action === "speechStart"
        ? {
            wakeEnabled: cmd.wakeEnabled === true,
            wakeMode: cmd.wakeMode === "single" ? "single" : "double",
            wakeThreshold: Number.isFinite(cmd.wakeThreshold)
              ? Math.max(0.15, Math.min(0.85, cmd.wakeThreshold))
              : 0.45,
          }
        : {}),
    });
  });
  handle("pointer:arm", async (value) => {
    if (typeof value !== "boolean") throw Error("Invalid control");
    const token = ++armGeneration;
    if (value) {
      const s = await native({ action: "status" });
      if (token !== armGeneration) throw Error("Pointer request cancelled.");
      if (!s.accessibility)
        throw Error(
          "Enable Aster in System Settings → Privacy & Security → Accessibility, then try again.",
        );
    }
    if (!value) releasePointer();
    armed = value;
    return armed;
  });
  ipcMain.on("pointer:move", (e, p) => {
    if (!trustedFrame(e, entry) || !helper || !p) return;
    if (p.kind === "release") {
      releasePointer();
      return;
    }
    if (
      !armed ||
      ![
        "move",
        "drag",
        "down",
        "up",
        "click",
        "doubleClick",
        "scroll",
        "zoomIn",
        "zoomOut",
        "desktopNext",
        "desktopPrevious",
      ].includes(p.kind)
    )
      return;
    if (![p.x, p.y, p.delta || 0].every(Number.isFinite)) return;
    const now = Date.now();
    if (["move", "drag"].includes(p.kind) && now - lastPointer < 25) return;
    lastPointer = now;
    helper.stdin.write(
      JSON.stringify({
        action: "pointer",
        kind: p.kind,
        x: Math.max(0, Math.min(1, p.x)),
        y: Math.max(0, Math.min(1, p.y)),
        delta: Math.max(-80, Math.min(80, p.delta || 0)),
      }) + "\n",
    );
  });
  handle("capture:command", (c) => {
    if (
      !c ||
      ![
        "screenshot",
        "recordStart",
        "recordStop",
        "captureStatus",
        "openCaptures",
      ].includes(c.action)
    )
      throw Error("Unsupported capture command");
    return native({ action: c.action });
  });
  handle("setup:ai", () =>
    require("./setup-ai.cjs").install((p) => emit("setup:progress", p)),
  );
  handle("setup:cancel", () => require("./setup-ai.cjs").cancel());
  handle("ai:draftEmail", (model, brief) => ai.draftEmail(model, brief));
  handle("mac:telemetry", async () => ({
    ...(await mac.telemetry()),
    ...(await native({ action: "activeApp" })),
    ...(await native({ action: "status" })),
  }));
  handle("ui:control", (command) => native(mac.validateUI(command)));
  handle("communication:prepare", (command) => comm.prepare(command));
  handle("communication:confirm", (token, kind) => comm.confirm(token, kind));
  handle("communication:cancel", () => comm.cancel());
  handle("window:show", () => {
    show();
    return true;
  });
  handle("web:open", async (command) => {
    const c = mac.validateWeb(command);
    return native(c);
  });
  handle("mac:control", (command) => mac.control(command, native));
  handle("ai:route", (model, messages) => ai.route(model, messages));
  handle("ai:models", () => ai.listModels());
  handle("ai:chat", (model, messages) => ai.chat(model, messages));
  handle("voice:list", async () => {
    const { voices } = await import("./neural-voice.mjs");
    const system = await native({ action: "ttsVoices" });
    return { voices: [...voices, ...system.voices] };
  });
  handle("voice:speak", (text, voice, rate) => {
    if (
      typeof text !== "string" ||
      !text ||
      text.length > 2000 ||
      typeof voice !== "string" ||
      voice.length > 200 ||
      !Number.isFinite(rate) ||
      rate < 0.35 ||
      rate > 0.6
    )
      throw Error("Invalid speech request");
    if (voice.startsWith("kokoro:"))
      return import("./neural-voice.mjs").then((m) =>
        m.synthesize(text, voice, rate),
      );
    return native({ action: "ttsSpeak", text, voice, rate });
  });
  handle("voice:stop", () => native({ action: "ttsStop" }));
  setInterval(() => {
    const due = dueReminders(state.reminders);
    if (!due.length) return;
    for (const r of due) {
      r.notified = true;
      state.notifications.unshift({
        id: crypto.randomUUID(),
        title: r.title,
        body: "Reminder is due",
        at: new Date().toISOString(),
        read: false,
      });
      if (Notification.isSupported()) {
        const n = new Notification({
          title: "Aster · Reminder",
          body: r.title,
        });
        n.on("click", show);
        n.show();
      }
    }
    state.notifications = state.notifications.slice(0, 100);
    save();
    emit("state:updated", state);
  }, 1000);
  powerMonitor.on("lock-screen", stop);
  powerMonitor.on("suspend", stop);
  globalShortcut.register("CommandOrControl+Shift+Escape", stop);
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      {
        label: "Aster",
        submenu: [
          { label: "Show Aster", click: show },
          {
            label: "Stop camera, voice & pointer",
            accelerator: "CommandOrControl+Shift+Escape",
            click: stop,
          },
          { type: "separator" },
          { role: "quit" },
        ],
      },
      { role: "editMenu" },
      { role: "viewMenu" },
      { role: "windowMenu" },
    ]),
  );
  createWindow();
  app.on("activate", show);
});
app.on("before-quit", (event) => {
  if (!quitting && helper) {
    event.preventDefault();
    quitting = true;
    releasePointer();
    native({ action: "recordStop" })
      .catch(() => {})
      .finally(() => {
        helper?.kill();
        app.quit();
      });
    return;
  }
  quitting = true;
  require("./setup-ai.cjs").cancel();
  helper?.kill();
  globalShortcut.unregisterAll();
});
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
