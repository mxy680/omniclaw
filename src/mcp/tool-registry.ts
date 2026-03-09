import * as os from "os";
import * as path from "path";
import { OAuthClientManager } from "../auth/oauth-client-manager.js";
import { TokenStore } from "../auth/token-store.js";
import type { PluginConfig } from "../types/plugin-config.js";

import { createCalendarCreateTool } from "../tools/calendar-create.js";
import { createCalendarDeleteTool } from "../tools/calendar-delete.js";
import { createCalendarEventsTool } from "../tools/calendar-events.js";
import { createCalendarFreeBusyTool } from "../tools/calendar-freebusy.js";
import { createCalendarGetTool } from "../tools/calendar-get.js";
import { createCalendarListCalendarsTool } from "../tools/calendar-list-calendars.js";
import { createCalendarQuickAddTool } from "../tools/calendar-quick-add.js";
import { createCalendarRespondTool } from "../tools/calendar-respond.js";
import { createCalendarSearchTool } from "../tools/calendar-search.js";
import { createCalendarUpdateTool } from "../tools/calendar-update.js";
import { createDocsAppendTool } from "../tools/docs-append.js";
import { createDocsCreateTool } from "../tools/docs-create.js";
import { createDocsDeleteTextTool } from "../tools/docs-delete-text.js";
import { createDocsExportTool } from "../tools/docs-download.js";
import { createDocsGetTool } from "../tools/docs-get.js";
import { createDocsInsertTool } from "../tools/docs-insert.js";
import { createDocsReplaceTextTool } from "../tools/docs-replace-text.js";
import { createDriveCreateFolderTool } from "../tools/drive-create-folder.js";
import { createDriveCopyTool } from "../tools/drive-copy.js";
import { createDriveDeleteTool } from "../tools/drive-delete.js";
import { createDriveDownloadTool } from "../tools/drive-download.js";
import { createDriveGetTool } from "../tools/drive-get.js";
import { createDriveListTool } from "../tools/drive-list.js";
import { createDriveMoveTool } from "../tools/drive-move.js";
import {
  createDrivePermissionsListTool,
  createDrivePermissionsDeleteTool,
} from "../tools/drive-permissions.js";
import { createDriveReadTool } from "../tools/drive-read.js";
import { createDriveRestoreTool } from "../tools/drive-restore.js";
import { createDriveSearchTool } from "../tools/drive-search.js";
import { createDriveShareTool } from "../tools/drive-share.js";
import { createDriveUploadTool } from "../tools/drive-upload.js";
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
import {
  createGmailDraftListTool,
  createGmailDraftCreateTool,
  createGmailDraftUpdateTool,
  createGmailDraftDeleteTool,
  createGmailDraftSendTool,
} from "../tools/gmail-drafts.js";
import {
  createGmailLabelsListTool,
  createGmailLabelCreateTool,
  createGmailLabelDeleteTool,
} from "../tools/gmail-labels.js";
import {
  createGmailThreadListTool,
  createGmailThreadGetTool,
} from "../tools/gmail-threads.js";
import { createSheetsAppendTool } from "../tools/sheets-append.js";
import { createSheetsClearTool } from "../tools/sheets-clear.js";
import { createSheetsCreateTool } from "../tools/sheets-create.js";
import { createSheetsExportTool } from "../tools/sheets-download.js";
import { createSheetsGetTool } from "../tools/sheets-get.js";
import { createSheetsInfoTool } from "../tools/sheets-info.js";
import {
  createSheetsAddSheetTool,
  createSheetsDeleteSheetTool,
  createSheetsRenameSheetTool,
} from "../tools/sheets-manage.js";
import { createSheetsUpdateTool } from "../tools/sheets-update.js";
import { createSlidesAppendSlideTool } from "../tools/slides-append-slide.js";
import { createSlidesCreateTool } from "../tools/slides-create.js";
import { createSlidesExportTool } from "../tools/slides-download.js";
import { createSlidesGetTool } from "../tools/slides-get.js";
import {
  createSlidesDeleteSlideTool,
  createSlidesDuplicateSlideTool,
} from "../tools/slides-manage.js";
import { createSlidesWriteNotesTool } from "../tools/slides-notes.js";
import { createSlidesReplaceTextTool } from "../tools/slides-replace-text.js";
import { createYouTubeSearchTool, createYouTubeVideoDetailsTool } from "../tools/youtube-search.js";
import {
  createYouTubeChannelInfoTool,
  createYouTubeVideoCommentsTool,
} from "../tools/youtube-social.js";
import { createYouTubeDownloadThumbnailTool } from "../tools/youtube-download-thumbnail.js";
import {
  createYouTubePlaylistsListTool,
  createYouTubePlaylistItemsTool,
  createYouTubePlaylistCreateTool,
} from "../tools/youtube-playlists.js";
import { createYouTubeTranscriptTool } from "../tools/youtube-transcript.js";
import { createScheduleListTool } from "../tools/schedule-list.js";
import { createScheduleCreateTool } from "../tools/schedule-create.js";
import { createScheduleGetTool } from "../tools/schedule-get.js";
import { createScheduleUpdateTool } from "../tools/schedule-update.js";
import { createScheduleDeleteTool } from "../tools/schedule-delete.js";
import { createSoulReadTool } from "../tools/soul-read.js";
import { createSoulWriteTool } from "../tools/soul-write.js";
import { createViewAttachmentTool } from "../tools/attachment-view.js";
import { ScheduleStore } from "../scheduler/schedule-store.js";
import { loadAgentConfigs } from "./agent-config.js";
import { GitHubClientManager } from "../auth/github-client-manager.js";
import { ApiKeyStore } from "../auth/api-key-store.js";
import { GeminiClientManager } from "../auth/gemini-client-manager.js";
import { WolframClientManager } from "../auth/wolfram-client-manager.js";
import { createGeminiAuthSetupTool } from "../tools/gemini-auth.js";
import {
  createGeminiGenerateImageTool,
  createGeminiImagenTool,
} from "../tools/gemini-generate-image.js";
import { createGeminiGenerateVideoTool } from "../tools/gemini-generate-video.js";
import { createGitHubAuthSetupTool } from "../tools/github-auth.js";
import {
  createGitHubRepoListTool,
  createGitHubRepoGetTool,
  createGitHubRepoCreateTool,
  createGitHubRepoUpdateTool,
  createGitHubRepoDeleteTool,
  createGitHubRepoForkTool,
  createGitHubRepoStarTool,
  createGitHubRepoUnstarTool,
  createGitHubRepoContentGetTool,
  createGitHubRepoContentCreateTool,
  createGitHubRepoContentDeleteTool,
  createGitHubRepoTopicsTool,
  createGitHubRepoContributorsTool,
  createGitHubRepoLanguagesTool,
} from "../tools/github-repos.js";
import {
  createGitHubIssueListTool,
  createGitHubIssueGetTool,
  createGitHubIssueCreateTool,
  createGitHubIssueUpdateTool,
  createGitHubIssueCommentListTool,
  createGitHubIssueCommentCreateTool,
  createGitHubIssueCommentUpdateTool,
  createGitHubIssueCommentDeleteTool,
  createGitHubIssueLabelListTool,
  createGitHubIssueLabelCreateTool,
  createGitHubIssueMilestoneListTool,
  createGitHubIssueMilestoneCreateTool,
} from "../tools/github-issues.js";
import {
  createGitHubPullListTool,
  createGitHubPullGetTool,
  createGitHubPullCreateTool,
  createGitHubPullUpdateTool,
  createGitHubPullMergeTool,
  createGitHubPullFilesTool,
  createGitHubPullDiffTool,
  createGitHubPullReviewListTool,
  createGitHubPullReviewCreateTool,
  createGitHubPullReviewCommentsTool,
  createGitHubPullRequestReviewersTool,
  createGitHubPullChecksTool,
} from "../tools/github-pulls.js";
import {
  createGitHubBranchListTool,
  createGitHubBranchGetTool,
  createGitHubBranchCreateTool,
  createGitHubBranchDeleteTool,
  createGitHubBranchProtectionGetTool,
  createGitHubTagListTool,
  createGitHubReleaseListTool,
  createGitHubReleaseGetTool,
  createGitHubReleaseCreateTool,
  createGitHubReleaseDeleteTool,
} from "../tools/github-branches.js";
import {
  createGitHubCommitListTool,
  createGitHubCommitGetTool,
  createGitHubCompareTool,
  createGitHubRefListTool,
  createGitHubTreeGetTool,
} from "../tools/github-git.js";
import {
  createGitHubWorkflowListTool,
  createGitHubWorkflowGetTool,
  createGitHubWorkflowDispatchTool,
  createGitHubRunListTool,
  createGitHubRunGetTool,
  createGitHubRunCancelTool,
  createGitHubRunRerunTool,
  createGitHubJobListTool,
  createGitHubRunLogsTool,
} from "../tools/github-actions.js";
import {
  createGitHubSearchReposTool,
  createGitHubSearchCodeTool,
  createGitHubSearchIssuesTool,
  createGitHubSearchCommitsTool,
  createGitHubSearchUsersTool,
} from "../tools/github-search.js";
import {
  createGitHubUserGetTool,
  createGitHubUserReposTool,
  createGitHubOrgGetTool,
  createGitHubOrgMembersTool,
  createGitHubOrgReposTool,
  createGitHubTeamListTool,
} from "../tools/github-users.js";
import {
  createGitHubUserUpdateTool,
  createGitHubUserFollowersListTool,
  createGitHubUserFollowingListTool,
  createGitHubUserFollowTool,
  createGitHubUserUnfollowTool,
  createGitHubUserEventsListTool,
  createGitHubRepoTopicsReplaceTool,
} from "../tools/github-profile.js";
import {
  createGitHubGistListTool,
  createGitHubGistGetTool,
  createGitHubGistCreateTool,
  createGitHubGistUpdateTool,
  createGitHubGistDeleteTool,
} from "../tools/github-gists.js";
import {
  createGitHubNotificationListTool,
  createGitHubNotificationMarkReadTool,
  createGitHubNotificationThreadReadTool,
  createGitHubNotificationThreadSubscribeTool,
} from "../tools/github-notifications.js";
import {
  createGitHubProjectListTool,
  createGitHubProjectGetTool,
  createGitHubProjectColumnsTool,
  createGitHubProjectCardsTool,
} from "../tools/github-projects.js";
import {
  createGitHubWebhookListTool,
  createGitHubWebhookCreateTool,
  createGitHubWebhookUpdateTool,
  createGitHubWebhookDeleteTool,
} from "../tools/github-webhooks.js";
import {
  createGitHubDependabotAlertsTool,
  createGitHubCodeScanningAlertsTool,
  createGitHubSecretScanningAlertsTool,
  createGitHubSecurityAdvisoriesTool,
} from "../tools/github-security.js";
import { createWolframQueryTool, createWolframQueryFullTool } from "../tools/wolfram-query.js";
import { SessionStore } from "../auth/session-store.js";
import { LinkedinClientManager } from "../auth/linkedin-client-manager.js";
import { createLinkedinAuthSetupTool } from "../tools/linkedin-auth.js";
import {
  createLinkedinProfileGetTool,
  createLinkedinProfileViewTool,
} from "../tools/linkedin-profile.js";
import { createLinkedinConnectionsListTool } from "../tools/linkedin-connections.js";
import { createLinkedinSearchPeopleTool } from "../tools/linkedin-search.js";
import {
  createLinkedinPostListTool,
  createLinkedinPostCreateTool,
  createLinkedinPostLikeTool,
  createLinkedinPostCommentTool,
} from "../tools/linkedin-posts.js";
import {
  createLinkedinMessagesListTool,
  createLinkedinMessagesSendTool,
} from "../tools/linkedin-messages.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface OmniclawTool {
  name: string;
  label: string;
  description: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  parameters: any;
  execute: (toolCallId: string, params: Record<string, unknown>) => Promise<unknown>;
}

export function createAllTools(opts: { pluginConfig: PluginConfig }): OmniclawTool[] {
  const config = opts.pluginConfig;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tools: OmniclawTool[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const add = (t: any) => tools.push(t as OmniclawTool);

  // YouTube tools — no OAuth required
  add(createYouTubeTranscriptTool());
  add(createYouTubeDownloadThumbnailTool());

  // Schedule tools — no OAuth required
  const scheduleStore = new ScheduleStore(config.schedules_path);
  const agentConfigs = loadAgentConfigs().agents;
  add(createScheduleListTool(scheduleStore));
  add(createScheduleCreateTool(scheduleStore, agentConfigs));
  add(createScheduleGetTool(scheduleStore, agentConfigs));
  add(createScheduleUpdateTool(scheduleStore, agentConfigs));
  add(createScheduleDeleteTool(scheduleStore));

  // Soul tools — always available (in GLOBAL_TOOLS)
  add(createSoulReadTool(agentConfigs));
  add(createSoulWriteTool(agentConfigs));

  // Attachment viewing tool — always available
  add(createViewAttachmentTool());

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
    add(createGmailDraftListTool(clientManager));
    add(createGmailDraftCreateTool(clientManager));
    add(createGmailDraftUpdateTool(clientManager));
    add(createGmailDraftDeleteTool(clientManager));
    add(createGmailDraftSendTool(clientManager));
    add(createGmailLabelsListTool(clientManager));
    add(createGmailLabelCreateTool(clientManager));
    add(createGmailLabelDeleteTool(clientManager));
    add(createGmailThreadListTool(clientManager));
    add(createGmailThreadGetTool(clientManager));

    add(createCalendarAuthTool(clientManager, config));
    add(createCalendarListCalendarsTool(clientManager));
    add(createCalendarEventsTool(clientManager));
    add(createCalendarGetTool(clientManager));
    add(createCalendarCreateTool(clientManager));
    add(createCalendarUpdateTool(clientManager));
    add(createCalendarDeleteTool(clientManager));
    add(createCalendarRespondTool(clientManager));
    add(createCalendarSearchTool(clientManager));
    add(createCalendarFreeBusyTool(clientManager));
    add(createCalendarQuickAddTool(clientManager));

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
    add(createDriveCopyTool(clientManager));
    add(createDriveRestoreTool(clientManager));
    add(createDrivePermissionsListTool(clientManager));
    add(createDrivePermissionsDeleteTool(clientManager));

    add(createDocsAuthTool(clientManager, config));
    add(createDocsCreateTool(clientManager));
    add(createDocsGetTool(clientManager));
    add(createDocsAppendTool(clientManager));
    add(createDocsReplaceTextTool(clientManager));
    add(createDocsExportTool(clientManager));
    add(createDocsInsertTool(clientManager));
    add(createDocsDeleteTextTool(clientManager));

    add(createSlidesAuthTool(clientManager, config));
    add(createSlidesCreateTool(clientManager));
    add(createSlidesGetTool(clientManager));
    add(createSlidesAppendSlideTool(clientManager));
    add(createSlidesReplaceTextTool(clientManager));
    add(createSlidesExportTool(clientManager));
    add(createSlidesDeleteSlideTool(clientManager));
    add(createSlidesDuplicateSlideTool(clientManager));
    add(createSlidesWriteNotesTool(clientManager));

    add(createSheetsAuthTool(clientManager, config));
    add(createSheetsCreateTool(clientManager));
    add(createSheetsGetTool(clientManager));
    add(createSheetsUpdateTool(clientManager));
    add(createSheetsAppendTool(clientManager));
    add(createSheetsClearTool(clientManager));
    add(createSheetsExportTool(clientManager));
    add(createSheetsInfoTool(clientManager));
    add(createSheetsAddSheetTool(clientManager));
    add(createSheetsDeleteSheetTool(clientManager));
    add(createSheetsRenameSheetTool(clientManager));

    add(createYouTubeAuthTool(clientManager, config));
    add(createYouTubeSearchTool(clientManager));
    add(createYouTubeVideoDetailsTool(clientManager));
    add(createYouTubeChannelInfoTool(clientManager));
    add(createYouTubeVideoCommentsTool(clientManager));
    add(createYouTubePlaylistsListTool(clientManager));
    add(createYouTubePlaylistItemsTool(clientManager));
    add(createYouTubePlaylistCreateTool(clientManager));
  }

  // GitHub tools — gated on github_token being configured
  {
    const githubStore = new ApiKeyStore(
      config.github_tokens_path ?? path.join(os.homedir(), ".openclaw", "github-keys.json"),
    );
    githubStore.migrateFromConfig(config.github_token);
    const gh = new GitHubClientManager(githubStore);

    add(createGitHubAuthSetupTool(gh));

    // Repos
    add(createGitHubRepoListTool(gh));
    add(createGitHubRepoGetTool(gh));
    add(createGitHubRepoCreateTool(gh));
    add(createGitHubRepoUpdateTool(gh));
    add(createGitHubRepoDeleteTool(gh));
    add(createGitHubRepoForkTool(gh));
    add(createGitHubRepoStarTool(gh));
    add(createGitHubRepoUnstarTool(gh));
    add(createGitHubRepoContentGetTool(gh));
    add(createGitHubRepoContentCreateTool(gh));
    add(createGitHubRepoContentDeleteTool(gh));
    add(createGitHubRepoTopicsTool(gh));
    add(createGitHubRepoTopicsReplaceTool(gh));
    add(createGitHubRepoContributorsTool(gh));
    add(createGitHubRepoLanguagesTool(gh));

    // Issues
    add(createGitHubIssueListTool(gh));
    add(createGitHubIssueGetTool(gh));
    add(createGitHubIssueCreateTool(gh));
    add(createGitHubIssueUpdateTool(gh));
    add(createGitHubIssueCommentListTool(gh));
    add(createGitHubIssueCommentCreateTool(gh));
    add(createGitHubIssueCommentUpdateTool(gh));
    add(createGitHubIssueCommentDeleteTool(gh));
    add(createGitHubIssueLabelListTool(gh));
    add(createGitHubIssueLabelCreateTool(gh));
    add(createGitHubIssueMilestoneListTool(gh));
    add(createGitHubIssueMilestoneCreateTool(gh));

    // Pull Requests
    add(createGitHubPullListTool(gh));
    add(createGitHubPullGetTool(gh));
    add(createGitHubPullCreateTool(gh));
    add(createGitHubPullUpdateTool(gh));
    add(createGitHubPullMergeTool(gh));
    add(createGitHubPullFilesTool(gh));
    add(createGitHubPullDiffTool(gh));
    add(createGitHubPullReviewListTool(gh));
    add(createGitHubPullReviewCreateTool(gh));
    add(createGitHubPullReviewCommentsTool(gh));
    add(createGitHubPullRequestReviewersTool(gh));
    add(createGitHubPullChecksTool(gh));

    // Branches, Tags, Releases
    add(createGitHubBranchListTool(gh));
    add(createGitHubBranchGetTool(gh));
    add(createGitHubBranchCreateTool(gh));
    add(createGitHubBranchDeleteTool(gh));
    add(createGitHubBranchProtectionGetTool(gh));
    add(createGitHubTagListTool(gh));
    add(createGitHubReleaseListTool(gh));
    add(createGitHubReleaseGetTool(gh));
    add(createGitHubReleaseCreateTool(gh));
    add(createGitHubReleaseDeleteTool(gh));

    // Git (commits, compare, refs, trees)
    add(createGitHubCommitListTool(gh));
    add(createGitHubCommitGetTool(gh));
    add(createGitHubCompareTool(gh));
    add(createGitHubRefListTool(gh));
    add(createGitHubTreeGetTool(gh));

    // Actions
    add(createGitHubWorkflowListTool(gh));
    add(createGitHubWorkflowGetTool(gh));
    add(createGitHubWorkflowDispatchTool(gh));
    add(createGitHubRunListTool(gh));
    add(createGitHubRunGetTool(gh));
    add(createGitHubRunCancelTool(gh));
    add(createGitHubRunRerunTool(gh));
    add(createGitHubJobListTool(gh));
    add(createGitHubRunLogsTool(gh));

    // Search
    add(createGitHubSearchReposTool(gh));
    add(createGitHubSearchCodeTool(gh));
    add(createGitHubSearchIssuesTool(gh));
    add(createGitHubSearchCommitsTool(gh));
    add(createGitHubSearchUsersTool(gh));

    // Users & Orgs
    add(createGitHubUserGetTool(gh));
    add(createGitHubUserReposTool(gh));
    add(createGitHubOrgGetTool(gh));
    add(createGitHubOrgMembersTool(gh));
    add(createGitHubOrgReposTool(gh));
    add(createGitHubTeamListTool(gh));
    add(createGitHubUserUpdateTool(gh));
    add(createGitHubUserFollowersListTool(gh));
    add(createGitHubUserFollowingListTool(gh));
    add(createGitHubUserFollowTool(gh));
    add(createGitHubUserUnfollowTool(gh));
    add(createGitHubUserEventsListTool(gh));

    // Gists
    add(createGitHubGistListTool(gh));
    add(createGitHubGistGetTool(gh));
    add(createGitHubGistCreateTool(gh));
    add(createGitHubGistUpdateTool(gh));
    add(createGitHubGistDeleteTool(gh));

    // Notifications
    add(createGitHubNotificationListTool(gh));
    add(createGitHubNotificationMarkReadTool(gh));
    add(createGitHubNotificationThreadReadTool(gh));
    add(createGitHubNotificationThreadSubscribeTool(gh));

    // Projects
    add(createGitHubProjectListTool(gh));
    add(createGitHubProjectGetTool(gh));
    add(createGitHubProjectColumnsTool(gh));
    add(createGitHubProjectCardsTool(gh));

    // Webhooks
    add(createGitHubWebhookListTool(gh));
    add(createGitHubWebhookCreateTool(gh));
    add(createGitHubWebhookUpdateTool(gh));
    add(createGitHubWebhookDeleteTool(gh));

    // Security
    add(createGitHubDependabotAlertsTool(gh));
    add(createGitHubCodeScanningAlertsTool(gh));
    add(createGitHubSecretScanningAlertsTool(gh));
    add(createGitHubSecurityAdvisoriesTool(gh));
  }

  // Gemini tools — API key auth
  {
    const geminiStore = new ApiKeyStore(
      config.gemini_tokens_path ?? path.join(os.homedir(), ".openclaw", "gemini-keys.json"),
    );
    geminiStore.migrateFromConfig(config.gemini_api_key);
    const geminiManager = new GeminiClientManager(geminiStore);

    add(createGeminiAuthSetupTool(geminiManager));
    add(createGeminiGenerateImageTool(geminiManager));
    add(createGeminiImagenTool(geminiManager));
    add(createGeminiGenerateVideoTool(geminiManager));
  }

  // Wolfram Alpha tools
  {
    const wolframStore = new ApiKeyStore(
      config.wolfram_tokens_path ?? path.join(os.homedir(), ".openclaw", "wolfram-keys.json"),
    );
    wolframStore.migrateFromConfig(config.wolfram_appid);
    const wolframManager = new WolframClientManager(wolframStore);

    add(createWolframQueryTool(wolframManager));
    add(createWolframQueryFullTool(wolframManager));
  }

  // LinkedIn tools — session cookie auth
  {
    const sessionsPath = path.join(os.homedir(), ".openclaw", "linkedin-sessions.json");
    const linkedinSessionStore = new SessionStore(sessionsPath);
    const linkedinManager = new LinkedinClientManager(linkedinSessionStore);

    add(createLinkedinAuthSetupTool(linkedinManager));
    add(createLinkedinProfileGetTool(linkedinManager));
    add(createLinkedinProfileViewTool(linkedinManager));
    add(createLinkedinConnectionsListTool(linkedinManager));
    add(createLinkedinSearchPeopleTool(linkedinManager));
    add(createLinkedinPostListTool(linkedinManager));
    add(createLinkedinPostCreateTool(linkedinManager));
    add(createLinkedinPostLikeTool(linkedinManager));
    add(createLinkedinPostCommentTool(linkedinManager));
    add(createLinkedinMessagesListTool(linkedinManager));
    add(createLinkedinMessagesSendTool(linkedinManager));
  }

  return tools;
}
