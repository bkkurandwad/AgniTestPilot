const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getTests: () => ipcRenderer.invoke('get-tests'),
  startRecording: (data) => ipcRenderer.invoke('start-recording', data),
  runTest: (data) => ipcRenderer.invoke('run-test', data),
  stopTest: (data) => ipcRenderer.invoke('stop-test', data),
  deleteTest: (testId) => ipcRenderer.invoke('delete-test', testId),
  updateTest: (data) => ipcRenderer.invoke('update-test', data),
  readTestCode: (testId) => ipcRenderer.invoke('read-test-code', testId),
  rerecordTest: (testId) => ipcRenderer.invoke('rerecord-test', { testId }),
  getHistory: () => ipcRenderer.invoke('get-history'),
  clearHistory: () => ipcRenderer.invoke('clear-history'),
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
  generateReport: (runId) => ipcRenderer.invoke('generate-report', { runId }),
  generateHolisticReport: () => ipcRenderer.invoke('generate-holistic-report'),
  
  // Real-time Event Subscriptions
  onTestLog: (callback) => {
    const listener = (event, data) => callback(data);
    ipcRenderer.on('test-log', listener);
    return () => ipcRenderer.removeListener('test-log', listener);
  },
  onTestFinished: (callback) => {
    const listener = (event, data) => callback(data);
    ipcRenderer.on('test-finished', listener);
    return () => ipcRenderer.removeListener('test-finished', listener);
  }
});
