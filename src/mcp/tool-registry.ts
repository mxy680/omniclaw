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
