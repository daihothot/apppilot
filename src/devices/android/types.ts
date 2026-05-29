import type { LaunchOptions } from "../types.ts";

export interface AndroidIntentExtra {
  type: "string" | "int" | "long" | "float" | "boolean" | "string-array" | "int-array";
  key: string;
  value: string | number | boolean | string[] | number[];
}

export interface AndroidLaunchIntent {
  component?: string;
  action?: string;
  data?: string;
  mimeType?: string;
  categories?: string[];
  flags?: string[];
  extras?: AndroidIntentExtra[];
}

export interface AndroidLaunchOptions extends LaunchOptions {
  androidIntent?: AndroidLaunchIntent;
}
