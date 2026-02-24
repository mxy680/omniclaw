export interface PluginConfig {
  client_secret_path: string;
  oauth_port?: number;
  tokens_path?: string;
  canvas_tokens_path?: string;
  canvas_base_url?: string;
  canvas_username?: string;
  canvas_password?: string;
  canvas_auto_mfa?: boolean;
  duo_totp_secret?: string;
  github_token?: string;
  gemini_api_key?: string;
  linkedin_tokens_path?: string;
  linkedin_username?: string;
  linkedin_password?: string;
  instagram_tokens_path?: string;
  instagram_username?: string;
  instagram_password?: string;
}
