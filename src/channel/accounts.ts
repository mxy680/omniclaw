import { DEFAULT_ACCOUNT_ID } from "openclaw/plugin-sdk";
import type { CoreConfig, ResolvedIosAccount } from "./types.js";

const CHANNEL_KEY = "omniclaw-ios";
const DEFAULT_PORT = 9800;

/**
 * Resolve the iOS WebSocket account from the OpenClaw config.
 * Single-account (personal use): always "default".
 */
export function resolveIosAccount(cfg: CoreConfig): ResolvedIosAccount {
  const section = cfg.channels?.[CHANNEL_KEY];
  const port = section?.port ?? (Number(process.env.OMNICLAW_IOS_PORT) || DEFAULT_PORT);
  const authToken =
    section?.authToken ?? process.env.OMNICLAW_IOS_AUTH_TOKEN ?? "";

  return {
    accountId: DEFAULT_ACCOUNT_ID,
    enabled: section?.enabled !== false,
    configured: authToken.length > 0,
    port,
    authToken,
  };
}

/** List account IDs — always just the one default account. */
export function listIosAccountIds(): string[] {
  return [DEFAULT_ACCOUNT_ID];
}
