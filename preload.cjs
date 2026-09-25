const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  generateXml: (data) => ipcRenderer.invoke('generate-xml', data),
  listWorkflows: () => ipcRenderer.invoke('list-workflows'),
  saveWorkflow: (workflow) => ipcRenderer.invoke('save-workflow', workflow),
  deleteWorkflow: (workflowId) => ipcRenderer.invoke('delete-workflow', workflowId)
});