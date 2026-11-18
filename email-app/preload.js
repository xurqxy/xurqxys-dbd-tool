'use strict';
const { contextBridge, ipcRenderer } = require('electron');

const call = (ch, ...args) => ipcRenderer.invoke(ch, ...args);

contextBridge.exposeInMainWorld('mail', {
  presets: () => call('account:presets'),
  getAccount: () => call('account:get'),
  signIn: input => call('account:signIn', input),
  signOut: () => call('account:signOut'),
  folders: () => call('mail:folders'),
  list: (folder, page) => call('mail:list', folder, page),
  search: (folder, q) => call('mail:search', folder, q),
  get: (folder, uid) => call('mail:get', folder, uid),
  flag: (folder, uid, flag, on) => call('mail:flag', folder, uid, flag, on),
  remove: (folder, uid) => call('mail:delete', folder, uid),
  archive: (folder, uid) => call('mail:archive', folder, uid),
  move: (folder, uid, target) => call('mail:move', folder, uid, target),
  send: mail => call('mail:send', mail),
  saveDraft: mail => call('mail:saveDraft', mail),
  saveAttachment: (folder, uid, i) => call('mail:saveAttachment', folder, uid, i),
  pickFiles: () => call('dialog:pickFiles'),
  openExternal: url => call('shell:openExternal', url),
  onEvent: cb => ipcRenderer.on('mail:event', (_e, ev) => cb(ev))
});
