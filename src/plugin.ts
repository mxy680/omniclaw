import * as os from "os";
import * as path from "path";
import { OAuthClientManager } from "./auth/oauth-client-manager";
import { TokenStore } from "./auth/token-store";
import { CanvasClientManager } from "./auth/canvas-client-manager";
import { createGmailInboxTool, createGmailSearchTool } from "./tools/gmail-inbox";
import { createGmailAuthTool, createCalendarAuthTool, createDriveAuthTool, createDocsAuthTool, createSlidesAuthTool, createSheetsAuthTool } from "./tools/gmail-auth-tool";
import { createGmailGetTool } from "./tools/gmail-get";
import { createGmailSendTool, createGmailReplyTool, createGmailForwardTool } from "./tools/gmail-send";
import { createGmailModifyTool } from "./tools/gmail-modify";
import { createGmailAccountsTool } from "./tools/gmail-accounts";
import { createCalendarListCalendarsTool } from "./tools/calendar-list-calendars";
import { createCalendarEventsTool } from "./tools/calendar-events";
import { createCalendarGetTool } from "./tools/calendar-get";
import { createCalendarCreateTool } from "./tools/calendar-create";
import { createCalendarUpdateTool } from "./tools/calendar-update";
import { createCalendarDeleteTool } from "./tools/calendar-delete";
import { createCalendarRespondTool } from "./tools/calendar-respond";
import { createDriveListTool } from "./tools/drive-list";
import { createDriveSearchTool } from "./tools/drive-search";
import { createDriveGetTool } from "./tools/drive-get";
import { createDriveReadTool } from "./tools/drive-read";
import { createDriveUploadTool } from "./tools/drive-upload";
import { createDriveCreateFolderTool } from "./tools/drive-create-folder";
import { createDriveMoveTool } from "./tools/drive-move";
import { createDriveDeleteTool } from "./tools/drive-delete";
import { createDriveShareTool } from "./tools/drive-share";
import { createDocsCreateTool } from "./tools/docs-create";
import { createDocsGetTool } from "./tools/docs-get";
import { createDocsAppendTool } from "./tools/docs-append";
import { createDocsReplaceTextTool } from "./tools/docs-replace-text";
import { createSlidesCreateTool } from "./tools/slides-create";
import { createSlidesGetTool } from "./tools/slides-get";
import { createSlidesAppendSlideTool } from "./tools/slides-append-slide";
import { createSlidesReplaceTextTool } from "./tools/slides-replace-text";
import { createSheetsCreateTool } from "./tools/sheets-create";
import { createSheetsGetTool } from "./tools/sheets-get";
import { createSheetsUpdateTool } from "./tools/sheets-update";
import { createSheetsAppendTool } from "./tools/sheets-append";
import { createSheetsClearTool } from "./tools/sheets-clear";
import { GitHubClientManager } from "./auth/github-client-manager";
import { createGitHubAuthTool } from "./tools/github-auth-tool";
import { createGitHubIssuesTool, createGitHubGetIssueTool, createGitHubCreateIssueTool, createGitHubUpdateIssueTool, createGitHubAddIssueCommentTool } from "./tools/github-issues";
import { createGitHubPullsTool, createGitHubGetPullTool, createGitHubCreatePullTool, createGitHubMergePullTool, createGitHubAddPullReviewTool } from "./tools/github-pulls";
import { createGitHubReposTool, createGitHubGetRepoTool, createGitHubSearchCodeTool, createGitHubGetFileTool, createGitHubBranchesTool } from "./tools/github-repos";
import { createGitHubNotificationsTool, createGitHubMarkNotificationReadTool } from "./tools/github-notifications";
import { createCanvasAuthTool } from "./tools/canvas-auth-tool";
import { createCanvasProfileTool } from "./tools/canvas-profile";
import { createCanvasCoursesTool, createCanvasGetCourseTool } from "./tools/canvas-courses";
import { createCanvasAssignmentsTool, createCanvasGetAssignmentTool } from "./tools/canvas-assignments";
import { createCanvasAnnouncementsTool } from "./tools/canvas-announcements";
import { createCanvasGradesTool } from "./tools/canvas-grades";
import { createCanvasSubmissionsTool } from "./tools/canvas-submissions";
import { createCanvasTodoTool } from "./tools/canvas-todo";
import type { PluginConfig } from "./types/plugin-config";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type OpenClawPluginApi = any;

export function register(api: OpenClawPluginApi): void {
  const config = (api.pluginConfig ?? {}) as PluginConfig;

  // Derive Canvas tokens path alongside Google tokens
  const defaultTokensDir = path.join(os.homedir(), ".openclaw");
  const canvasTokensPath =
    config.canvas_tokens_path ??
    path.join(
      config.tokens_path ? path.dirname(config.tokens_path) : defaultTokensDir,
      "omniclaw-canvas-tokens.json"
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
  const githubTokensPath =
    config.tokens_path
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

  if (!config.client_secret_path) {
    api.logger.warn(
      "[omniclaw] client_secret_path is not configured. Gmail tools will not be available. " +
        "Set it via: openclaw plugins config omniclaw"
    );
    return;
  }

  const tokensPath =
    config.tokens_path ??
    path.join(os.homedir(), ".openclaw", "omniclaw-tokens.json");

  const tokenStore = new TokenStore(tokensPath);
  const clientManager = new OAuthClientManager(
    config.client_secret_path,
    config.oauth_port ?? 9753,
    tokenStore
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
}
