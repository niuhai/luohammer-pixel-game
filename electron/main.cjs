const { app, BrowserWindow, Menu, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');

const isDev = !app.isPackaged;
const DEV_URL = 'http://localhost:5173';

const userDataPath = path.join(__dirname, '..', '.electron-data');
if (!fs.existsSync(userDataPath)) {
  fs.mkdirSync(userDataPath, { recursive: true });
}
app.setPath('userData', userDataPath);

app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-software-rasterizer');
app.commandLine.appendSwitch('no-sandbox');

const GAME_WIDTH = 1280;
const GAME_HEIGHT = 800;
const MIN_WIDTH = 800;
const MIN_HEIGHT = 500;

let mainWindow = null;

function getIconPath() {
  const candidates = [
    path.join(__dirname, '..', 'public', 'icon-512.png'),
    path.join(__dirname, '..', 'dist', 'icon-512.png'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return undefined;
}

function waitForDevServer(url, timeout = 30000) {
  return new Promise((resolve) => {
    const start = Date.now();
    const check = () => {
      const req = http.get(url, (res) => {
        res.resume();
        if (res.statusCode === 200) {
          resolve(true);
        } else {
          retry();
        }
      });
      req.on('error', retry);
      req.setTimeout(2000, () => { req.destroy(); retry(); });
    };
    const retry = () => {
      if (Date.now() - start > timeout) {
        resolve(false);
      } else {
        setTimeout(check, 1000);
      }
    };
    check();
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    minWidth: MIN_WIDTH,
    minHeight: MIN_HEIGHT,
    title: '真还传·人生模拟',
    icon: getIconPath(),
    backgroundColor: '#0a0a0a',
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  Menu.setApplicationMenu(null);

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  const distIndex = path.join(__dirname, '..', 'dist', 'index.html');

  if (isDev) {
    waitForDevServer(DEV_URL, 60000).then((available) => {
      if (available) {
        mainWindow.loadURL(DEV_URL);
      } else if (fs.existsSync(distIndex)) {
        mainWindow.loadFile(distIndex);
      } else {
        mainWindow.loadURL('data:text/html,<h1 style="color:#e2b04a;font-family:monospace;text-align:center;margin-top:20%%">Vite 开发服务器未启动<br><small>请运行 npm run dev 后重启 Electron</small></h1>');
      }
    });
  } else {
    mainWindow.loadFile(distIndex);
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
