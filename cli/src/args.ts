export type FlagValue = string | boolean | string[];

export interface ParsedArgs {
  _: string[];
  flags: Record<string, FlagValue>;
}

const BOOLEAN_FLAGS = new Set(['json', 'wait', 'no-browser', 'dry-run', 'show-key', 'help', 'version', 'yes', 'quiet']);
const SHORT: Record<string, string> = { h: 'help', v: 'version', o: 'out', p: 'prompt', w: 'wait', y: 'yes' };

export function parseArgs(argv: string[]): ParsedArgs {
  const positional: string[] = [];
  const flags: Record<string, FlagValue> = {};
  const set = (key: string, value: string | boolean) => {
    const prev = flags[key];
    if (prev === undefined || typeof value === 'boolean' || typeof prev === 'boolean') {
      flags[key] = value;
      return;
    }
    flags[key] = [...(Array.isArray(prev) ? prev : [prev]), value];
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--') {
      positional.push(...argv.slice(i + 1));
      break;
    }
    let name = '';
    if (arg.startsWith('--') && arg.length > 2) name = arg.slice(2);
    else if (/^-[a-zA-Z]$/.test(arg)) name = SHORT[arg[1]] || arg[1];
    if (!name) {
      positional.push(arg);
      continue;
    }
    const eq = name.indexOf('=');
    if (eq > 0) {
      set(name.slice(0, eq), name.slice(eq + 1));
      continue;
    }
    if (BOOLEAN_FLAGS.has(name)) {
      set(name, true);
      continue;
    }
    const next = argv[i + 1];
    if (next !== undefined && !next.startsWith('--')) {
      set(name, next);
      i++;
    } else {
      set(name, true);
    }
  }
  return { _: positional, flags };
}

export function coerce(value: string): unknown {
  const v = value.trim();
  if (v === 'true') return true;
  if (v === 'false') return false;
  if (/^-?\d+(\.\d+)?$/.test(v) && v.length < 16) return Number(v);
  if ((v.startsWith('{') && v.endsWith('}')) || (v.startsWith('[') && v.endsWith(']'))) {
    try {
      return JSON.parse(v);
    } catch {
      return value;
    }
  }
  return value;
}

export function flagString(flags: Record<string, FlagValue>, key: string): string | undefined {
  const v = flags[key];
  if (v === undefined || typeof v === 'boolean') return undefined;
  return Array.isArray(v) ? v[v.length - 1] : v;
}

export function flagList(flags: Record<string, FlagValue>, key: string): string[] {
  const v = flags[key];
  if (v === undefined || typeof v === 'boolean') return [];
  return Array.isArray(v) ? v : [v];
}
