import * as os from "os";
import * as path from "path";
import { CanvasClientManager } from "../auth/canvas-client-manager.js";
import { GeminiClientManager } from "../auth/gemini-client-manager.js";
import { GitHubClientManager } from "../auth/github-client-manager.js";
import { LinkedInClientManager } from "../auth/linkedin-client-manager.js";
import { OAuthClientManager } from "../auth/oauth-client-manager.js";
import { TokenStore } from "../auth/token-store.js";
import { InstagramClientManager } from "../auth/instagram-client-manager.js";
import { TikTokClientManager } from "../auth/tiktok-client-manager.js";
import { Factor75ClientManager } from "../auth/factor75-client-manager.js";
import { SlackClientManager } from "../auth/slack-client-manager.js";
import { BlueBubblesClientManager } from "../auth/bluebubbles-client-manager.js";
import { VercelClientManager } from "../auth/vercel-client-manager.js";
import { XClientManager } from "../auth/x-client-manager.js";
import { NutritionDbManager } from "../nutrition/nutrition-db-manager.js";
import type { PluginConfig } from "../types/plugin-config.js";

import { createCalendarCreateTool } from "../tools/calendar-create.js";
import { createCalendarDeleteTool } from "../tools/calendar-delete.js";
import { createCalendarEventsTool } from "../tools/calendar-events.js";
import { createCalendarGetTool } from "../tools/calendar-get.js";
import { createCalendarListCalendarsTool } from "../tools/calendar-list-calendars.js";
import { createCalendarRespondTool } from "../tools/calendar-respond.js";
import { createCalendarUpdateTool } from "../tools/calendar-update.js";
import { createCanvasAnnouncementsTool } from "../tools/canvas-announcements.js";
import {
  createCanvasAssignmentsTool,
  createCanvasGetAssignmentTool,
} from "../tools/canvas-assignments.js";
import { createCanvasAuthTool } from "../tools/canvas-auth-tool.js";
import { createCanvasCoursesTool, createCanvasGetCourseTool } from "../tools/canvas-courses.js";
import { createCanvasGradesTool } from "../tools/canvas-grades.js";
import { createCanvasProfileTool } from "../tools/canvas-profile.js";
import { createCanvasDownloadFileTool } from "../tools/canvas-download.js";
import { createCanvasSubmissionsTool } from "../tools/canvas-submissions.js";
import { createCanvasTodoTool } from "../tools/canvas-todo.js";
import { createDocsAppendTool } from "../tools/docs-append.js";
import { createDocsCreateTool } from "../tools/docs-create.js";
import { createDocsExportTool } from "../tools/docs-download.js";
import { createDocsGetTool } from "../tools/docs-get.js";
import { createDocsReplaceTextTool } from "../tools/docs-replace-text.js";
import { createDriveCreateFolderTool } from "../tools/drive-create-folder.js";
import { createDriveDeleteTool } from "../tools/drive-delete.js";
import { createDriveDownloadTool } from "../tools/drive-download.js";
import { createDriveGetTool } from "../tools/drive-get.js";
import { createDriveListTool } from "../tools/drive-list.js";
import { createDriveMoveTool } from "../tools/drive-move.js";
import { createDriveReadTool } from "../tools/drive-read.js";
import { createDriveSearchTool } from "../tools/drive-search.js";
import { createDriveShareTool } from "../tools/drive-share.js";
import { createDriveUploadTool } from "../tools/drive-upload.js";
import { createGeminiAuthTool } from "../tools/gemini-auth-tool.js";
import { createGeminiGenerateImageTool, createGeminiEditImageTool } from "../tools/gemini-image.js";
import { createGeminiGenerateVideoTool } from "../tools/gemini-video-gen.js";
import { createGeminiAnalyzeVideoTool } from "../tools/gemini-video-understand.js";
import { createGitHubAuthTool } from "../tools/github-auth-tool.js";
import { createInstagramAuthTool } from "../tools/instagram-auth-tool.js";
import { createInstagramFeedTool } from "../tools/instagram-feed.js";
import { createInstagramConversationsTool, createInstagramMessagesTool } from "../tools/instagram-messages.js";
import { createInstagramNotificationsTool } from "../tools/instagram-notifications.js";
import { createInstagramUserPostsTool, createInstagramPostDetailsTool } from "../tools/instagram-posts.js";
import { createInstagramProfileTool, createInstagramGetProfileTool } from "../tools/instagram-profile.js";
import { createInstagramReelsTool } from "../tools/instagram-reels.js";
import { createInstagramSavedTool } from "../tools/instagram-saved.js";
import { createInstagramSearchTool } from "../tools/instagram-search.js";
import { createInstagramFollowersTool, createInstagramFollowingTool } from "../tools/instagram-social.js";
import { createInstagramStoriesTool } from "../tools/instagram-stories.js";
import { createInstagramPostCommentsTool } from "../tools/instagram-comments.js";
import { createInstagramDownloadMediaTool } from "../tools/instagram-download-media.js";
import { createTikTokAuthTool } from "../tools/tiktok-auth-tool.js";
import { createTikTokProfileTool, createTikTokGetUserTool } from "../tools/tiktok-profile.js";
import { createTikTokUserVideosTool } from "../tools/tiktok-user-videos.js";
import { createTikTokVideoDetailsTool } from "../tools/tiktok-video-details.js";
import { createTikTokFeedTool } from "../tools/tiktok-feed.js";
import { createTikTokSearchVideosTool, createTikTokSearchUsersTool } from "../tools/tiktok-search.js";
import { createTikTokTrendingTool } from "../tools/tiktok-trending.js";
import { createTikTokVideoCommentsTool } from "../tools/tiktok-video-comments.js";
import { createLinkedInAuthTool } from "../tools/linkedin-auth-tool.js";
import { createLinkedInCompanyTool } from "../tools/linkedin-company.js";
import { createLinkedInConnectionsTool } from "../tools/linkedin-connections.js";
import { createLinkedInDownloadMediaTool } from "../tools/linkedin-download-media.js";
import { createLinkedInFeedTool } from "../tools/linkedin-feed.js";
import { createLinkedInPendingInvitationsTool } from "../tools/linkedin-invitations.js";
import { createLinkedInJobDetailsTool } from "../tools/linkedin-job-details.js";
import { createLinkedInConversationsTool, createLinkedInMessagesTool } from "../tools/linkedin-messages.js";
import { createLinkedInNotificationsTool } from "../tools/linkedin-notifications.js";
import { createLinkedInPostCommentsTool } from "../tools/linkedin-post-comments.js";
import { createLinkedInProfileTool as createLinkedInMyProfileTool, createLinkedInGetProfileTool } from "../tools/linkedin-profile.js";
import { createLinkedInProfileViewsTool } from "../tools/linkedin-profile-views.js";
import { createLinkedInSavedJobsTool } from "../tools/linkedin-saved-jobs.js";
import { createLinkedInSearchTool, createLinkedInSearchJobsTool } from "../tools/linkedin-search.js";
import { createLinkedInSendMessageTool } from "../tools/linkedin-send-message.js";
import { createLinkedInSendConnectionRequestTool } from "../tools/linkedin-connection-request.js";
import { createLinkedInRespondInvitationTool } from "../tools/linkedin-respond-invitation.js";
import { createLinkedInCreatePostTool } from "../tools/linkedin-create-post.js";
import { createLinkedInReactToPostTool } from "../tools/linkedin-react.js";
import { createLinkedInCommentOnPostTool } from "../tools/linkedin-comment.js";
import {
  createGitHubIssuesTool,
  createGitHubGetIssueTool,
  createGitHubCreateIssueTool,
  createGitHubUpdateIssueTool,
  createGitHubAddIssueCommentTool,
} from "../tools/github-issues.js";
import {
  createGitHubNotificationsTool,
  createGitHubMarkNotificationReadTool,
} from "../tools/github-notifications.js";
import {
  createGitHubPullsTool,
  createGitHubGetPullTool,
  createGitHubCreatePullTool,
  createGitHubMergePullTool,
  createGitHubAddPullReviewTool,
} from "../tools/github-pulls.js";
import {
  createGitHubReposTool,
  createGitHubGetRepoTool,
  createGitHubSearchCodeTool,
  createGitHubGetFileTool,
  createGitHubBranchesTool,
} from "../tools/github-repos.js";
import { createGmailAccountsTool } from "../tools/gmail-accounts.js";
import {
  createGmailAuthTool,
  createCalendarAuthTool,
  createDriveAuthTool,
  createDocsAuthTool,
  createSlidesAuthTool,
  createSheetsAuthTool,
  createYouTubeAuthTool,
} from "../tools/gmail-auth-tool.js";
import { createGmailGetTool, createGmailDownloadAttachmentTool } from "../tools/gmail-get.js";
import { createGmailInboxTool, createGmailSearchTool } from "../tools/gmail-inbox.js";
import { createGmailModifyTool } from "../tools/gmail-modify.js";
import {
  createGmailSendTool,
  createGmailReplyTool,
  createGmailForwardTool,
} from "../tools/gmail-send.js";
import { createSheetsAppendTool } from "../tools/sheets-append.js";
import { createSheetsClearTool } from "../tools/sheets-clear.js";
import { createSheetsCreateTool } from "../tools/sheets-create.js";
import { createSheetsExportTool } from "../tools/sheets-download.js";
import { createSheetsGetTool } from "../tools/sheets-get.js";
import { createSheetsUpdateTool } from "../tools/sheets-update.js";
import { createSlidesAppendSlideTool } from "../tools/slides-append-slide.js";
import { createSlidesCreateTool } from "../tools/slides-create.js";
import { createSlidesExportTool } from "../tools/slides-download.js";
import { createSlidesGetTool } from "../tools/slides-get.js";
import { createSlidesReplaceTextTool } from "../tools/slides-replace-text.js";
import { createYouTubeSearchTool, createYouTubeVideoDetailsTool } from "../tools/youtube-search.js";
import {
  createYouTubeChannelInfoTool,
  createYouTubeVideoCommentsTool,
} from "../tools/youtube-social.js";
import { createYouTubeDownloadThumbnailTool } from "../tools/youtube-download-thumbnail.js";
import { createYouTubeTranscriptTool } from "../tools/youtube-transcript.js";
import { createFactor75AuthTool } from "../tools/factor75-auth-tool.js";
import { createSlackAuthTool } from "../tools/slack-auth-tool.js";
import { createSlackListChannelsTool, createSlackGetChannelInfoTool } from "../tools/slack-channels.js";
import { createSlackListMessagesTool, createSlackGetThreadTool } from "../tools/slack-messages.js";
import { createSlackSearchMessagesTool } from "../tools/slack-search.js";
import { createSlackListUsersTool, createSlackGetUserInfoTool } from "../tools/slack-users.js";
import { createFactor75MenuTool } from "../tools/factor75-menu.js";
import { createFactor75MealDetailsTool } from "../tools/factor75-meal-details.js";
import {
  createFactor75GetSelectionsTool,
  createFactor75SelectMealTool,
  createFactor75RemoveMealTool,
} from "../tools/factor75-selections.js";
import {
  createFactor75SubscriptionTool,
  createFactor75SkipWeekTool,
  createFactor75PauseTool,
  createFactor75ResumeTool,
} from "../tools/factor75-subscription.js";
import { createFactor75DeliveriesTool, createFactor75DeliveryDetailsTool } from "../tools/factor75-deliveries.js";
import { createFactor75AccountTool } from "../tools/factor75-account.js";
import { BlueBubblesMessageBackend } from "../tools/imessage-backend-bluebubbles.js";
import { createImessageBBAuthTool } from "../tools/imessage-auth-tool.js";
import { createImessageContactsTool } from "../tools/imessage-contacts.js";
import { createImessageChatsTool } from "../tools/imessage-chats.js";
import { createImessageMessagesTool, createImessageSearchTool } from "../tools/imessage-messages.js";
import { createImessageSendTool } from "../tools/imessage-send.js";
import { createImessageAttachmentsTool } from "../tools/imessage-attachments.js";
import { createVercelAuthTool } from "../tools/vercel-auth.js";
import {
  createVercelProjectsTool,
  createVercelGetProjectTool,
  createVercelCreateProjectTool,
  createVercelDeleteProjectTool,
} from "../tools/vercel-projects.js";
import {
  createVercelDeploymentsTool,
  createVercelGetDeploymentTool,
  createVercelCreateDeploymentTool,
  createVercelCancelDeploymentTool,
  createVercelDeploymentEventsTool,
} from "../tools/vercel-deployments.js";
import {
  createVercelDomainsTool,
  createVercelAddDomainTool,
  createVercelRemoveDomainTool,
} from "../tools/vercel-domains.js";
import {
  createVercelEnvVarsTool,
  createVercelCreateEnvVarTool,
  createVercelDeleteEnvVarTool,
} from "../tools/vercel-env.js";
import { createXAuthTool } from "../tools/x-auth-tool.js";
import { createXGetTimelineTool, createXGetUserTweetsTool } from "../tools/x-timeline.js";
import { createXSearchTool } from "../tools/x-search.js";
import { createXPostTweetTool, createXDeleteTweetTool, createXReplyTool } from "../tools/x-tweet.js";
import { createXLikeTool, createXUnlikeTool, createXRetweetTool, createXUnretweetTool } from "../tools/x-engagement.js";
import { createXGetProfileTool, createXFollowTool, createXUnfollowTool } from "../tools/x-users.js";
import { createXGetBookmarksTool, createXAddBookmarkTool, createXRemoveBookmarkTool } from "../tools/x-bookmarks.js";
import { createXUpdateProfileTool, createXUpdateProfileImageTool, createXUpdateProfileBannerTool } from "../tools/x-profile.js";
import { createXGetTweetDetailTool } from "../tools/x-tweet-detail.js";
import { createXMuteTool, createXUnmuteTool, createXBlockTool, createXUnblockTool, createXPinTweetTool, createXUnpinTweetTool, createXHideReplyTool, createXUnhideReplyTool } from "../tools/x-moderation.js";
import { createXPostMediaTweetTool, createXQuoteTweetTool, createXPostThreadTool, createXPostPollTool } from "../tools/x-tweet-extended.js";
import { createXDmInboxTool, createXDmConversationTool, createXDmSendTool } from "../tools/x-dms.js";
import { createXGetListsTool, createXGetListTweetsTool, createXGetListMembersTool, createXCreateListTool, createXDeleteListTool, createXUpdateListTool, createXListAddMemberTool, createXListRemoveMemberTool } from "../tools/x-lists.js";
import { createNutritionLogFoodTool } from "../tools/nutrition-log-food.js";
import { createNutritionDiaryTool } from "../tools/nutrition-diary.js";
import { createNutritionDeleteFoodTool } from "../tools/nutrition-delete-food.js";
import { createNutritionLogExerciseTool } from "../tools/nutrition-log-exercise.js";
import { createNutritionExercisesTool } from "../tools/nutrition-exercises.js";
import { createNutritionDeleteExerciseTool } from "../tools/nutrition-delete-exercise.js";
import { createNutritionLogBiometricTool } from "../tools/nutrition-log-biometric.js";
import { createNutritionBiometricsTool } from "../tools/nutrition-biometrics.js";
import { createNutritionNotesTool } from "../tools/nutrition-notes.js";
import { createNutritionSetTargetsTool } from "../tools/nutrition-set-targets.js";
import { createNutritionAddPantryItemTool } from "../tools/nutrition-pantry-add.js";
import { createNutritionListPantryTool } from "../tools/nutrition-pantry-list.js";
import { createNutritionUpdatePantryItemTool } from "../tools/nutrition-pantry-update.js";
import { createNutritionRemovePantryItemTool } from "../tools/nutrition-pantry-remove.js";
import { createNutritionSaveMealPlanTool } from "../tools/nutrition-save-meal-plan.js";
import { createNutritionGetMealPlanTool } from "../tools/nutrition-get-meal-plan.js";
import { createNutritionDeleteMealPlanTool } from "../tools/nutrition-delete-meal-plan.js";
import { createNutritionSaveWorkoutPlanTool } from "../tools/nutrition-save-workout-plan.js";
import { createNutritionSaveWorkoutProgramTool } from "../tools/nutrition-save-workout-program.js";
import { createNutritionGetWorkoutPlanTool } from "../tools/nutrition-get-workout-plan.js";
import { createNutritionDeleteWorkoutPlanTool } from "../tools/nutrition-delete-workout-plan.js";
import {
  createProjectListTool,
  createProjectCreateTool,
  createProjectUpdateTool,
  createProjectDeleteTool,
  createProjectAddLinkTool,
  createProjectRemoveLinkTool,
} from "../tools/project-tools.js";
import { createProjectCodeEditTool } from "../tools/project-code-tools.js";
import {
  createMemorySaveTool,
  createMemoryReadTool,
  createMemoryListTool,
  createMemoryDeleteTool,
  createMemoryUpdateIndexTool,
} from "../tools/memory-tools.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface OmniclawTool {
  name: string;
  label: string;
  description: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  parameters: any;
  execute: (toolCallId: string, params: Record<string, unknown>) => Promise<unknown>;
}

let _activeNutritionDb: NutritionDbManager | null = null;
export function getActiveNutritionDb(): NutritionDbManager | null {
  return _activeNutritionDb;
}

export function createAllTools(opts: { pluginConfig: PluginConfig }): OmniclawTool[] {
  const config = opts.pluginConfig;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tools: OmniclawTool[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const add = (t: any) => tools.push(t as OmniclawTool);
  const defaultTokensDir = path.join(os.homedir(), ".openclaw");

  // Project tools — register unconditionally, use lazy store access
  add(createProjectListTool());
  add(createProjectCreateTool());
  add(createProjectUpdateTool());
  add(createProjectDeleteTool());
  add(createProjectAddLinkTool());
  add(createProjectRemoveLinkTool());
  add(createProjectCodeEditTool());

  // Memory tools — local filesystem, no auth required
  add(createMemorySaveTool());
  add(createMemoryReadTool());
  add(createMemoryListTool());
  add(createMemoryDeleteTool());
  add(createMemoryUpdateIndexTool());

  // background_worker is excluded — depends on OpenClaw's dispatch manager

  // Derive Canvas tokens path alongside Google tokens
  const canvasTokensPath =
    config.canvas_tokens_path ??
    path.join(
      config.tokens_path ? path.dirname(config.tokens_path) : defaultTokensDir,
      "omniclaw-canvas-tokens.json",
    );

  const canvasManager = new CanvasClientManager(canvasTokensPath);

  // Canvas tools register unconditionally — no Google credentials required
  add(createCanvasAuthTool(canvasManager, config));
  add(createCanvasProfileTool(canvasManager));
  add(createCanvasCoursesTool(canvasManager));
  add(createCanvasGetCourseTool(canvasManager));
  add(createCanvasAssignmentsTool(canvasManager));
  add(createCanvasGetAssignmentTool(canvasManager));
  add(createCanvasAnnouncementsTool(canvasManager));
  add(createCanvasGradesTool(canvasManager));
  add(createCanvasSubmissionsTool(canvasManager));
  add(createCanvasDownloadFileTool(canvasManager));
  add(createCanvasTodoTool(canvasManager));

  // GitHub tools — register unconditionally, no Google credentials required
  const githubTokensPath = config.tokens_path
    ? path.join(path.dirname(config.tokens_path), "omniclaw-github-tokens.json")
    : path.join(defaultTokensDir, "omniclaw-github-tokens.json");

  const githubManager = new GitHubClientManager(githubTokensPath);

  add(createGitHubAuthTool(githubManager, config));
  add(createGitHubIssuesTool(githubManager));
  add(createGitHubGetIssueTool(githubManager));
  add(createGitHubCreateIssueTool(githubManager));
  add(createGitHubUpdateIssueTool(githubManager));
  add(createGitHubAddIssueCommentTool(githubManager));
  add(createGitHubPullsTool(githubManager));
  add(createGitHubGetPullTool(githubManager));
  add(createGitHubCreatePullTool(githubManager));
  add(createGitHubMergePullTool(githubManager));
  add(createGitHubAddPullReviewTool(githubManager));
  add(createGitHubReposTool(githubManager));
  add(createGitHubGetRepoTool(githubManager));
  add(createGitHubSearchCodeTool(githubManager));
  add(createGitHubGetFileTool(githubManager));
  add(createGitHubBranchesTool(githubManager));
  add(createGitHubNotificationsTool(githubManager));
  add(createGitHubMarkNotificationReadTool(githubManager));

  // Gemini tools — register unconditionally, no Google OAuth credentials required
  const geminiKeysPath = config.tokens_path
    ? path.join(path.dirname(config.tokens_path), "omniclaw-gemini-keys.json")
    : path.join(defaultTokensDir, "omniclaw-gemini-keys.json");

  const geminiManager = new GeminiClientManager(geminiKeysPath);

  add(createGeminiAuthTool(geminiManager, config));
  add(createGeminiGenerateImageTool(geminiManager));
  add(createGeminiEditImageTool(geminiManager));
  add(createGeminiGenerateVideoTool(geminiManager));
  add(createGeminiAnalyzeVideoTool(geminiManager));

  // LinkedIn tools — register unconditionally, no Google credentials required
  const linkedinTokensPath =
    config.linkedin_tokens_path ??
    path.join(
      config.tokens_path ? path.dirname(config.tokens_path) : defaultTokensDir,
      "omniclaw-linkedin-tokens.json",
    );

  const linkedinManager = new LinkedInClientManager(linkedinTokensPath);

  add(createLinkedInAuthTool(linkedinManager, config));
  add(createLinkedInMyProfileTool(linkedinManager));
  add(createLinkedInGetProfileTool(linkedinManager));
  add(createLinkedInFeedTool(linkedinManager));
  add(createLinkedInDownloadMediaTool(linkedinManager));
  add(createLinkedInConnectionsTool(linkedinManager));
  add(createLinkedInConversationsTool(linkedinManager));
  add(createLinkedInMessagesTool(linkedinManager));
  add(createLinkedInNotificationsTool(linkedinManager));
  add(createLinkedInSearchTool(linkedinManager));
  add(createLinkedInSearchJobsTool(linkedinManager));
  add(createLinkedInPendingInvitationsTool(linkedinManager));
  add(createLinkedInCompanyTool(linkedinManager));
  add(createLinkedInJobDetailsTool(linkedinManager));
  add(createLinkedInPostCommentsTool(linkedinManager));
  add(createLinkedInProfileViewsTool(linkedinManager));
  add(createLinkedInSavedJobsTool(linkedinManager));
  add(createLinkedInSendMessageTool(linkedinManager));
  add(createLinkedInSendConnectionRequestTool(linkedinManager));
  add(createLinkedInRespondInvitationTool(linkedinManager));
  add(createLinkedInCreatePostTool(linkedinManager));
  add(createLinkedInReactToPostTool(linkedinManager));
  add(createLinkedInCommentOnPostTool(linkedinManager));

  // Instagram tools — register unconditionally, no Google credentials required
  const instagramTokensPath =
    config.instagram_tokens_path ??
    path.join(
      config.tokens_path ? path.dirname(config.tokens_path) : defaultTokensDir,
      "omniclaw-instagram-tokens.json",
    );

  const instagramManager = new InstagramClientManager(instagramTokensPath);

  add(createInstagramAuthTool(instagramManager, config));
  add(createInstagramProfileTool(instagramManager));
  add(createInstagramGetProfileTool(instagramManager));
  add(createInstagramFeedTool(instagramManager));
  add(createInstagramUserPostsTool(instagramManager));
  add(createInstagramPostDetailsTool(instagramManager));
  add(createInstagramPostCommentsTool(instagramManager));
  add(createInstagramStoriesTool(instagramManager));
  add(createInstagramReelsTool(instagramManager));
  add(createInstagramSearchTool(instagramManager));
  add(createInstagramFollowersTool(instagramManager));
  add(createInstagramFollowingTool(instagramManager));
  add(createInstagramConversationsTool(instagramManager));
  add(createInstagramMessagesTool(instagramManager));
  add(createInstagramNotificationsTool(instagramManager));
  add(createInstagramSavedTool(instagramManager));
  add(createInstagramDownloadMediaTool(instagramManager));

  // TikTok tools — register unconditionally, no Google credentials required
  const tiktokTokensPath =
    config.tiktok_tokens_path ??
    path.join(
      config.tokens_path ? path.dirname(config.tokens_path) : defaultTokensDir,
      "omniclaw-tiktok-tokens.json",
    );

  const tiktokManager = new TikTokClientManager(tiktokTokensPath);

  add(createTikTokAuthTool(tiktokManager, config));
  add(createTikTokProfileTool(tiktokManager));
  add(createTikTokGetUserTool(tiktokManager));
  add(createTikTokUserVideosTool(tiktokManager));
  add(createTikTokVideoDetailsTool(tiktokManager));
  add(createTikTokFeedTool(tiktokManager));
  add(createTikTokSearchVideosTool(tiktokManager));
  add(createTikTokSearchUsersTool(tiktokManager));
  add(createTikTokTrendingTool(tiktokManager));
  add(createTikTokVideoCommentsTool(tiktokManager));

  // Factor75 tools — register unconditionally, no Google credentials required
  const factor75TokensPath =
    config.factor75_tokens_path ??
    path.join(
      config.tokens_path ? path.dirname(config.tokens_path) : defaultTokensDir,
      "omniclaw-factor75-tokens.json",
    );

  const factor75Manager = new Factor75ClientManager(factor75TokensPath);

  add(createFactor75AuthTool(factor75Manager, config));
  add(createFactor75MenuTool(factor75Manager));
  add(createFactor75MealDetailsTool(factor75Manager));
  add(createFactor75GetSelectionsTool(factor75Manager));
  add(createFactor75SelectMealTool(factor75Manager));
  add(createFactor75RemoveMealTool(factor75Manager));
  add(createFactor75SubscriptionTool(factor75Manager));
  add(createFactor75SkipWeekTool(factor75Manager));
  add(createFactor75PauseTool(factor75Manager));
  add(createFactor75ResumeTool(factor75Manager));
  add(createFactor75DeliveriesTool(factor75Manager));
  add(createFactor75DeliveryDetailsTool(factor75Manager));
  add(createFactor75AccountTool(factor75Manager));

  // Slack tools — register unconditionally, no Google credentials required
  const slackTokensPath =
    config.slack_tokens_path ??
    path.join(
      config.tokens_path ? path.dirname(config.tokens_path) : defaultTokensDir,
      "omniclaw-slack-tokens.json",
    );

  const slackManager = new SlackClientManager(slackTokensPath);

  add(createSlackAuthTool(slackManager, config));
  add(createSlackListChannelsTool(slackManager));
  add(createSlackGetChannelInfoTool(slackManager));
  add(createSlackListMessagesTool(slackManager));
  add(createSlackGetThreadTool(slackManager));
  add(createSlackSearchMessagesTool(slackManager));
  add(createSlackListUsersTool(slackManager));
  add(createSlackGetUserInfoTool(slackManager));

  // Vercel tools — register unconditionally, no Google credentials required
  const vercelTokensPath = config.tokens_path
    ? path.join(path.dirname(config.tokens_path), "omniclaw-vercel-tokens.json")
    : path.join(defaultTokensDir, "omniclaw-vercel-tokens.json");

  const vercelManager = new VercelClientManager(vercelTokensPath);

  add(createVercelAuthTool(vercelManager, config));
  add(createVercelProjectsTool(vercelManager));
  add(createVercelGetProjectTool(vercelManager));
  add(createVercelCreateProjectTool(vercelManager));
  add(createVercelDeleteProjectTool(vercelManager));
  add(createVercelDeploymentsTool(vercelManager));
  add(createVercelGetDeploymentTool(vercelManager));
  add(createVercelCreateDeploymentTool(vercelManager));
  add(createVercelCancelDeploymentTool(vercelManager));
  add(createVercelDeploymentEventsTool(vercelManager));
  add(createVercelDomainsTool(vercelManager));
  add(createVercelAddDomainTool(vercelManager));
  add(createVercelRemoveDomainTool(vercelManager));
  add(createVercelEnvVarsTool(vercelManager));
  add(createVercelCreateEnvVarTool(vercelManager));
  add(createVercelDeleteEnvVarTool(vercelManager));

  // X (Twitter) tools — register unconditionally
  const xTokensPath =
    config.x_tokens_path ??
    path.join(
      config.tokens_path ? path.dirname(config.tokens_path) : defaultTokensDir,
      "omniclaw-x-tokens.json",
    );

  const xManager = new XClientManager(xTokensPath);

  add(createXAuthTool(xManager, config));
  add(createXGetTimelineTool(xManager));
  add(createXGetUserTweetsTool(xManager));
  add(createXSearchTool(xManager));
  add(createXPostTweetTool(xManager));
  add(createXDeleteTweetTool(xManager));
  add(createXReplyTool(xManager));
  add(createXLikeTool(xManager));
  add(createXUnlikeTool(xManager));
  add(createXRetweetTool(xManager));
  add(createXUnretweetTool(xManager));
  add(createXGetProfileTool(xManager));
  add(createXFollowTool(xManager));
  add(createXUnfollowTool(xManager));
  add(createXGetBookmarksTool(xManager));
  add(createXUpdateProfileTool(xManager));
  add(createXUpdateProfileImageTool(xManager));
  add(createXUpdateProfileBannerTool(xManager));
  add(createXAddBookmarkTool(xManager));
  add(createXRemoveBookmarkTool(xManager));
  add(createXGetTweetDetailTool(xManager));
  add(createXMuteTool(xManager));
  add(createXUnmuteTool(xManager));
  add(createXBlockTool(xManager));
  add(createXUnblockTool(xManager));
  add(createXPinTweetTool(xManager));
  add(createXUnpinTweetTool(xManager));
  add(createXHideReplyTool(xManager));
  add(createXUnhideReplyTool(xManager));
  add(createXPostMediaTweetTool(xManager));
  add(createXQuoteTweetTool(xManager));
  add(createXPostThreadTool(xManager));
  add(createXPostPollTool(xManager));
  add(createXDmInboxTool(xManager));
  add(createXDmConversationTool(xManager));
  add(createXDmSendTool(xManager));
  add(createXGetListsTool(xManager));
  add(createXGetListTweetsTool(xManager));
  add(createXGetListMembersTool(xManager));
  add(createXCreateListTool(xManager));
  add(createXDeleteListTool(xManager));
  add(createXUpdateListTool(xManager));
  add(createXListAddMemberTool(xManager));
  add(createXListRemoveMemberTool(xManager));

  // Nutrition tools — local SQLite, no external API
  const nutritionDbPath =
    config.nutrition_db_path ??
    path.join(
      config.tokens_path ? path.dirname(config.tokens_path) : defaultTokensDir,
      "omniclaw-nutrition.db",
    );
  const nutritionDb = new NutritionDbManager(nutritionDbPath);
  _activeNutritionDb = nutritionDb;

  add(createNutritionLogFoodTool(nutritionDb));
  add(createNutritionDiaryTool(nutritionDb));
  add(createNutritionDeleteFoodTool(nutritionDb));
  add(createNutritionLogExerciseTool(nutritionDb));
  add(createNutritionExercisesTool(nutritionDb));
  add(createNutritionDeleteExerciseTool(nutritionDb));
  add(createNutritionLogBiometricTool(nutritionDb));
  add(createNutritionBiometricsTool(nutritionDb));
  add(createNutritionNotesTool(nutritionDb));
  add(createNutritionSetTargetsTool(nutritionDb));
  add(createNutritionAddPantryItemTool(nutritionDb));
  add(createNutritionListPantryTool(nutritionDb));
  add(createNutritionUpdatePantryItemTool(nutritionDb));
  add(createNutritionRemovePantryItemTool(nutritionDb));
  add(createNutritionSaveMealPlanTool(nutritionDb));
  add(createNutritionGetMealPlanTool(nutritionDb));
  add(createNutritionDeleteMealPlanTool(nutritionDb));
  add(createNutritionSaveWorkoutPlanTool(nutritionDb));
  add(createNutritionSaveWorkoutProgramTool(nutritionDb));
  add(createNutritionGetWorkoutPlanTool(nutritionDb));
  add(createNutritionDeleteWorkoutPlanTool(nutritionDb));

  // YouTube tools — no OAuth required
  add(createYouTubeTranscriptTool());
  add(createYouTubeDownloadThumbnailTool());

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
  add(createImessageBBAuthTool(bbManager, config));

  // iMessage tools — requires BlueBubbles
  const imessageBackend = new BlueBubblesMessageBackend(bbManager);

  add(createImessageContactsTool(imessageBackend));
  add(createImessageChatsTool(imessageBackend));
  add(createImessageMessagesTool(imessageBackend));
  add(createImessageSearchTool(imessageBackend));
  add(createImessageSendTool(imessageBackend));
  add(createImessageAttachmentsTool(imessageBackend));

  // Google OAuth tools — gated on client_secret_path being configured
  if (config.client_secret_path) {
    const tokensPath =
      config.tokens_path ?? path.join(os.homedir(), ".openclaw", "omniclaw-tokens.json");

    const tokenStore = new TokenStore(tokensPath);
    const clientManager = new OAuthClientManager(
      config.client_secret_path,
      config.oauth_port ?? 9753,
      tokenStore,
    );

    add(createGmailInboxTool(clientManager));
    add(createGmailSearchTool(clientManager));
    add(createGmailAuthTool(clientManager, config));
    add(createGmailGetTool(clientManager));
    add(createGmailDownloadAttachmentTool(clientManager));
    add(createGmailSendTool(clientManager));
    add(createGmailReplyTool(clientManager));
    add(createGmailForwardTool(clientManager));
    add(createGmailModifyTool(clientManager));
    add(createGmailAccountsTool(clientManager));

    add(createCalendarAuthTool(clientManager, config));
    add(createCalendarListCalendarsTool(clientManager));
    add(createCalendarEventsTool(clientManager));
    add(createCalendarGetTool(clientManager));
    add(createCalendarCreateTool(clientManager));
    add(createCalendarUpdateTool(clientManager));
    add(createCalendarDeleteTool(clientManager));
    add(createCalendarRespondTool(clientManager));

    add(createDriveAuthTool(clientManager, config));
    add(createDriveListTool(clientManager));
    add(createDriveSearchTool(clientManager));
    add(createDriveGetTool(clientManager));
    add(createDriveReadTool(clientManager));
    add(createDriveUploadTool(clientManager));
    add(createDriveDownloadTool(clientManager));
    add(createDriveCreateFolderTool(clientManager));
    add(createDriveMoveTool(clientManager));
    add(createDriveDeleteTool(clientManager));
    add(createDriveShareTool(clientManager));

    add(createDocsAuthTool(clientManager, config));
    add(createDocsCreateTool(clientManager));
    add(createDocsGetTool(clientManager));
    add(createDocsAppendTool(clientManager));
    add(createDocsReplaceTextTool(clientManager));
    add(createDocsExportTool(clientManager));

    add(createSlidesAuthTool(clientManager, config));
    add(createSlidesCreateTool(clientManager));
    add(createSlidesGetTool(clientManager));
    add(createSlidesAppendSlideTool(clientManager));
    add(createSlidesReplaceTextTool(clientManager));
    add(createSlidesExportTool(clientManager));

    add(createSheetsAuthTool(clientManager, config));
    add(createSheetsCreateTool(clientManager));
    add(createSheetsGetTool(clientManager));
    add(createSheetsUpdateTool(clientManager));
    add(createSheetsAppendTool(clientManager));
    add(createSheetsClearTool(clientManager));
    add(createSheetsExportTool(clientManager));

    add(createYouTubeAuthTool(clientManager, config));
    add(createYouTubeSearchTool(clientManager));
    add(createYouTubeVideoDetailsTool(clientManager));
    add(createYouTubeChannelInfoTool(clientManager));
    add(createYouTubeVideoCommentsTool(clientManager));
  }

  return tools;
}
