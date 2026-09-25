const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  generateXml: (data) => ipcRenderer.invoke('generate-xml', data)
});