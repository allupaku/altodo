import { BrowserWindow, screen } from 'electron';
import * as path from 'path';
import type { AppSettings, DisplayInfo } from '../shared/models/settings';

interface WindowManagerOptions {
  getSettings: () => AppSettings;
  isDev: boolean;
  devServerUrl: string;
  preloadPath: string;
}

export function createWindowManager(options: WindowManagerOptions) {
  let mainWindow: BrowserWindow | null = null;

  function buildDisplayOptions(): DisplayInfo[] {
    const displays = screen.getAllDisplays();
    return displays.map((d, index) => ({
      id: d.id,
      label: `Display ${index + 1} (${d.bounds.width}x${d.bounds.height})`,
    }));
  }

  function pickDisplay() {
    const displays = screen.getAllDisplays();
    if (!displays.length) return null;
    const settings = options.getSettings();
    return displays.find((d) => d.id === settings.displayId) || screen.getPrimaryDisplay();
  }

  function computeWidth(workArea: Electron.Rectangle) {
    const settings = options.getSettings();
    const mode = settings.widthMode || 'px';
    let rawValue = Number(settings.widthValue) || (mode === 'percent' ? 30 : 360);
    if (mode === 'percent') {
      rawValue = Math.max(10, Math.min(rawValue, 80));
    } else {
      rawValue = Math.max(260, rawValue);
    }
    return mode === 'percent' ? Math.round(workArea.width * (rawValue / 100)) : rawValue;
  }

  function computeBounds() {
    const display = pickDisplay();
    if (!display) return null;
    const workArea = display.workArea;
    const width = computeWidth(workArea);
    const height = workArea.height;
    const settings = options.getSettings();
    const x = settings.dockRight ? workArea.x + workArea.width - width : workArea.x;
    const y = workArea.y;
    return { x, y, width, height };
  }

  function applyWindowPlacement() {
    if (!mainWindow) return;
    const bounds = computeBounds();
    if (!bounds) return;
    mainWindow.setBounds(bounds);
  }

  function createWindow() {
    const settings = options.getSettings();
    mainWindow = new BrowserWindow({
      width: 360,
      height: 720,
      show: false,
      alwaysOnTop: Boolean(settings.alwaysOnTop),
      webPreferences: {
        preload: options.preloadPath,
        contextIsolation: true,
        nodeIntegration: false,
      },
    });

    if (options.isDev) {
      void mainWindow.loadURL(options.devServerUrl);
      mainWindow.webContents.openDevTools({ mode: 'detach' });
    } else {
      const indexPath = path.join(__dirname, '../renderer/index.html');
      void mainWindow.loadFile(indexPath);
    }

    mainWindow.once('ready-to-show', () => {
      applyWindowPlacement();
      mainWindow?.show();
    });

    mainWindow.on('closed', () => {
      mainWindow = null;
    });

    return mainWindow;
  }

  return {
    createWindow,
    applyWindowPlacement,
    buildDisplayOptions,
    getMainWindow: () => mainWindow,
  };
}
