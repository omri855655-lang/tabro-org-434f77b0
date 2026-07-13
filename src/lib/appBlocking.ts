import { Capacitor, registerPlugin } from "@capacitor/core";

export type BlockingPlatform = "web" | "ios" | "android";
export type BlockingAuthorization = "granted" | "denied" | "needs-install" | "unavailable";

export interface BlockingPolicy {
  appIds: string[];
  websiteHosts: string[];
  endsAt?: string;
  dailyLimitMinutes?: number;
}

interface NativeAppBlockerPlugin {
  getAuthorizationStatus(): Promise<{ status: BlockingAuthorization }>;
  requestAuthorization(): Promise<{ status: BlockingAuthorization }>;
  applyPolicy(options: BlockingPolicy): Promise<void>;
  stopPolicy(): Promise<void>;
  allowTemporarily(options: { appId?: string; websiteHost?: string; minutes: number }): Promise<void>;
}

const NativeAppBlocker = registerPlugin<NativeAppBlockerPlugin>("TabroAppBlocker");

export const getBlockingPlatform = (): BlockingPlatform => {
  const platform = Capacitor.getPlatform();
  return platform === "ios" || platform === "android" ? platform : "web";
};

export const getBlockingAuthorization = async (): Promise<BlockingAuthorization> => {
  if (!Capacitor.isNativePlatform()) return "needs-install";
  try {
    return (await NativeAppBlocker.getAuthorizationStatus()).status;
  } catch {
    return "needs-install";
  }
};

export const requestBlockingAuthorization = async (): Promise<BlockingAuthorization> => {
  if (!Capacitor.isNativePlatform()) return "needs-install";
  try {
    return (await NativeAppBlocker.requestAuthorization()).status;
  } catch {
    return "needs-install";
  }
};

export const applyBlockingPolicy = async (policy: BlockingPolicy) => {
  if (!Capacitor.isNativePlatform()) throw new Error("native-blocker-required");
  await NativeAppBlocker.applyPolicy(policy);
};

export const stopBlockingPolicy = async () => {
  if (!Capacitor.isNativePlatform()) throw new Error("native-blocker-required");
  await NativeAppBlocker.stopPolicy();
};

export const temporarilyAllowBlockedItem = async (item: { appId?: string; websiteHost?: string; minutes: number }) => {
  if (!Capacitor.isNativePlatform()) throw new Error("native-blocker-required");
  await NativeAppBlocker.allowTemporarily(item);
};
