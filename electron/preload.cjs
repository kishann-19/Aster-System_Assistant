const { contextBridge, ipcRenderer } = require("electron");
const on = (channel, fn) => {
  const listener = (_, data) => fn(data);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
};
contextBridge.exposeInMainWorld("aster", {
  desktop: true,
  setupAI: () => ipcRenderer.invoke("setup:ai"),
  cancelSetup: () => ipcRenderer.invoke("setup:cancel"),
  onSetup: (fn) => on("setup:progress", fn),
  capture: (c) => ipcRenderer.invoke("capture:command", c),
  draftEmail: (model, brief) =>
    ipcRenderer.invoke("ai:draftEmail", model, brief),
  load: () => ipcRenderer.invoke("state:load"),
  save: (s) => ipcRenderer.invoke("state:save", s),
  native: (command) => ipcRenderer.invoke("native:command", command),
  open: (app) => ipcRenderer.invoke("service:open", app),
  search: (query) => ipcRenderer.invoke("web:search", query),
  call: (address) => ipcRenderer.invoke("call:open", address),
  arm: (enabled) => ipcRenderer.invoke("pointer:arm", enabled),
  pointer: (data) => ipcRenderer.send("pointer:move", data),
  voices: () => ipcRenderer.invoke("voice:list"),
  speak: (text, voice, rate) =>
    ipcRenderer.invoke("voice:speak", text, voice, rate),
  stopSpeaking: () => ipcRenderer.invoke("voice:stop"),
  ui: (c) => ipcRenderer.invoke("ui:control", c),
  prepareCommunication: (c) => ipcRenderer.invoke("communication:prepare", c),
  confirmCommunication: (token, kind) =>
    ipcRenderer.invoke("communication:confirm", token, kind),
  cancelCommunication: () => ipcRenderer.invoke("communication:cancel"),
  reveal: () => ipcRenderer.invoke("window:show"),
  browse: (c) => ipcRenderer.invoke("web:open", c),
  onHide: (fn) => on("controls:hide", fn),
  telemetry: () => ipcRenderer.invoke("mac:telemetry"),
  control: (c) => ipcRenderer.invoke("mac:control", c),
  route: (model, messages) => ipcRenderer.invoke("ai:route", model, messages),
  models: () => ipcRenderer.invoke("ai:models"),
  chat: (model, messages) => ipcRenderer.invoke("ai:chat", model, messages),
  onNative: (fn) => on("native:event", fn),
  onState: (fn) => on("state:updated", fn),
  onStop: (fn) => on("controls:stop", fn),
});
