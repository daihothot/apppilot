export interface McpTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  call(input: Record<string, unknown>): Promise<unknown>;
}

export function requireString(input: Record<string, unknown>, key: string): string {
  const value = input[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(key + " is required.");
  }
  return value;
}

export function requireNumber(input: Record<string, unknown>, key: string): number {
  const value = input[key];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(key + " must be a finite number.");
  }
  return value;
}
