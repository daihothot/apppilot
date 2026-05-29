import type { BuildArtifact } from "../build/types.ts";
import type { DeviceDriver } from "../../devices/device-driver.ts";
import type { CommandResult } from "../process/types.ts";
import type { LaunchOptions, Platform } from "../../devices/types.ts";

export type AppPilotEventName = keyof AppPilotEventMap;

export interface AppPilotEventMap {
  "app.devices.before": AppDevicesEvent;
  "app.devices.after": AppDevicesEvent;
  "app.devices.failed": AppDevicesEvent;
  "app.run.before": AppRunEvent;
  "app.install.before": AppRunEvent;
  "app.install.after": AppRunEvent;
  "app.install.failed": AppRunEvent;
  "app.launch.before": AppRunEvent;
  "app.launch.after": AppRunEvent;
  "app.launch.failed": AppRunEvent;
  "app.run.after": AppRunEvent;
  "app.run.failed": AppRunEvent;
  "app.stop.before": AppStopEvent;
  "app.stop.after": AppStopEvent;
  "app.stop.failed": AppStopEvent;

  "action.tap.before": ActionTapEvent;
  "action.tap.after": ActionTapEvent;
  "action.tap.failed": ActionTapEvent;
  "action.swipe.before": ActionSwipeEvent;
  "action.swipe.after": ActionSwipeEvent;
  "action.swipe.failed": ActionSwipeEvent;

  "logs.dump.before": LogsDumpEvent;
  "logs.dump.after": LogsDumpEvent;
  "logs.dump.failed": LogsDumpEvent;
  "logs.match.after": LogsMatchEvent;

  "build.before": BuildEvent;
  "build.phase.changed": BuildEvent;
  "build.after": BuildEvent;
  "build.failed": BuildEvent;

  "task.started": TaskEvent;
  "task.phase.changed": TaskEvent;
  "task.completed": TaskEvent;
  "task.failed": TaskEvent;

  "device.list.before": DeviceEvent;
  "device.list.after": DeviceEvent;
  "device.list.failed": DeviceEvent;
  "device.install.before": DeviceEvent;
  "device.install.after": DeviceEvent;
  "device.install.failed": DeviceEvent;
  "device.launch.before": DeviceEvent;
  "device.launch.after": DeviceEvent;
  "device.launch.failed": DeviceEvent;
  "device.stop.before": DeviceEvent;
  "device.stop.after": DeviceEvent;
  "device.stop.failed": DeviceEvent;

  "transport.ws.server.started": TransportWsEvent;
  "transport.ws.client.connected": TransportWsEvent;
  "transport.ws.client.disconnected": TransportWsEvent;

  "apppilot.ws.ready": AppPilotRuntimeEvent;
  "apppilot.query.before": AppPilotQueryEvent;
  "apppilot.query.after": AppPilotQueryEvent;
  "apppilot.query.failed": AppPilotQueryEvent;
}

export interface BaseEvent {
  platform?: Platform;
  device?: string;
  bundleId?: string;
  error?: unknown;
  metadata?: Record<string, unknown>;
}

export interface AppDevicesEvent extends BaseEvent {
  platform: Platform;
  result?: CommandResult;
}

export interface AppRunEvent extends BaseEvent {
  platform: Platform;
  device: string;
  appPath: string;
  bundleId: string;
  launchOptions: LaunchOptions;
  deviceDriver: DeviceDriver;
  installResult?: CommandResult;
  launchResult?: CommandResult;
  build?: BuildArtifact;
}

export interface AppStopEvent extends BaseEvent {
  platform: Platform;
  device: string;
  bundleId: string;
  result?: CommandResult;
}

export interface ActionTapEvent extends BaseEvent {
  platform: Platform;
  device: string;
  point: string;
  result?: CommandResult;
}

export interface ActionSwipeEvent extends BaseEvent {
  platform: Platform;
  device: string;
  from: string;
  to: string;
  result?: CommandResult;
}

export interface LogsDumpEvent extends BaseEvent {
  platform: Platform;
  device: string;
  offset: number;
  matchText?: string;
  target?: string;
}

export interface LogsMatchEvent extends BaseEvent {
  platform: Platform;
  device: string;
  matchText: string;
  target: string;
  count?: number;
}

export interface BuildEvent extends BaseEvent {
  platform?: Platform;
  adapter?: string;
  action?: string;
  phase?: string;
  projectPath?: string;
  xcodeProjectPath?: string;
  artifact?: BuildArtifact;
  logPath?: string;
}

export interface TaskEvent extends BaseEvent {
  task: string;
  phase?: string;
  state?: string;
  logPath?: string;
}

export interface DeviceEvent extends BaseEvent {
  platform: Platform;
  device?: string;
  appPath?: string;
  launchOptions?: LaunchOptions;
  result?: CommandResult;
}

export interface TransportWsEvent extends BaseEvent {
  host?: string;
  port?: number;
  address?: string;
  clientId?: string;
}

export interface AppPilotRuntimeEvent extends BaseEvent {
  address?: string;
  rootName?: string;
}

export interface AppPilotQueryEvent extends BaseEvent {
  method: string;
  params?: unknown;
  result?: unknown;
}
