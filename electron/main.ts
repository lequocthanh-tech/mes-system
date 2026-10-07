import { app, BrowserWindow } from 'electron';
import path from 'path';
import { spawn, execSync, ChildProcess } from 'child_process';

const isDev = !app.isPackaged;

let pythonProcess: ChildProcess | null = null;
let pythonGatewayPid: number | null = null;
let isShuttingDown = false;

function forceKillPid(pid: number | null) {
  if (!pid || pid === 0 || pid === process.pid) return;
  try {
    if (process.platform === 'win32') {
      execSync(`taskkill /F /T /PID ${pid}`, { stdio: 'ignore' });
    } else {
      process.kill(-pid, 'SIGKILL');
    }
  } catch (_) {
    // Process already terminated
  }
}

function killProcessOnPort(port: number) {
  try {
    const netstatOut = execSync(`netstat -ano | findstr :${port}`, {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    const lines = netstatOut.trim().split(/\r?\n/);
    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      const pidStr = parts[parts.length - 1];
      const pidNum = parseInt(pidStr, 10);
      if (pidNum && pidNum > 0 && pidNum !== process.pid) {
        forceKillPid(pidNum);
      }
    }
  } catch (_) {}
}

function killPythonGateway() {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log('[Lifecycle] Initiating shutdown: Cleanly terminating child and background processes...');

  if (pythonGatewayPid) {
    console.log(`[Lifecycle] Force killing Python Gateway PID: ${pythonGatewayPid}`);
    forceKillPid(pythonGatewayPid);
    pythonGatewayPid = null;
  }

  if (pythonProcess && pythonProcess.pid) {
    forceKillPid(pythonProcess.pid);
    pythonProcess = null;
  }

  killProcessOnPort(8000);

  if (isDev) {
    killProcessOnPort(3000);
    killProcessOnPort(5173);
  }

  console.log('[Lifecycle] Clean process lifecycle complete. Zero background footprint.');
}

function ensurePythonGateway() {
  try {
    const netstatCheck = execSync('netstat -ano | findstr :8000', {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    if (netstatCheck && netstatCheck.includes('LISTENING')) {
      const lines = netstatCheck.trim().split(/\r?\n/);
      for (const line of lines) {
        if (line.includes('LISTENING')) {
          const parts = line.trim().split(/\s+/);
          pythonGatewayPid = parseInt(parts[parts.length - 1], 10);
          console.log(`[Lifecycle] Discovered active Python Gateway PID: ${pythonGatewayPid}`);
          break;
        }
      }
      return;
    }
  } catch (_) {}

  try {
    console.log('[Lifecycle] Spawning Python FastAPI Gateway child process...');
    const projectRoot = path.join(__dirname, '..');
    pythonProcess = spawn('python', ['-m', 'uvicorn', 'backend.kepware_gateway:app', '--host', '127.0.0.1', '--port', '8000'], {
      cwd: projectRoot,
      stdio: 'ignore',
      shell: true,
    });
    if (pythonProcess && pythonProcess.pid) {
      pythonGatewayPid = pythonProcess.pid;
      console.log(`[Lifecycle] Stored Python Gateway child PID: ${pythonGatewayPid}`);
    }
  } catch (err: any) {
    console.warn('[Lifecycle] Note: Python gateway auto-spawn skipped:', err.message);
  }
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

  if (isDev) {
    const devUrl = 'http://localhost:3000';
    mainWindow.webContents.openDevTools();

    const loadDevServer = () => {
      mainWindow.loadURL(devUrl).catch((err) => {
        console.log('Vite server not ready yet, retrying in 1s...', err.message);
        setTimeout(loadDevServer, 1000);
      });
    };

    loadDevServer();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(() => {
  ensurePythonGateway();
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('before-quit', () => {
  killPythonGateway();
});

app.on('will-quit', () => {
  killPythonGateway();
});

app.on('window-all-closed', function () {
  killPythonGateway();
  if (process.platform !== 'darwin') app.quit();
});

process.on('exit', () => {
  killPythonGateway();
});

process.on('SIGINT', () => {
  killPythonGateway();
  process.exit(0);
});

process.on('SIGTERM', () => {
  killPythonGateway();
  process.exit(0);
});
