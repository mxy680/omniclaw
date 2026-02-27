import * as os from "os";
import * as path from "path";
// Resolved via openclaw/plugin-sdk when loaded as a monorepo extension
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type OpenClawPluginApi = any;
import type { ChannelPlugin } from "openclaw/plugin-sdk";
import { iosChannelPlugin, getDispatchManager } from "./channel/channel-plugin.js";
import { setChannelRuntime } from "./channel/runtime.js";
import { CanvasClientManager } from "./auth/canvas-client-manager.js";
import { GeminiClientManager } from "./auth/gemini-client-manager.js";
import { GitHubClientManager } from "./auth/github-client-manager.js";
import { LinkedInClientManager } from "./auth/linkedin-client-manager.js";
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
import { createCanvasDownloadFileTool } from "./tools/canvas-download.js";
import { createCanvasSubmissionsTool } from "./tools/canvas-submissions.js";
import { createCanvasTodoTool } from "./tools/canvas-todo.js";
import { createDocsAppendTool } from "./tools/docs-append.js";
import { createDocsCreateTool } from "./tools/docs-create.js";
import { createDocsExportTool } from "./tools/docs-download.js";
import { createDocsGetTool } from "./tools/docs-get.js";
import { createDocsReplaceTextTool } from "./tools/docs-replace-text.js";
import { createDriveCreateFolderTool } from "./tools/drive-create-folder.js";
import { createDriveDeleteTool } from "./tools/drive-delete.js";
import { createDriveDownloadTool } from "./tools/drive-download.js";
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
import { InstagramClientManager } from "./auth/instagram-client-manager.js";
import { createInstagramAuthTool } from "./tools/instagram-auth-tool.js";
import { createInstagramFeedTool } from "./tools/instagram-feed.js";
import { createInstagramConversationsTool, createInstagramMessagesTool } from "./tools/instagram-messages.js";
import { createInstagramNotificationsTool } from "./tools/instagram-notifications.js";
import { createInstagramUserPostsTool, createInstagramPostDetailsTool } from "./tools/instagram-posts.js";
import { createInstagramProfileTool, createInstagramGetProfileTool } from "./tools/instagram-profile.js";
import { createInstagramReelsTool } from "./tools/instagram-reels.js";
import { createInstagramSavedTool } from "./tools/instagram-saved.js";
import { createInstagramSearchTool } from "./tools/instagram-search.js";
import { createInstagramFollowersTool, createInstagramFollowingTool } from "./tools/instagram-social.js";
import { createInstagramStoriesTool } from "./tools/instagram-stories.js";
import { createInstagramPostCommentsTool } from "./tools/instagram-comments.js";
import { createInstagramDownloadMediaTool } from "./tools/instagram-download-media.js";
import { createLinkedInAuthTool } from "./tools/linkedin-auth-tool.js";
import { createLinkedInCompanyTool } from "./tools/linkedin-company.js";
import { createLinkedInConnectionsTool } from "./tools/linkedin-connections.js";
import { createLinkedInDownloadMediaTool } from "./tools/linkedin-download-media.js";
import { createLinkedInFeedTool } from "./tools/linkedin-feed.js";
import { createLinkedInPendingInvitationsTool } from "./tools/linkedin-invitations.js";
import { createLinkedInJobDetailsTool } from "./tools/linkedin-job-details.js";
import { createLinkedInConversationsTool, createLinkedInMessagesTool } from "./tools/linkedin-messages.js";
import { createLinkedInNotificationsTool } from "./tools/linkedin-notifications.js";
import { createLinkedInPostCommentsTool } from "./tools/linkedin-post-comments.js";
import { createLinkedInProfileTool as createLinkedInMyProfileTool, createLinkedInGetProfileTool } from "./tools/linkedin-profile.js";
import { createLinkedInProfileViewsTool } from "./tools/linkedin-profile-views.js";
import { createLinkedInSavedJobsTool } from "./tools/linkedin-saved-jobs.js";
import { createLinkedInSearchTool, createLinkedInSearchJobsTool } from "./tools/linkedin-search.js";
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
import { createGmailGetTool, createGmailDownloadAttachmentTool } from "./tools/gmail-get.js";
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
import { createSheetsExportTool } from "./tools/sheets-download.js";
import { createSheetsGetTool } from "./tools/sheets-get.js";
import { createSheetsUpdateTool } from "./tools/sheets-update.js";
import { createSlidesAppendSlideTool } from "./tools/slides-append-slide.js";
import { createSlidesCreateTool } from "./tools/slides-create.js";
import { createSlidesExportTool } from "./tools/slides-download.js";
import { createSlidesGetTool } from "./tools/slides-get.js";
import { createSlidesReplaceTextTool } from "./tools/slides-replace-text.js";
import { createYouTubeSearchTool, createYouTubeVideoDetailsTool } from "./tools/youtube-search.js";
import {
  createYouTubeChannelInfoTool,
  createYouTubeVideoCommentsTool,
} from "./tools/youtube-social.js";
import { createYouTubeDownloadThumbnailTool } from "./tools/youtube-download-thumbnail.js";
import { createYouTubeTranscriptTool } from "./tools/youtube-transcript.js";
import { Factor75ClientManager } from "./auth/factor75-client-manager.js";
import { SlackClientManager } from "./auth/slack-client-manager.js";
import { createFactor75AuthTool } from "./tools/factor75-auth-tool.js";
import { createSlackAuthTool } from "./tools/slack-auth-tool.js";
import { createSlackListChannelsTool, createSlackGetChannelInfoTool } from "./tools/slack-channels.js";
import { createSlackListMessagesTool, createSlackGetThreadTool } from "./tools/slack-messages.js";
import { createSlackSearchMessagesTool } from "./tools/slack-search.js";
import { createSlackListUsersTool, createSlackGetUserInfoTool } from "./tools/slack-users.js";
import { createFactor75MenuTool } from "./tools/factor75-menu.js";
import { createFactor75MealDetailsTool } from "./tools/factor75-meal-details.js";
import {
  createFactor75GetSelectionsTool,
  createFactor75SelectMealTool,
  createFactor75RemoveMealTool,
} from "./tools/factor75-selections.js";
import {
  createFactor75SubscriptionTool,
  createFactor75SkipWeekTool,
  createFactor75PauseTool,
  createFactor75ResumeTool,
} from "./tools/factor75-subscription.js";
import { createFactor75DeliveriesTool, createFactor75DeliveryDetailsTool } from "./tools/factor75-deliveries.js";
import { createFactor75AccountTool } from "./tools/factor75-account.js";
import { BlueBubblesClientManager } from "./auth/bluebubbles-client-manager.js";
import { createImessageBBAuthTool } from "./tools/imessage-auth-tool.js";
import { BlueBubblesMessageBackend } from "./tools/imessage-backend-bluebubbles.js";
import { createImessageContactsTool } from "./tools/imessage-contacts.js";
import { createImessageChatsTool } from "./tools/imessage-chats.js";
import { createImessageMessagesTool, createImessageSearchTool } from "./tools/imessage-messages.js";
import { createImessageSendTool } from "./tools/imessage-send.js";
import { createImessageAttachmentsTool } from "./tools/imessage-attachments.js";
import { VercelClientManager } from "./auth/vercel-client-manager.js";
import { createVercelAuthTool } from "./tools/vercel-auth.js";
import {
  createVercelProjectsTool,
  createVercelGetProjectTool,
  createVercelCreateProjectTool,
  createVercelDeleteProjectTool,
} from "./tools/vercel-projects.js";
import {
  createVercelDeploymentsTool,
  createVercelGetDeploymentTool,
  createVercelCreateDeploymentTool,
  createVercelCancelDeploymentTool,
  createVercelDeploymentEventsTool,
} from "./tools/vercel-deployments.js";
import {
  createVercelDomainsTool,
  createVercelAddDomainTool,
  createVercelRemoveDomainTool,
} from "./tools/vercel-domains.js";
import {
  createVercelEnvVarsTool,
  createVercelCreateEnvVarTool,
  createVercelDeleteEnvVarTool,
} from "./tools/vercel-env.js";
import { NutritionDbManager } from "./nutrition/nutrition-db-manager.js";

let activeNutritionDb: NutritionDbManager | null = null;
export function getNutritionDb(): NutritionDbManager | null {
  return activeNutritionDb;
}
import { createNutritionLogFoodTool } from "./tools/nutrition-log-food.js";
import { createNutritionDiaryTool } from "./tools/nutrition-diary.js";
import { createNutritionDeleteFoodTool } from "./tools/nutrition-delete-food.js";
import { createNutritionLogExerciseTool } from "./tools/nutrition-log-exercise.js";
import { createNutritionExercisesTool } from "./tools/nutrition-exercises.js";
import { createNutritionDeleteExerciseTool } from "./tools/nutrition-delete-exercise.js";
import { createNutritionLogBiometricTool } from "./tools/nutrition-log-biometric.js";
import { createNutritionBiometricsTool } from "./tools/nutrition-biometrics.js";
import { createNutritionNotesTool } from "./tools/nutrition-notes.js";
import { createNutritionSetTargetsTool } from "./tools/nutrition-set-targets.js";
import { createNutritionAddPantryItemTool } from "./tools/nutrition-pantry-add.js";
import { createNutritionListPantryTool } from "./tools/nutrition-pantry-list.js";
import { createNutritionUpdatePantryItemTool } from "./tools/nutrition-pantry-update.js";
import { createNutritionRemovePantryItemTool } from "./tools/nutrition-pantry-remove.js";
import { createNutritionSaveMealPlanTool } from "./tools/nutrition-save-meal-plan.js";
import { createNutritionGetMealPlanTool } from "./tools/nutrition-get-meal-plan.js";
import { createNutritionDeleteMealPlanTool } from "./tools/nutrition-delete-meal-plan.js";
import { createNutritionSaveWorkoutPlanTool } from "./tools/nutrition-save-workout-plan.js";
import { createNutritionSaveWorkoutProgramTool } from "./tools/nutrition-save-workout-program.js";
import { createNutritionGetWorkoutPlanTool } from "./tools/nutrition-get-workout-plan.js";
import { createNutritionDeleteWorkoutPlanTool } from "./tools/nutrition-delete-workout-plan.js";
import {
  createProjectListTool,
  createProjectCreateTool,
  createProjectUpdateTool,
  createProjectDeleteTool,
  createProjectAddLinkTool,
  createProjectRemoveLinkTool,
} from "./tools/project-tools.js";
import { createProjectCodeEditTool } from "./tools/project-code-tools.js";
import type { PluginConfig } from "./types/plugin-config.js";
import { getWsServer } from "./channel/send.js";
import { getActiveContext } from "./channel/active-context.js";
import { createBackgroundWorkerTool } from "./tools/background-worker.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function truncateStr(val: unknown, max = 200): string {
  const s = typeof val === "string" ? val : JSON.stringify(val);
  return s.length > max ? s.slice(0, max) + "..." : s;
}

function wrapToolWithBroadcast(tool: any): any {
  const originalExecute = tool.execute;
  return {
    ...tool,
    execute: async (...args: unknown[]) => {
      const ws = getWsServer();
      const ctx = getActiveContext();
      const params = (args[1] ?? {}) as Record<string, unknown>;
      const startTs = Date.now();
      if (ws && ctx.conversationId) {
        ws.broadcast({
          type: "tool_use",
          name: tool.name,
          phase: "start",
          conversationId: ctx.conversationId,
          params,
        });
      }
      let rawResult: unknown;
      try {
        rawResult = await originalExecute(...args);
        return rawResult;
      } finally {
        if (ws && ctx.conversationId) {
          ws.broadcast({
            type: "tool_use",
            name: tool.name,
            phase: "end",
            conversationId: ctx.conversationId,
            durationMs: Date.now() - startTs,
            result: truncateStr(rawResult),
          });
        }
      }
    },
  };
}

export function register(api: OpenClawPluginApi): void {
  // iOS WebSocket channel
  setChannelRuntime(api.runtime);
  api.registerChannel({ plugin: iosChannelPlugin as ChannelPlugin });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const reg = (tool: any) =>
    api.registerTool(wrapToolWithBroadcast(tool));

  // Project tools — register unconditionally, use lazy store access
  reg(createProjectListTool());
  reg(createProjectCreateTool());
  reg(createProjectUpdateTool());
  reg(createProjectDeleteTool());
  reg(createProjectAddLinkTool());
  reg(createProjectRemoveLinkTool());
  reg(createProjectCodeEditTool());

  reg(createBackgroundWorkerTool({
    submitBackground: async (req) => {
      const manager = getDispatchManager();
      if (!manager) {
        throw new Error("Dispatch manager not initialized — iOS channel not running");
      }
      const ctx = getActiveContext();
      const conversationId = req.reportToConversation ?? ctx.conversationId;
      if (!conversationId) {
        throw new Error("No conversation context — cannot determine where to report results");
      }
      const taskId = `bg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      // Submit as background priority — will run when a slot opens
      manager.submit({
        conversationId: taskId,
        connId: ctx.connId ?? "",
        priority: "background",
        fn: async () => {
          // TODO: In a future task, this will dispatch the background
          // task text through the agent. For now, this is a placeholder
          // that establishes the plumbing.
        },
      }).catch((err) => {
        // Background tasks fail silently — errors logged but don't crash
        api.logger.error(`[omniclaw] background task ${taskId} failed: ${err}`);
      });

      return taskId;
    },
  }));

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
  reg(createCanvasAuthTool(canvasManager, config));
  reg(createCanvasProfileTool(canvasManager));
  reg(createCanvasCoursesTool(canvasManager));
  reg(createCanvasGetCourseTool(canvasManager));
  reg(createCanvasAssignmentsTool(canvasManager));
  reg(createCanvasGetAssignmentTool(canvasManager));
  reg(createCanvasAnnouncementsTool(canvasManager));
  reg(createCanvasGradesTool(canvasManager));
  reg(createCanvasSubmissionsTool(canvasManager));
  reg(createCanvasDownloadFileTool(canvasManager));
  reg(createCanvasTodoTool(canvasManager));

  // GitHub tools — register unconditionally, no Google credentials required
  const githubTokensPath = config.tokens_path
    ? path.join(path.dirname(config.tokens_path), "omniclaw-github-tokens.json")
    : path.join(defaultTokensDir, "omniclaw-github-tokens.json");

  const githubManager = new GitHubClientManager(githubTokensPath);

  reg(createGitHubAuthTool(githubManager, config));
  reg(createGitHubIssuesTool(githubManager));
  reg(createGitHubGetIssueTool(githubManager));
  reg(createGitHubCreateIssueTool(githubManager));
  reg(createGitHubUpdateIssueTool(githubManager));
  reg(createGitHubAddIssueCommentTool(githubManager));
  reg(createGitHubPullsTool(githubManager));
  reg(createGitHubGetPullTool(githubManager));
  reg(createGitHubCreatePullTool(githubManager));
  reg(createGitHubMergePullTool(githubManager));
  reg(createGitHubAddPullReviewTool(githubManager));
  reg(createGitHubReposTool(githubManager));
  reg(createGitHubGetRepoTool(githubManager));
  reg(createGitHubSearchCodeTool(githubManager));
  reg(createGitHubGetFileTool(githubManager));
  reg(createGitHubBranchesTool(githubManager));
  reg(createGitHubNotificationsTool(githubManager));
  reg(createGitHubMarkNotificationReadTool(githubManager));

  // Gemini tools — register unconditionally, no Google OAuth credentials required
  const geminiKeysPath = config.tokens_path
    ? path.join(path.dirname(config.tokens_path), "omniclaw-gemini-keys.json")
    : path.join(defaultTokensDir, "omniclaw-gemini-keys.json");

  const geminiManager = new GeminiClientManager(geminiKeysPath);

  reg(createGeminiAuthTool(geminiManager, config));
  reg(createGeminiGenerateImageTool(geminiManager));
  reg(createGeminiEditImageTool(geminiManager));
  reg(createGeminiGenerateVideoTool(geminiManager));
  reg(createGeminiAnalyzeVideoTool(geminiManager));

  // LinkedIn tools — register unconditionally, no Google credentials required
  const linkedinTokensPath =
    config.linkedin_tokens_path ??
    path.join(
      config.tokens_path ? path.dirname(config.tokens_path) : defaultTokensDir,
      "omniclaw-linkedin-tokens.json",
    );

  const linkedinManager = new LinkedInClientManager(linkedinTokensPath);

  reg(createLinkedInAuthTool(linkedinManager, config));
  reg(createLinkedInMyProfileTool(linkedinManager));
  reg(createLinkedInGetProfileTool(linkedinManager));
  reg(createLinkedInFeedTool(linkedinManager));
  reg(createLinkedInDownloadMediaTool(linkedinManager));
  reg(createLinkedInConnectionsTool(linkedinManager));
  reg(createLinkedInConversationsTool(linkedinManager));
  reg(createLinkedInMessagesTool(linkedinManager));
  reg(createLinkedInNotificationsTool(linkedinManager));
  reg(createLinkedInSearchTool(linkedinManager));
  reg(createLinkedInSearchJobsTool(linkedinManager));
  reg(createLinkedInPendingInvitationsTool(linkedinManager));
  reg(createLinkedInCompanyTool(linkedinManager));
  reg(createLinkedInJobDetailsTool(linkedinManager));
  reg(createLinkedInPostCommentsTool(linkedinManager));
  reg(createLinkedInProfileViewsTool(linkedinManager));
  reg(createLinkedInSavedJobsTool(linkedinManager));

  // Instagram tools — register unconditionally, no Google credentials required
  const instagramTokensPath =
    config.instagram_tokens_path ??
    path.join(
      config.tokens_path ? path.dirname(config.tokens_path) : defaultTokensDir,
      "omniclaw-instagram-tokens.json",
    );

  const instagramManager = new InstagramClientManager(instagramTokensPath);

  reg(createInstagramAuthTool(instagramManager, config));
  reg(createInstagramProfileTool(instagramManager));
  reg(createInstagramGetProfileTool(instagramManager));
  reg(createInstagramFeedTool(instagramManager));
  reg(createInstagramUserPostsTool(instagramManager));
  reg(createInstagramPostDetailsTool(instagramManager));
  reg(createInstagramPostCommentsTool(instagramManager));
  reg(createInstagramStoriesTool(instagramManager));
  reg(createInstagramReelsTool(instagramManager));
  reg(createInstagramSearchTool(instagramManager));
  reg(createInstagramFollowersTool(instagramManager));
  reg(createInstagramFollowingTool(instagramManager));
  reg(createInstagramConversationsTool(instagramManager));
  reg(createInstagramMessagesTool(instagramManager));
  reg(createInstagramNotificationsTool(instagramManager));
  reg(createInstagramSavedTool(instagramManager));
  reg(createInstagramDownloadMediaTool(instagramManager));

  // Factor75 tools — register unconditionally, no Google credentials required
  const factor75TokensPath =
    config.factor75_tokens_path ??
    path.join(
      config.tokens_path ? path.dirname(config.tokens_path) : defaultTokensDir,
      "omniclaw-factor75-tokens.json",
    );

  const factor75Manager = new Factor75ClientManager(factor75TokensPath);

  reg(createFactor75AuthTool(factor75Manager, config));
  reg(createFactor75MenuTool(factor75Manager));
  reg(createFactor75MealDetailsTool(factor75Manager));
  reg(createFactor75GetSelectionsTool(factor75Manager));
  reg(createFactor75SelectMealTool(factor75Manager));
  reg(createFactor75RemoveMealTool(factor75Manager));
  reg(createFactor75SubscriptionTool(factor75Manager));
  reg(createFactor75SkipWeekTool(factor75Manager));
  reg(createFactor75PauseTool(factor75Manager));
  reg(createFactor75ResumeTool(factor75Manager));
  reg(createFactor75DeliveriesTool(factor75Manager));
  reg(createFactor75DeliveryDetailsTool(factor75Manager));
  reg(createFactor75AccountTool(factor75Manager));

  // Slack tools — register unconditionally, no Google credentials required
  const slackTokensPath =
    config.slack_tokens_path ??
    path.join(
      config.tokens_path ? path.dirname(config.tokens_path) : defaultTokensDir,
      "omniclaw-slack-tokens.json",
    );

  const slackManager = new SlackClientManager(slackTokensPath);

  reg(createSlackAuthTool(slackManager, config));
  reg(createSlackListChannelsTool(slackManager));
  reg(createSlackGetChannelInfoTool(slackManager));
  reg(createSlackListMessagesTool(slackManager));
  reg(createSlackGetThreadTool(slackManager));
  reg(createSlackSearchMessagesTool(slackManager));
  reg(createSlackListUsersTool(slackManager));
  reg(createSlackGetUserInfoTool(slackManager));

  // Vercel tools — register unconditionally, no Google credentials required
  const vercelTokensPath = config.tokens_path
    ? path.join(path.dirname(config.tokens_path), "omniclaw-vercel-tokens.json")
    : path.join(defaultTokensDir, "omniclaw-vercel-tokens.json");

  const vercelManager = new VercelClientManager(vercelTokensPath);

  reg(createVercelAuthTool(vercelManager, config));
  reg(createVercelProjectsTool(vercelManager));
  reg(createVercelGetProjectTool(vercelManager));
  reg(createVercelCreateProjectTool(vercelManager));
  reg(createVercelDeleteProjectTool(vercelManager));
  reg(createVercelDeploymentsTool(vercelManager));
  reg(createVercelGetDeploymentTool(vercelManager));
  reg(createVercelCreateDeploymentTool(vercelManager));
  reg(createVercelCancelDeploymentTool(vercelManager));
  reg(createVercelDeploymentEventsTool(vercelManager));
  reg(createVercelDomainsTool(vercelManager));
  reg(createVercelAddDomainTool(vercelManager));
  reg(createVercelRemoveDomainTool(vercelManager));
  reg(createVercelEnvVarsTool(vercelManager));
  reg(createVercelCreateEnvVarTool(vercelManager));
  reg(createVercelDeleteEnvVarTool(vercelManager));

  // Nutrition tools — local SQLite, no external API
  const nutritionDbPath =
    config.nutrition_db_path ??
    path.join(
      config.tokens_path ? path.dirname(config.tokens_path) : defaultTokensDir,
      "omniclaw-nutrition.db",
    );
  const nutritionDb = new NutritionDbManager(nutritionDbPath);
  activeNutritionDb = nutritionDb;

  reg(createNutritionLogFoodTool(nutritionDb));
  reg(createNutritionDiaryTool(nutritionDb));
  reg(createNutritionDeleteFoodTool(nutritionDb));
  reg(createNutritionLogExerciseTool(nutritionDb));
  reg(createNutritionExercisesTool(nutritionDb));
  reg(createNutritionDeleteExerciseTool(nutritionDb));
  reg(createNutritionLogBiometricTool(nutritionDb));
  reg(createNutritionBiometricsTool(nutritionDb));
  reg(createNutritionNotesTool(nutritionDb));
  reg(createNutritionSetTargetsTool(nutritionDb));
  reg(createNutritionAddPantryItemTool(nutritionDb));
  reg(createNutritionListPantryTool(nutritionDb));
  reg(createNutritionUpdatePantryItemTool(nutritionDb));
  reg(createNutritionRemovePantryItemTool(nutritionDb));
  reg(createNutritionSaveMealPlanTool(nutritionDb));
  reg(createNutritionGetMealPlanTool(nutritionDb));
  reg(createNutritionDeleteMealPlanTool(nutritionDb));
  reg(createNutritionSaveWorkoutPlanTool(nutritionDb));
  reg(createNutritionSaveWorkoutProgramTool(nutritionDb));
  reg(createNutritionGetWorkoutPlanTool(nutritionDb));
  reg(createNutritionDeleteWorkoutPlanTool(nutritionDb));

  // YouTube tools — no OAuth required
  reg(createYouTubeTranscriptTool());
  reg(createYouTubeDownloadThumbnailTool());

  // BlueBubbles / iMessage backend selection
  const bbTokensPath =
    config.bluebubbles_tokens_path ??
    path.join(
      config.tokens_path ? path.dirname(config.tokens_path) : defaultTokensDir,
      "omniclaw-bluebubbles-tokens.json",
    );

  const bbManager = new BlueBubblesClientManager(bbTokensPath);

  // Pre-seed from plugin config if both URL and password are provided
  if (config.bluebubbles_url && config.bluebubbles_password) {
    if (!bbManager.hasConfig("default")) {
      bbManager.setConfig("default", config.bluebubbles_url, config.bluebubbles_password);
    }
  }

  // Auth tool is always available so users can set up BlueBubbles at any time
  reg(createImessageBBAuthTool(bbManager, config));

  // iMessage tools — requires BlueBubbles
  const imessageBackend = new BlueBubblesMessageBackend(bbManager);

  reg(createImessageContactsTool(imessageBackend));
  reg(createImessageChatsTool(imessageBackend));
  reg(createImessageMessagesTool(imessageBackend));
  reg(createImessageSearchTool(imessageBackend));
  reg(createImessageSendTool(imessageBackend));
  reg(createImessageAttachmentsTool(imessageBackend));

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

  reg(createGmailInboxTool(clientManager));
  reg(createGmailSearchTool(clientManager));
  reg(createGmailAuthTool(clientManager, config));
  reg(createGmailGetTool(clientManager));
  reg(createGmailDownloadAttachmentTool(clientManager));
  reg(createGmailSendTool(clientManager));
  reg(createGmailReplyTool(clientManager));
  reg(createGmailForwardTool(clientManager));
  reg(createGmailModifyTool(clientManager));
  reg(createGmailAccountsTool(clientManager));

  reg(createCalendarAuthTool(clientManager, config));
  reg(createCalendarListCalendarsTool(clientManager));
  reg(createCalendarEventsTool(clientManager));
  reg(createCalendarGetTool(clientManager));
  reg(createCalendarCreateTool(clientManager));
  reg(createCalendarUpdateTool(clientManager));
  reg(createCalendarDeleteTool(clientManager));
  reg(createCalendarRespondTool(clientManager));

  reg(createDriveAuthTool(clientManager, config));
  reg(createDriveListTool(clientManager));
  reg(createDriveSearchTool(clientManager));
  reg(createDriveGetTool(clientManager));
  reg(createDriveReadTool(clientManager));
  reg(createDriveUploadTool(clientManager));
  reg(createDriveDownloadTool(clientManager));
  reg(createDriveCreateFolderTool(clientManager));
  reg(createDriveMoveTool(clientManager));
  reg(createDriveDeleteTool(clientManager));
  reg(createDriveShareTool(clientManager));

  reg(createDocsAuthTool(clientManager, config));
  reg(createDocsCreateTool(clientManager));
  reg(createDocsGetTool(clientManager));
  reg(createDocsAppendTool(clientManager));
  reg(createDocsReplaceTextTool(clientManager));
  reg(createDocsExportTool(clientManager));

  reg(createSlidesAuthTool(clientManager, config));
  reg(createSlidesCreateTool(clientManager));
  reg(createSlidesGetTool(clientManager));
  reg(createSlidesAppendSlideTool(clientManager));
  reg(createSlidesReplaceTextTool(clientManager));
  reg(createSlidesExportTool(clientManager));

  reg(createSheetsAuthTool(clientManager, config));
  reg(createSheetsCreateTool(clientManager));
  reg(createSheetsGetTool(clientManager));
  reg(createSheetsUpdateTool(clientManager));
  reg(createSheetsAppendTool(clientManager));
  reg(createSheetsClearTool(clientManager));
  reg(createSheetsExportTool(clientManager));

  reg(createYouTubeAuthTool(clientManager, config));
  reg(createYouTubeSearchTool(clientManager));
  reg(createYouTubeVideoDetailsTool(clientManager));
  reg(createYouTubeChannelInfoTool(clientManager));
  reg(createYouTubeVideoCommentsTool(clientManager));
}
