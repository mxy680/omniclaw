import * as os from "os";
import * as path from "path";
// Resolved via openclaw/plugin-sdk when loaded as a monorepo extension
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type OpenClawPluginApi = any;
import { CanvasClientManager } from "./auth/canvas-client-manager.js";
import { GeminiClientManager } from "./auth/gemini-client-manager.js";
import { GitHubClientManager } from "./auth/github-client-manager.js";
import { OAuthClientManager } from "./auth/oauth-client-manager.js";
import { TokenStore } from "./auth/token-store.js";
import { createCalendarCreateTool } from "./tools/calendar-create.js";
import { createCalendarDeleteTool } from "./tools/calendar-delete.js";
import { createCalendarEventsTool } from "./tools/calendar-events.js";
import { createCalendarGetTool } from "./tools/calendar-get.js";
import { createCalendarListCalendarsTool } from "./tools/calendar-list-calendars.js";
import { createCalendarRespondTool } from "./tools/calendar-respond.js";
import { createCalendarUpdateTool } from "./tools/calendar-update.js";
import { createCanvasAnnouncementsTool } from "./tools/canvas-announcements.js";
import {
  createCanvasAssignmentsTool,
  createCanvasGetAssignmentTool,
} from "./tools/canvas-assignments.js";
import { createCanvasAuthTool } from "./tools/canvas-auth-tool.js";
import { createCanvasCoursesTool, createCanvasGetCourseTool } from "./tools/canvas-courses.js";
import { createCanvasGradesTool } from "./tools/canvas-grades.js";
import { createCanvasProfileTool } from "./tools/canvas-profile.js";
import { createCanvasSubmissionsTool } from "./tools/canvas-submissions.js";
import { createCanvasTodoTool } from "./tools/canvas-todo.js";
import { createDocsAppendTool } from "./tools/docs-append.js";
import { createDocsCreateTool } from "./tools/docs-create.js";
import { createDocsGetTool } from "./tools/docs-get.js";
import { createDocsReplaceTextTool } from "./tools/docs-replace-text.js";
import { createDriveCreateFolderTool } from "./tools/drive-create-folder.js";
import { createDriveDeleteTool } from "./tools/drive-delete.js";
import { createDriveGetTool } from "./tools/drive-get.js";
import { createDriveListTool } from "./tools/drive-list.js";
import { createDriveMoveTool } from "./tools/drive-move.js";
import { createDriveReadTool } from "./tools/drive-read.js";
import { createDriveSearchTool } from "./tools/drive-search.js";
import { createDriveShareTool } from "./tools/drive-share.js";
import { createDriveUploadTool } from "./tools/drive-upload.js";
import { createGeminiAuthTool } from "./tools/gemini-auth-tool.js";
import { createGeminiGenerateImageTool, createGeminiEditImageTool } from "./tools/gemini-image.js";
import { createGeminiGenerateVideoTool } from "./tools/gemini-video-gen.js";
import { createGeminiAnalyzeVideoTool } from "./tools/gemini-video-understand.js";
import { createGitHubAuthTool } from "./tools/github-auth-tool.js";
import {
  createGitHubIssuesTool,
  createGitHubGetIssueTool,
  createGitHubCreateIssueTool,
  createGitHubUpdateIssueTool,
  createGitHubAddIssueCommentTool,
} from "./tools/github-issues.js";
import {
  createGitHubNotificationsTool,
  createGitHubMarkNotificationReadTool,
} from "./tools/github-notifications.js";
import {
  createGitHubPullsTool,
  createGitHubGetPullTool,
  createGitHubCreatePullTool,
  createGitHubMergePullTool,
  createGitHubAddPullReviewTool,
} from "./tools/github-pulls.js";
import {
  createGitHubReposTool,
  createGitHubGetRepoTool,
  createGitHubSearchCodeTool,
  createGitHubGetFileTool,
  createGitHubBranchesTool,
} from "./tools/github-repos.js";
import { createGmailAccountsTool } from "./tools/gmail-accounts.js";
import {
  createGmailAuthTool,
  createCalendarAuthTool,
  createDriveAuthTool,
  createDocsAuthTool,
  createSlidesAuthTool,
  createSheetsAuthTool,
  createYouTubeAuthTool,
} from "./tools/gmail-auth-tool.js";
import { createGmailGetTool } from "./tools/gmail-get.js";
import { createGmailInboxTool, createGmailSearchTool } from "./tools/gmail-inbox.js";
import { createGmailModifyTool } from "./tools/gmail-modify.js";
import {
  createGmailSendTool,
  createGmailReplyTool,
  createGmailForwardTool,
} from "./tools/gmail-send.js";
import { createSheetsAppendTool } from "./tools/sheets-append.js";
import { createSheetsClearTool } from "./tools/sheets-clear.js";
import { createSheetsCreateTool } from "./tools/sheets-create.js";
import { createSheetsGetTool } from "./tools/sheets-get.js";
import { createSheetsUpdateTool } from "./tools/sheets-update.js";
import { createSlidesAppendSlideTool } from "./tools/slides-append-slide.js";
import { createSlidesCreateTool } from "./tools/slides-create.js";
import { createSlidesGetTool } from "./tools/slides-get.js";
import { createSlidesReplaceTextTool } from "./tools/slides-replace-text.js";
import { createYouTubeSearchTool, createYouTubeVideoDetailsTool } from "./tools/youtube-search.js";
import {
  createYouTubeChannelInfoTool,
  createYouTubeVideoCommentsTool,
} from "./tools/youtube-social.js";
import { createYouTubeTranscriptTool } from "./tools/youtube-transcript.js";
import type { PluginConfig } from "./types/plugin-config.js";

export function register(api: OpenClawPluginApi): void {
  const config = (api.pluginConfig ?? {}) as unknown as PluginConfig;

  // Derive Canvas tokens path alongside Google tokens
  const defaultTokensDir = path.join(os.homedir(), ".openclaw");
  const canvasTokensPath =
    config.canvas_tokens_path ??
    path.join(
      config.tokens_path ? path.dirname(config.tokens_path) : defaultTokensDir,
      "omniclaw-canvas-tokens.json",
    );

  const canvasManager = new CanvasClientManager(canvasTokensPath);

  // Canvas tools register unconditionally — no Google credentials required
  api.registerTool(createCanvasAuthTool(canvasManager, config), { optional: true });
  api.registerTool(createCanvasProfileTool(canvasManager), { optional: true });
  api.registerTool(createCanvasCoursesTool(canvasManager), { optional: true });
  api.registerTool(createCanvasGetCourseTool(canvasManager), { optional: true });
  api.registerTool(createCanvasAssignmentsTool(canvasManager), { optional: true });
  api.registerTool(createCanvasGetAssignmentTool(canvasManager), { optional: true });
  api.registerTool(createCanvasAnnouncementsTool(canvasManager), { optional: true });
  api.registerTool(createCanvasGradesTool(canvasManager), { optional: true });
  api.registerTool(createCanvasSubmissionsTool(canvasManager), { optional: true });
  api.registerTool(createCanvasTodoTool(canvasManager), { optional: true });

  // GitHub tools — register unconditionally, no Google credentials required
  const githubTokensPath = config.tokens_path
    ? path.join(path.dirname(config.tokens_path), "omniclaw-github-tokens.json")
    : path.join(defaultTokensDir, "omniclaw-github-tokens.json");

  const githubManager = new GitHubClientManager(githubTokensPath);

  api.registerTool(createGitHubAuthTool(githubManager, config), { optional: true });
  api.registerTool(createGitHubIssuesTool(githubManager), { optional: true });
  api.registerTool(createGitHubGetIssueTool(githubManager), { optional: true });
  api.registerTool(createGitHubCreateIssueTool(githubManager), { optional: true });
  api.registerTool(createGitHubUpdateIssueTool(githubManager), { optional: true });
  api.registerTool(createGitHubAddIssueCommentTool(githubManager), { optional: true });
  api.registerTool(createGitHubPullsTool(githubManager), { optional: true });
  api.registerTool(createGitHubGetPullTool(githubManager), { optional: true });
  api.registerTool(createGitHubCreatePullTool(githubManager), { optional: true });
  api.registerTool(createGitHubMergePullTool(githubManager), { optional: true });
  api.registerTool(createGitHubAddPullReviewTool(githubManager), { optional: true });
  api.registerTool(createGitHubReposTool(githubManager), { optional: true });
  api.registerTool(createGitHubGetRepoTool(githubManager), { optional: true });
  api.registerTool(createGitHubSearchCodeTool(githubManager), { optional: true });
  api.registerTool(createGitHubGetFileTool(githubManager), { optional: true });
  api.registerTool(createGitHubBranchesTool(githubManager), { optional: true });
  api.registerTool(createGitHubNotificationsTool(githubManager), { optional: true });
  api.registerTool(createGitHubMarkNotificationReadTool(githubManager), { optional: true });

  // Gemini tools — register unconditionally, no Google OAuth credentials required
  const geminiKeysPath = config.tokens_path
    ? path.join(path.dirname(config.tokens_path), "omniclaw-gemini-keys.json")
    : path.join(defaultTokensDir, "omniclaw-gemini-keys.json");

  const geminiManager = new GeminiClientManager(geminiKeysPath);

  api.registerTool(createGeminiAuthTool(geminiManager, config), { optional: true });
  api.registerTool(createGeminiGenerateImageTool(geminiManager), { optional: true });
  api.registerTool(createGeminiEditImageTool(geminiManager), { optional: true });
  api.registerTool(createGeminiGenerateVideoTool(geminiManager), { optional: true });
  api.registerTool(createGeminiAnalyzeVideoTool(geminiManager), { optional: true });

  // YouTube transcript — no OAuth required, works with any public video
  api.registerTool(createYouTubeTranscriptTool(), { optional: true });

  if (!config.client_secret_path) {
    api.logger.warn(
      "[omniclaw] client_secret_path is not configured. Gmail tools will not be available. " +
        "Set it via: openclaw plugins config omniclaw",
    );
    return;
  }

  const tokensPath =
    config.tokens_path ?? path.join(os.homedir(), ".openclaw", "omniclaw-tokens.json");

  const tokenStore = new TokenStore(tokensPath);
  const clientManager = new OAuthClientManager(
    config.client_secret_path,
    config.oauth_port ?? 9753,
    tokenStore,
  );

  api.registerTool(createGmailInboxTool(clientManager), { optional: true });
  api.registerTool(createGmailSearchTool(clientManager), { optional: true });
  api.registerTool(createGmailAuthTool(clientManager, config), { optional: true });
  api.registerTool(createGmailGetTool(clientManager), { optional: true });
  api.registerTool(createGmailSendTool(clientManager), { optional: true });
  api.registerTool(createGmailReplyTool(clientManager), { optional: true });
  api.registerTool(createGmailForwardTool(clientManager), { optional: true });
  api.registerTool(createGmailModifyTool(clientManager), { optional: true });
  api.registerTool(createGmailAccountsTool(clientManager), { optional: true });

  api.registerTool(createCalendarAuthTool(clientManager, config), { optional: true });
  api.registerTool(createCalendarListCalendarsTool(clientManager), { optional: true });
  api.registerTool(createCalendarEventsTool(clientManager), { optional: true });
  api.registerTool(createCalendarGetTool(clientManager), { optional: true });
  api.registerTool(createCalendarCreateTool(clientManager), { optional: true });
  api.registerTool(createCalendarUpdateTool(clientManager), { optional: true });
  api.registerTool(createCalendarDeleteTool(clientManager), { optional: true });
  api.registerTool(createCalendarRespondTool(clientManager), { optional: true });

  api.registerTool(createDriveAuthTool(clientManager, config), { optional: true });
  api.registerTool(createDriveListTool(clientManager), { optional: true });
  api.registerTool(createDriveSearchTool(clientManager), { optional: true });
  api.registerTool(createDriveGetTool(clientManager), { optional: true });
  api.registerTool(createDriveReadTool(clientManager), { optional: true });
  api.registerTool(createDriveUploadTool(clientManager), { optional: true });
  api.registerTool(createDriveCreateFolderTool(clientManager), { optional: true });
  api.registerTool(createDriveMoveTool(clientManager), { optional: true });
  api.registerTool(createDriveDeleteTool(clientManager), { optional: true });
  api.registerTool(createDriveShareTool(clientManager), { optional: true });

  api.registerTool(createDocsAuthTool(clientManager, config), { optional: true });
  api.registerTool(createDocsCreateTool(clientManager), { optional: true });
  api.registerTool(createDocsGetTool(clientManager), { optional: true });
  api.registerTool(createDocsAppendTool(clientManager), { optional: true });
  api.registerTool(createDocsReplaceTextTool(clientManager), { optional: true });

  api.registerTool(createSlidesAuthTool(clientManager, config), { optional: true });
  api.registerTool(createSlidesCreateTool(clientManager), { optional: true });
  api.registerTool(createSlidesGetTool(clientManager), { optional: true });
  api.registerTool(createSlidesAppendSlideTool(clientManager), { optional: true });
  api.registerTool(createSlidesReplaceTextTool(clientManager), { optional: true });

  api.registerTool(createSheetsAuthTool(clientManager, config), { optional: true });
  api.registerTool(createSheetsCreateTool(clientManager), { optional: true });
  api.registerTool(createSheetsGetTool(clientManager), { optional: true });
  api.registerTool(createSheetsUpdateTool(clientManager), { optional: true });
  api.registerTool(createSheetsAppendTool(clientManager), { optional: true });
  api.registerTool(createSheetsClearTool(clientManager), { optional: true });

  api.registerTool(createYouTubeAuthTool(clientManager, config), { optional: true });
  api.registerTool(createYouTubeSearchTool(clientManager), { optional: true });
  api.registerTool(createYouTubeVideoDetailsTool(clientManager), { optional: true });
  api.registerTool(createYouTubeChannelInfoTool(clientManager), { optional: true });
  api.registerTool(createYouTubeVideoCommentsTool(clientManager), { optional: true });
}
