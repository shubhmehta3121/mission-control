#!/usr/bin/env node
// Launches the TypeScript CLI directly (no build step). `npm link` puts `mc` on your PATH.
import { register } from 'tsx/esm/api';

register();
await import('../src/cli/index.ts');
