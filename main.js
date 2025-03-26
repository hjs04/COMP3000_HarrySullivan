// Handles the loading of the Electron program

// Dependencies

import { app, BrowserWindow, ipcMain } from 'electron';
import { shell } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';

// Variables

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const expressApp = express();
const serverPort = 3001;

// Setup for Express Server

expressApp.use(express.static(path.join(__dirname, 'public')));
expressApp.listen(serverPort, () => {
  console.log(`Express server running at http://localhost:${serverPort}`);
});

// Setup for Electron Window

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  mainWindow.loadURL(`http://localhost:${serverPort}`).catch(err => {
    console.error('Failed to load main window:', err);
  });
}

// Electron Window

app.whenReady().then(() => {
  console.log('App is ready.');
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// Used for Opening PDF Invoices when generated

ipcMain.on('open-pdf', (event, pdfPath) => {
  console.log('Opening PDF:', pdfPath);
  shell.openPath(pdfPath).then(error => {
    if (error) console.error('Failed to open PDF:', error);
  });
});