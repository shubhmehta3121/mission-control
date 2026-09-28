/** Runtime configuration from the environment (.env is loaded when present). */
try {
  process.loadEnvFile();
} catch {
  // No .env file — rely on the real environment.
}

export const config = {
  port: Number(process.env.PORT ?? 3000),
  host: process.env.HOST ?? '127.0.0.1',
  logLevel: process.env.LOG_LEVEL ?? 'warn', // set LOG_LEVEL=info to see every request
};
