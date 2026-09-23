export function hasFlag(args: string[], flag: string): boolean {
  return args.includes(flag);
}

export function readOption(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  if (index === -1) return undefined;
  const value = args[index + 1];
  return value && !value.startsWith("--") ? value : undefined;
}

export function readOptions(args: string[], name: string): string[] {
  const values: string[] = [];
  for (let index = 0; index < args.length; index++) {
    if (args[index] !== name) continue;
    const value = args[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`Missing value for ${name}.`);
    }
    values.push(value);
  }
  return values;
}

export function readNumberOption(args: string[], name: string): number | undefined {
  const value = readOption(args, name);
  return value === undefined ? undefined : Number(value);
}

export function requirePositional(value: string | undefined, name: string): string {
  if (!value || value.startsWith("-")) {
    throw new Error(`Missing required ${name}.`);
  }
  return value;
}
