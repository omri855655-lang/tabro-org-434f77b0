import { fork } from 'node:child_process';
import { safeAmexFailure } from './amex-adapter.mjs';

export function scrapeAmexIsolated(credentials, options, {
  forkProcess = fork, timeoutMs = 420_000,
} = {}) {
  return new Promise(resolve => {
    // The upstream scraper changes Moment's global timezone. A child also keeps
    // its mutable library state and crash lifecycle out of other bank requests.
    const child = forkProcess(new URL('./amex-child.mjs', import.meta.url), [], {
      execArgv: [], stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
      env: {
        PATH: process.env.PATH || '/usr/bin:/bin',
        ...(process.env.HOME ? { HOME: process.env.HOME } : {}),
        LANG: 'en_US.UTF-8', TZ: 'Asia/Jerusalem', NODE_ENV: 'production',
      },
    });
    let settled = false;
    let forceKill;
    const finish = result => {
      if (settled) return;
      settled = true;
      clearTimeout(deadline);
      resolve(result);
    };
    const stop = () => {
      child.kill('SIGTERM');
      forceKill = setTimeout(() => child.kill('SIGKILL'), 2_000);
      forceKill.unref();
    };
    const deadline = setTimeout(() => {
      finish(safeAmexFailure({ errorType: 'TIMEOUT' }));
      stop();
    }, timeoutMs);
    child.once('message', result => {
      if (result?.success === true && Array.isArray(result.accounts) && result.accounts.length) {
        finish(result);
      } else finish(safeAmexFailure(result));
    });
    child.once('error', () => {
      finish(safeAmexFailure());
      stop();
    });
    child.once('exit', () => {
      clearTimeout(forceKill);
      finish(safeAmexFailure());
    });
    child.send({ credentials, options }, error => {
      if (error) { finish(safeAmexFailure()); stop(); }
    });
  });
}
