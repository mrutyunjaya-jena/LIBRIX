const { app, BrowserWindow, shell } = require('electron');
const path = require('path');

// Linux sandbox and compatibility flags for modern Linux kernels & display servers
if (process.platform === 'linux') {
  app.commandLine.appendSwitch('no-sandbox');
  app.commandLine.appendSwitch('disable-gpu-sandbox');
  app.commandLine.appendSwitch('disable-dev-shm-usage');
  app.commandLine.appendSwitch('disable-features', 'Vulkan');
}

let mainWindow;

function createWindow() {
  const iconPath = process.platform === 'win32'
    ? path.join(__dirname, '../public/icon.ico')
    : path.join(__dirname, '../public/icon.png');

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 800,
    minHeight: 600,
    title: 'LIBRIX',
    backgroundColor: '#09090b',
    icon: iconPath,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      webSecurity: false, // Ensures local PDF.js workers and SQLite WASM load properly under file://
      allowRunningInsecureContent: false,
    },
    autoHideMenuBar: true,
  });

  // Reveal window smoothly when DOM is ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Fallback to guarantee window visibility
  setTimeout(() => {
    if (mainWindow && !mainWindow.isVisible()) {
      mainWindow.show();
    }
  }, 500);

  // Load the built Vite production app or local dev server
  const isDev = !app.isPackaged && process.env.NODE_ENV === 'development';
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // Open external URLs in the user's default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https:') || url.startsWith('http:')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

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
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
