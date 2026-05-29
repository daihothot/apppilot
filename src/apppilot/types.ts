export interface AppPilotLaunchOptions {
  enabled?: boolean;
  rootName?: string;
  port?: number;
  waitMs?: number;
}

export interface AppPilotWsStatus {
  running: boolean;
  host: string;
  port: number;
  advertiseHost: string;
  clientConnected: boolean;
  appServerAddress?: string;
  appServerConnected: boolean;
}
