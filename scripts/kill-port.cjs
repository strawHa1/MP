/**
 * Cross-platform helper: kill process listening on a port (Windows + Unix).
 * Usage: node scripts/kill-port.cjs 3002
 */
const port = parseInt(process.argv[2] || '3002', 10);
const { execSync } = require('child_process');

if (process.platform === 'win32') {
  try {
    const out = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf8' });
    const pids = new Set(
      out
        .split('\n')
        .map((l) => l.trim().split(/\s+/).pop())
        .filter((p) => p && /^\d+$/.test(p))
    );
    for (const pid of pids) {
      try {
        execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore' });
        console.log(`Freed port ${port} (PID ${pid})`);
      } catch {
        /* ignore */
      }
    }
  } catch {
    console.log(`Port ${port} is free`);
  }
} else {
  try {
    execSync(`lsof -ti:${port} | xargs kill -9`, { stdio: 'inherit', shell: true });
  } catch {
    console.log(`Port ${port} is free`);
  }
}
