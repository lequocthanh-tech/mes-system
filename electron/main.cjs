const { app, BrowserWindow } = require('electron');
const path = require('node:path');
const { spawn, execSync } = require('node:child_process');

const isDev = !app.isPackaged;

let pythonProcess = null;
let pythonGatewayPid = null;
let isShuttingDown = false;

/**
 * Force kill a process and its entire process tree on Windows
 */
function forceKillPid(pid) {
  if (!pid || pid === 0 || pid === process.pid) return;
  try {
    if (process.platform === 'win32') {
      execSync(`taskkill /F /T /PID ${pid}`, { stdio: 'ignore' });
    } else {
      process.kill(-pid, 'SIGKILL');
    }
  } catch (_) {
    // Process might already be terminated
  }
}

/**
 * Scans a port and forcefully terminates any process holding it
 */
function killProcessOnPort(port) {
  try {
    const netstatOut = execSync(`netstat -ano | findstr :${port}`, {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    const lines = netstatOut.trim().split(/\r?\n/);
    for (const line of lines) {
      if (line.includes('LISTENING')) {
        const parts = line.trim().split(/\s+/);
        const pidStr = parts[parts.length - 1];
        const pidNum = parseInt(pidStr, 10);
        if (pidNum && pidNum > 0 && pidNum !== process.pid) {
          forceKillPid(pidNum);
        }
      }
    }
  } catch (_) {}
}

/**
 * Clean up all child processes, Python Gateway, and background services
 */
function stopBackendService() {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log('[Lifecycle] Initiating shutdown: Terminating Python Gateway and background processes...');

  // 1. Force kill spawned child process if tracked
  if (pythonProcess) {
    try {
      pythonProcess.kill('SIGTERM');
    } catch (_) {}
  }

  if (pythonGatewayPid) {
    console.log(`[Lifecycle] Force killing Python Gateway PID: ${pythonGatewayPid}`);
    forceKillPid(pythonGatewayPid);
    pythonGatewayPid = null;
  }

  if (pythonProcess && pythonProcess.pid) {
    forceKillPid(pythonProcess.pid);
    pythonProcess = null;
  }

  // 2. Terminate any orphan process listening on port 8000
  killProcessOnPort(8000);

  // 3. In dev mode, clean up Vite dev server processes on port 3000 / 5173
  if (isDev) {
    killProcessOnPort(3000);
    killProcessOnPort(5173);
  }

  console.log('[Lifecycle] Clean process lifecycle complete. Zero background footprint.');
}

/**
 * Automated Process Manager:
 * Spawns and supervises backend/kepware_gateway.py in background without CMD popup
 */
function startBackendService() {
  // Clear any zombie process from port 8000 before starting fresh instance
  killProcessOnPort(8000);

  const pythonPath = process.platform === 'win32' ? 'python' : 'python3';
  const scriptPath = path.join(__dirname, '..', 'backend', 'kepware_gateway.py');

  console.log(`[Lifecycle] Spawning Python Gateway: ${pythonPath} ${scriptPath}`);

  pythonProcess = spawn(pythonPath, [scriptPath], {
    cwd: path.join(__dirname, '..'),
    stdio: 'pipe',
    shell: true,
    windowsHide: true, // Runs completely hidden in background without popping up CMD windows
  });

  if (pythonProcess && pythonProcess.pid) {
    pythonGatewayPid = pythonProcess.pid;
    console.log(`[Lifecycle] Stored Python Gateway child PID: ${pythonGatewayPid}`);
  }

  pythonProcess.stdout.on('data', (data) => {
    console.log(`[Python Gateway]: ${data.toString().trim()}`);
  });

  pythonProcess.stderr.on('data', (data) => {
    console.error(`[Python Gateway Error]: ${data.toString().trim()}`);
  });

  pythonProcess.on('close', (code) => {
    console.log(`[Python Gateway] Process exited with code ${code}`);
  });

  pythonProcess.on('error', (err) => {
    console.error(`[Python Gateway] Failed to start process:`, err);
  });
}

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    autoHideMenuBar: false,
    title: 'MES PRODUCTION SYSTEM',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.setZoomFactor(1.18);
  });

  if (isDev) {
    // In dev mode, load the Vite dev server with retry mechanism
    // DevTools disabled by default so the app boots cleanly into full view
    const devUrl = 'http://localhost:3000';

    const loadDevServer = () => {
      mainWindow.loadURL(devUrl).catch((err) => {
        console.log('Vite server not ready yet, retrying in 1s...', err.message);
        setTimeout(loadDevServer, 1000);
      });
    };

    loadDevServer();
  } else {
    // In production mode, load the static build files
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(() => {
  startBackendService();
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Force kill on all exit and closure vectors
app.on('before-quit', () => {
  stopBackendService();
});

app.on('will-quit', () => {
  stopBackendService();
});

app.on('window-all-closed', function () {
  stopBackendService();
  if (process.platform !== 'darwin') app.quit();
});

process.on('exit', () => {
  stopBackendService();
});

process.on('SIGINT', () => {
  stopBackendService();
  process.exit(0);
});

process.on('SIGTERM', () => {
  stopBackendService();
  process.exit(0);
});
