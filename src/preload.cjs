const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('crm', {
  summary: () => ipcRenderer.invoke('dashboard:summary'),
  listClients: () => ipcRenderer.invoke('clients:list'),
  createClient: (data) => ipcRenderer.invoke('clients:create', data),
  listLeads: () => ipcRenderer.invoke('leads:list'),
  createLead: (data) => ipcRenderer.invoke('leads:create', data),
  listProjects: () => ipcRenderer.invoke('projects:list'),
  createProject: (data) => ipcRenderer.invoke('projects:create', data),
  listPayments: () => ipcRenderer.invoke('payments:list'),
  createPayment: (data) => ipcRenderer.invoke('payments:create', data),
  listExpenses: () => ipcRenderer.invoke('expenses:list'),
  createExpense: (data) => ipcRenderer.invoke('expenses:create', data),
  listProspects: () => ipcRenderer.invoke('prospects:list'),
  createProspect: (data) => ipcRenderer.invoke('prospects:create', data),
  updateProspect: (data) => ipcRenderer.invoke('prospects:update', data),
  convertProspectToLead: (id) => ipcRenderer.invoke('prospects:convertLead', id),
  importProspectsCsv: () => ipcRenderer.invoke('prospects:importCsv'),
  exportDataCsv: (kind) => ipcRenderer.invoke('data:exportCsv', kind),
  createBackup: () => ipcRenderer.invoke('backup:create'),
  openDataFolder: () => ipcRenderer.invoke('app:openDataFolder'),
  openExternal: (url) => ipcRenderer.invoke('app:openExternal', url),
  version: () => ipcRenderer.invoke('app:version')
});
