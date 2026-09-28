import { connect, createServer } from 'node:net';

/**
 * Is anything accepting connections on this address? A bind test alone is not
 * enough: on Windows another app listening on 0.0.0.0:3000 / [::]:3000 does not
 * stop us binding 127.0.0.1:3000, and then "localhost:3000" (which resolves to
 * ::1) reaches the other app while 127.0.0.1:3000 reaches us. So we also knock.
 */
function somethingAnswers(port: number, host: string, timeoutMs = 400): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = connect({ port, host });
    const done = (answered: boolean) => {
      socket.destroy();
      resolve(answered);
    };
    socket.setTimeout(timeoutMs, () => done(false));
    socket.once('connect', () => done(true));
    socket.once('error', () => done(false));
  });
}

function canBind(port: number, host: string): Promise<boolean> {
  return new Promise((resolve) => {
    const probe = createServer();
    probe.once('error', () => resolve(false)); // EADDRINUSE, or EACCES for ports Windows reserves
    probe.once('listening', () => probe.close(() => resolve(true)));
    probe.listen(port, host);
  });
}

/** Free means: nobody answers on IPv4 or IPv6 loopback, and we can bind it ourselves. */
export async function portIsFree(port: number, host: string): Promise<boolean> {
  const [ipv4, ipv6] = await Promise.all([somethingAnswers(port, '127.0.0.1'), somethingAnswers(port, '::1')]);
  if (ipv4 || ipv6) return false;
  return canBind(port, host);
}

/** The first free port from `start` upwards. 3000 is often taken by another dev server. */
export async function findFreePort(start: number, host: string, attempts = 20): Promise<number> {
  for (let port = start; port < start + attempts; port += 1) {
    if (await portIsFree(port, host)) return port;
  }
  throw new Error(`No free port between ${start} and ${start + attempts - 1}. Set PORT in .env to another range.`);
}
