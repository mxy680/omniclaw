export interface PluginConfig {
  client_secret_path: string;
  oauth_port?: number;
  tokens_path?: string;
  schedules_path?: string;
  /** @deprecated Use github_tokens_path for multi-account. Kept for migration. */
  github_token?: string;
  /** @deprecated Use gemini_tokens_path for multi-account. Kept for migration. */
  gemini_api_key?: string;
  /** @deprecated Use wolfram_tokens_path for multi-account. Kept for migration. */
  wolfram_appid?: string;
  github_tokens_path?: string;
  gemini_tokens_path?: string;
  wolfram_tokens_path?: string;
  /** @deprecated Use framer_tokens_path for multi-account. Kept for migration. */
  framer_api_key?: string;
  framer_tokens_path?: string;
}
