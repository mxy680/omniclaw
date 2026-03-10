export interface TestStepResult {
  name: string;
  tool: string;
  status: "success" | "error" | "skipped";
  duration: number;
  error?: string;
  cleanup?: boolean;
}

export interface ServiceTestResult {
  service: string;
  steps: TestStepResult[];
  totalDuration: number;
}

type ExecuteFn = (tool: string, params: Record<string, unknown>) => Promise<unknown>;

async function runStep(
  name: string,
  tool: string,
  params: Record<string, unknown>,
  execute: ExecuteFn,
  cleanup = false,
): Promise<{ result: TestStepResult; data?: unknown }> {
  const start = Date.now();
  try {
    const data = await execute(tool, params);
    const parsed = extractResult(data);
    const errorField = parsed && typeof parsed === "object" && "error" in parsed
      ? (parsed as Record<string, unknown>).error : undefined;
    if (typeof errorField === "string") {
      const status = errorField === "auth_required" ? "skipped" as const : "error" as const;
      const message = (parsed as Record<string, unknown>).action ?? (parsed as Record<string, unknown>).message ?? errorField;
      return {
        result: { name, tool, status, duration: Date.now() - start, error: String(message), cleanup },
        data,
      };
    }
    return {
      result: { name, tool, status: "success", duration: Date.now() - start, cleanup },
      data,
    };
  } catch (err) {
    return {
      result: {
        name,
        tool,
        status: "error",
        duration: Date.now() - start,
        error: err instanceof Error ? err.message : String(err),
        cleanup,
      },
    };
  }
}

// Extract text content from MCP tool responses
// Tools return { content: [{ type: "text", text: "..." }] }
function extractResult(data: unknown): unknown {
  if (!data || typeof data !== "object") return data;
  const obj = data as Record<string, unknown>;
  if (Array.isArray(obj.content)) {
    const textItem = obj.content.find(
      (c: unknown) => typeof c === "object" && c !== null && (c as Record<string, unknown>).type === "text",
    ) as Record<string, unknown> | undefined;
    if (textItem?.text && typeof textItem.text === "string") {
      try { return JSON.parse(textItem.text); } catch { return textItem.text; }
    }
  }
  return data;
}

type ServiceTestFn = (execute: ExecuteFn) => Promise<TestStepResult[]>;

const gmailTest: ServiceTestFn = async (execute) => {
  const steps: TestStepResult[] = [];

  const s1 = await runStep("List accounts", "gmail_accounts", {}, execute);
  steps.push(s1.result);

  const s2 = await runStep("List inbox", "gmail_inbox", { max_results: 2 }, execute);
  steps.push(s2.result);

  const s3 = await runStep("Search messages", "gmail_search", { query: "in:inbox", max_results: 1 }, execute);
  steps.push(s3.result);

  // List labels
  const s4 = await runStep("List labels", "gmail_labels_list", {}, execute);
  steps.push(s4.result);

  // List threads
  const s5 = await runStep("List threads", "gmail_thread_list", { max_results: 1 }, execute);
  steps.push(s5.result);

  // Get a thread using first thread ID from thread_list result
  const threadListParsed = extractResult(s5.data) as { id?: string }[] | undefined;
  const firstThreadId = Array.isArray(threadListParsed) && threadListParsed.length > 0
    ? threadListParsed[0].id : undefined;

  if (firstThreadId) {
    const s5b = await runStep("Get thread", "gmail_thread_get", { thread_id: firstThreadId }, execute);
    steps.push(s5b.result);
  }

  // Get a message using first message ID from inbox result
  const inboxParsed = extractResult(s2.data) as { id?: string }[] | undefined;
  const firstMessageId = Array.isArray(inboxParsed) && inboxParsed.length > 0
    ? inboxParsed[0].id : undefined;

  if (firstMessageId) {
    const s5c = await runStep("Get message", "gmail_get", { id: firstMessageId }, execute);
    steps.push(s5c.result);
  }

  // Round-trip: create draft → list drafts → update draft → delete draft
  const s6 = await runStep("Create test draft", "gmail_draft_create", {
    to: "test@example.com",
    subject: "Omniclaw Smoke Test Draft",
    body: "This draft will be deleted immediately.",
  }, execute);
  steps.push(s6.result);

  const draftParsed = extractResult(s6.data) as Record<string, unknown> | undefined;
  const draftId = draftParsed?.id as string | undefined;

  const s6b = await runStep("List drafts", "gmail_draft_list", { max_results: 5 }, execute);
  steps.push(s6b.result);

  if (draftId) {
    const s6c = await runStep("Update test draft", "gmail_draft_update", {
      draft_id: draftId,
      subject: "Updated Omniclaw Smoke Test Draft",
    }, execute);
    steps.push(s6c.result);

    const s7 = await runStep("Delete test draft", "gmail_draft_delete", { draft_id: draftId }, execute, true);
    steps.push(s7.result);
  }

  // Label round-trip: create → delete
  const s8 = await runStep("Create label", "gmail_label_create", { name: "omniclaw-smoke-test" }, execute);
  steps.push(s8.result);

  const labelParsed = extractResult(s8.data) as Record<string, unknown> | undefined;
  const labelId = labelParsed?.id as string | undefined;

  if (labelId) {
    const s9 = await runStep("Delete label", "gmail_label_delete", { label_id: labelId }, execute, true);
    steps.push(s9.result);
  }

  // Send + reply + forward + modify chain
  const s10 = await runStep("Send email", "gmail_send", {
    to: "omniclaw680@gmail.com",
    subject: "Omniclaw Smoke Test",
    body: "Smoke test email.",
  }, execute);
  steps.push(s10.result);

  const sentParsed = extractResult(s10.data) as Record<string, unknown> | undefined;
  const sentMsgId = sentParsed?.id as string | undefined;

  if (sentMsgId) {
    const s11 = await runStep("Reply to email", "gmail_reply", {
      id: sentMsgId,
      body: "Smoke test reply.",
    }, execute);
    steps.push(s11.result);

    const s12 = await runStep("Forward email", "gmail_forward", {
      id: sentMsgId,
      to: "omniclaw680@gmail.com",
    }, execute);
    steps.push(s12.result);

    const s13 = await runStep("Modify message labels", "gmail_modify", {
      message_id: sentMsgId,
      add_labels: ["UNREAD"],
    }, execute);
    steps.push(s13.result);
  }

  return steps;
};

const calendarTest: ServiceTestFn = async (execute) => {
  const steps: TestStepResult[] = [];

  const s1 = await runStep("List calendars", "calendar_list_calendars", {}, execute);
  steps.push(s1.result);

  const s2 = await runStep("List events", "calendar_events", { max_results: 2 }, execute);
  steps.push(s2.result);

  // Search events
  const s2b = await runStep("Search events", "calendar_search", { query: "test", max_results: 1 }, execute);
  steps.push(s2b.result);

  // Check free/busy
  const fbStart = new Date().toISOString();
  const fbEnd = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const s2c = await runStep("Check free/busy", "calendar_freebusy", {
    time_min: fbStart,
    time_max: fbEnd,
  }, execute);
  steps.push(s2c.result);

  // Round-trip: create → get → delete
  const now = new Date();
  const start = new Date(now.getTime() + 60 * 60 * 1000).toISOString();
  const end = new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString();

  const s3 = await runStep("Create test event", "calendar_create", {
    summary: "Omniclaw Smoke Test",
    start,
    end,
  }, execute);
  steps.push(s3.result);

  const parsed = extractResult(s3.data) as Record<string, unknown> | undefined;
  const eventId = parsed?.id as string | undefined;

  if (eventId) {
    const s4 = await runStep("Get test event", "calendar_get", { event_id: eventId }, execute);
    steps.push(s4.result);

    const s4b = await runStep("Update test event", "calendar_update", {
      event_id: eventId,
      summary: "Updated Smoke Test",
    }, execute);
    steps.push(s4b.result);

    const s5 = await runStep("Delete test event", "calendar_delete", { event_id: eventId }, execute, true);
    steps.push(s5.result);
  }

  // Quick add → delete
  const s6 = await runStep("Quick add event", "calendar_quick_add", {
    text: "Omniclaw smoke test tomorrow at 9am",
  }, execute);
  steps.push(s6.result);

  const quickParsed = extractResult(s6.data) as Record<string, unknown> | undefined;
  const quickEventId = quickParsed?.id as string | undefined;

  if (quickEventId) {
    const s7 = await runStep("Delete quick-add event", "calendar_delete", { event_id: quickEventId }, execute, true);
    steps.push(s7.result);
  }

  return steps;
};

const driveTest: ServiceTestFn = async (execute) => {
  const steps: TestStepResult[] = [];

  const s1 = await runStep("List files", "drive_list", { max_results: 2 }, execute);
  steps.push(s1.result);

  const s1b = await runStep("Search files", "drive_search", {
    query: "mimeType != 'application/vnd.google-apps.folder'",
    max_results: 1,
  }, execute);
  steps.push(s1b.result);

  // Round-trip: create folder → copy → list permissions → delete both
  const folderName = `omniclaw-smoke-test-${Date.now()}`;
  const s2 = await runStep("Create test folder", "drive_create_folder", { name: folderName }, execute);
  steps.push(s2.result);

  const parsed = extractResult(s2.data) as Record<string, unknown> | undefined;
  const folderId = parsed?.id as string | undefined;

  if (folderId) {
    // Get folder metadata
    const s3 = await runStep("Get file metadata", "drive_get", { file_id: folderId }, execute);
    steps.push(s3.result);

    // List permissions on the folder
    const s4 = await runStep("List permissions", "drive_permissions_list", { file_id: folderId }, execute);
    steps.push(s4.result);

    // Upload a test file into the folder
    const s5 = await runStep("Upload test file", "drive_upload", {
      name: "smoke-test.txt",
      content: "Smoke test content",
      mime_type: "text/plain",
      parent_id: folderId,
    }, execute);
    steps.push(s5.result);

    const uploadParsed = extractResult(s5.data) as Record<string, unknown> | undefined;
    const fileId = uploadParsed?.id as string | undefined;

    if (fileId) {
      const s6 = await runStep("Read file content", "drive_read", { file_id: fileId }, execute);
      steps.push(s6.result);

      const s7 = await runStep("Download file", "drive_download", {
        file_id: fileId,
        save_dir: "/tmp/omniclaw-smoke-drive",
      }, execute);
      steps.push(s7.result);

      const s8 = await runStep("Copy file", "drive_copy", {
        file_id: fileId,
        name: "smoke-test-copy.txt",
      }, execute);
      steps.push(s8.result);

      const copyParsed = extractResult(s8.data) as Record<string, unknown> | undefined;
      const copyId = copyParsed?.id as string | undefined;

      if (copyId) {
        const s9 = await runStep("Move copy into folder", "drive_move", {
          file_id: copyId,
          new_parent_id: folderId,
        }, execute);
        steps.push(s9.result);
      }

      const s10 = await runStep("Share file", "drive_share", {
        file_id: fileId,
        email: "omniclaw680@gmail.com",
        role: "reader",
      }, execute);
      steps.push(s10.result);

      const shareParsed = extractResult(s10.data) as Record<string, unknown> | undefined;
      const permissionId = shareParsed?.id as string | undefined;

      if (permissionId) {
        const s11 = await runStep("Delete sharing permission", "drive_permissions_delete", {
          file_id: fileId,
          permission_id: permissionId,
        }, execute, true);
        steps.push(s11.result);
      }
    }

    const s12 = await runStep("Delete test folder", "drive_delete", { file_id: folderId, permanent: true }, execute, true);
    steps.push(s12.result);
  }

  return steps;
};

const docsTest: ServiceTestFn = async (execute) => {
  const steps: TestStepResult[] = [];

  // Round-trip: create → append → insert → get (markdown) → delete via Drive
  const s1 = await runStep("Create test document", "docs_create", {
    title: "Omniclaw Smoke Test",
    content: "Initial content.",
  }, execute);
  steps.push(s1.result);

  const parsed = extractResult(s1.data) as Record<string, unknown> | undefined;
  const docId = parsed?.id as string | undefined;

  if (docId) {
    const s2 = await runStep("Append text", "docs_append", {
      document_id: docId,
      text: " Appended text.",
    }, execute);
    steps.push(s2.result);

    const s3 = await runStep("Get document (markdown)", "docs_get", {
      document_id: docId,
      format: "markdown",
    }, execute);
    steps.push(s3.result);

    const s4 = await runStep("Replace text", "docs_replace_text", {
      document_id: docId,
      find: "Appended text",
      replace: "Replaced text",
    }, execute);
    steps.push(s4.result);

    const s5a = await runStep("Insert text", "docs_insert", {
      document_id: docId,
      text: "Inserted text. ",
      index: 1,
    }, execute);
    steps.push(s5a.result);

    const s5b = await runStep("Delete text range", "docs_delete_text", {
      document_id: docId,
      start_index: 1,
      end_index: 16,
    }, execute);
    steps.push(s5b.result);

    const s5c = await runStep("Export document", "docs_export", {
      document_id: docId,
      format: "pdf",
      save_dir: "/tmp/omniclaw-smoke-docs",
    }, execute);
    steps.push(s5c.result);

    const s5 = await runStep("Delete test document", "drive_delete", { file_id: docId, permanent: true }, execute, true);
    steps.push(s5.result);
  }

  return steps;
};

const sheetsTest: ServiceTestFn = async (execute) => {
  const steps: TestStepResult[] = [];

  const s1 = await runStep("Create test spreadsheet", "sheets_create", { title: "Omniclaw Smoke Test" }, execute);
  steps.push(s1.result);

  const parsed = extractResult(s1.data) as Record<string, unknown> | undefined;
  const sheetId = parsed?.id as string | undefined;

  if (sheetId) {
    // Get spreadsheet info (sheets/tabs metadata)
    const s1b = await runStep("Get spreadsheet info", "sheets_info", { spreadsheet_id: sheetId }, execute);
    steps.push(s1b.result);

    // Write some data
    const s2 = await runStep("Update cells", "sheets_update", {
      spreadsheet_id: sheetId,
      range: "Sheet1!A1:B2",
      values: [["smoke", "test"], ["pass", "ok"]],
    }, execute);
    steps.push(s2.result);

    // Append rows after update
    const s2b = await runStep("Append rows", "sheets_append", {
      spreadsheet_id: sheetId,
      range: "Sheet1!A1",
      values: [["appended", "data"]],
    }, execute);
    steps.push(s2b.result);

    // Read it back
    const s3 = await runStep("Get test spreadsheet", "sheets_get", { spreadsheet_id: sheetId, range: "Sheet1!A1:B2" }, execute);
    steps.push(s3.result);

    // Clear a range after get
    const s3b = await runStep("Clear range", "sheets_clear", {
      spreadsheet_id: sheetId,
      range: "Sheet1!A1:B2",
    }, execute);
    steps.push(s3b.result);

    // Add a new sheet tab
    const s4 = await runStep("Add sheet tab", "sheets_add_sheet", {
      spreadsheet_id: sheetId,
      title: "SmokeTab",
    }, execute);
    steps.push(s4.result);

    // Rename the added sheet tab, then delete it
    const tabParsed = extractResult(s4.data) as Record<string, unknown> | undefined;
    const tabSheetId = tabParsed?.sheetId as number | undefined;

    if (tabSheetId !== undefined) {
      const s4b = await runStep("Rename sheet tab", "sheets_rename_sheet", {
        spreadsheet_id: sheetId,
        sheet_id: tabSheetId,
        title: "RenamedTab",
      }, execute);
      steps.push(s4b.result);

      const s5 = await runStep("Delete sheet tab", "sheets_delete_sheet", {
        spreadsheet_id: sheetId,
        sheet_id: tabSheetId,
      }, execute, true);
      steps.push(s5.result);
    }

    // Export spreadsheet before deleting
    const s5b = await runStep("Export spreadsheet", "sheets_export", {
      spreadsheet_id: sheetId,
      format: "csv",
      save_dir: "/tmp/omniclaw-smoke-sheets",
    }, execute);
    steps.push(s5b.result);

    const s6 = await runStep("Delete test spreadsheet", "drive_delete", { file_id: sheetId, permanent: true }, execute, true);
    steps.push(s6.result);
  }

  return steps;
};

const slidesTest: ServiceTestFn = async (execute) => {
  const steps: TestStepResult[] = [];

  const s1 = await runStep("Create test presentation", "slides_create", { title: "Omniclaw Smoke Test" }, execute);
  steps.push(s1.result);

  const parsed = extractResult(s1.data) as Record<string, unknown> | undefined;
  const presId = parsed?.id as string | undefined;

  if (presId) {
    // Append a slide with specific layout
    const s2 = await runStep("Append slide", "slides_append_slide", {
      presentation_id: presId,
      title: "Test Slide",
      body: "Smoke test body text.",
      layout: "TITLE_AND_BODY",
    }, execute);
    steps.push(s2.result);

    // Replace text in the presentation
    const s2b = await runStep("Replace text", "slides_replace_text", {
      presentation_id: presId,
      find: "Test Slide",
      replace: "Replaced Slide",
    }, execute);
    steps.push(s2b.result);

    // Get presentation with enhanced output (tables, images)
    const s3 = await runStep("Get presentation", "slides_get", { presentation_id: presId }, execute);
    steps.push(s3.result);

    // Extract a slide objectId for notes and duplication
    const getParsed = extractResult(s3.data) as Record<string, unknown> | undefined;
    const slides = (getParsed as { slides?: { objectId?: string }[] })?.slides;
    const slideObjectId = slides?.[0]?.objectId;

    if (slideObjectId) {
      // Write speaker notes
      const s4 = await runStep("Write speaker notes", "slides_write_notes", {
        presentation_id: presId,
        slide_id: slideObjectId,
        notes: "These are smoke test speaker notes.",
      }, execute);
      steps.push(s4.result);

      // Duplicate the slide
      const s5 = await runStep("Duplicate slide", "slides_duplicate_slide", {
        presentation_id: presId,
        slide_id: slideObjectId,
      }, execute);
      steps.push(s5.result);

      // Delete the duplicated slide
      const dupParsed = extractResult(s5.data) as Record<string, unknown> | undefined;
      const dupSlideId = dupParsed?.newSlideId as string | undefined;

      if (dupSlideId) {
        const s6 = await runStep("Delete duplicated slide", "slides_delete_slide", {
          presentation_id: presId,
          slide_id: dupSlideId,
        }, execute, true);
        steps.push(s6.result);
      }
    }

    // Export presentation before deleting
    const s7a = await runStep("Export presentation", "slides_export", {
      presentation_id: presId,
      format: "pdf",
      save_dir: "/tmp/omniclaw-smoke-slides",
    }, execute);
    steps.push(s7a.result);

    const s7 = await runStep("Delete test presentation", "drive_delete", { file_id: presId, permanent: true }, execute, true);
    steps.push(s7.result);
  }

  return steps;
};

const youtubeTest: ServiceTestFn = async (execute) => {
  const steps: TestStepResult[] = [];

  const s1 = await runStep("Search videos", "youtube_search", { query: "hello world", max_results: 1 }, execute);
  steps.push(s1.result);

  const parsed = extractResult(s1.data) as Record<string, unknown> | undefined;
  const results = (parsed as { results?: { videoId?: string }[] })?.results;
  const videoId = results?.[0]?.videoId;

  if (videoId) {
    const s2 = await runStep("Get video details", "youtube_video_details", { video: videoId }, execute);
    steps.push(s2.result);

    const s4 = await runStep("Get video comments", "youtube_video_comments", { video: videoId, max_results: 2 }, execute);
    steps.push(s4.result);
  }

  // Use a known video with captions for transcript (search results may not have captions)
  const s3 = await runStep("Get transcript", "youtube_get_transcript", { video: "dQw4w9WgXcQ" }, execute);
  steps.push(s3.result);

  // Channel info
  const s5 = await runStep("Get channel info", "youtube_channel_info", { channel: "@Google" }, execute);
  steps.push(s5.result);

  // List playlists (use Google's public channel since test account may lack a channel)
  const s6 = await runStep("List playlists", "youtube_playlists_list", {
    channel_id: "UCVHFbqXqoYvEWM1Ddxl0QDg",
    max_results: 2,
  }, execute);
  steps.push(s6.result);

  // List items in a known public playlist (The Coding Train — p5.js)
  const s7 = await runStep("List playlist items", "youtube_playlist_items", {
    playlist_id: "PLRqwX-V7Uu6ZiZxtDDRCi6uhfTH4FilpH",
    max_results: 2,
  }, execute);
  steps.push(s7.result);

  // Download a video thumbnail using videoId from the search result
  if (videoId) {
    const s8 = await runStep("Download video thumbnail", "youtube_download_thumbnail", {
      video: videoId,
      save_dir: "/tmp/omniclaw-smoke-youtube",
    }, execute);
    steps.push(s8.result);
  }

  return steps;
};

const githubTest: ServiceTestFn = async (execute) => {
  const steps: TestStepResult[] = [];

  // ── Phase 1: Standalone reads (public repos/users) ──────────────────

  const rRepoList = await runStep("List repos", "github_repo_list", { per_page: 2 }, execute);
  steps.push(rRepoList.result);

  steps.push((await runStep("Get repo (octocat/Hello-World)", "github_repo_get", {
    owner: "octocat", repo: "Hello-World",
  }, execute)).result);

  steps.push((await runStep("Get repo topics", "github_repo_topics", {
    owner: "octocat", repo: "Hello-World",
  }, execute)).result);

  steps.push((await runStep("Get repo contributors", "github_repo_contributors", {
    owner: "octocat", repo: "Hello-World", per_page: 1,
  }, execute)).result);

  steps.push((await runStep("Get repo languages", "github_repo_languages", {
    owner: "octocat", repo: "Hello-World",
  }, execute)).result);

  steps.push((await runStep("Get user (octocat)", "github_user_get", { username: "octocat" }, execute)).result);

  steps.push((await runStep("List user repos", "github_user_repos", {
    username: "octocat", per_page: 1,
  }, execute)).result);

  steps.push((await runStep("Get org (github)", "github_org_get", { org: "github" }, execute)).result);

  steps.push((await runStep("List org members", "github_org_members", {
    org: "github", per_page: 1,
  }, execute)).result);

  steps.push((await runStep("List org repos", "github_org_repos", {
    org: "github", per_page: 1,
  }, execute)).result);

  // team_list requires admin on the org — test against user's own repos instead
  // We'll exercise this tool in Phase 6 on the smoke-test repo's owner org (if any)

  steps.push((await runStep("Search repos", "github_search_repos", {
    q: "typescript", per_page: 1,
  }, execute)).result);

  steps.push((await runStep("Search code", "github_search_code", {
    q: "README repo:octocat/Hello-World", per_page: 1,
  }, execute)).result);

  steps.push((await runStep("Search issues", "github_search_issues", {
    q: "is:issue repo:octocat/Hello-World", per_page: 1,
  }, execute)).result);

  steps.push((await runStep("Search commits", "github_search_commits", {
    q: "test repo:octocat/Hello-World", per_page: 1,
  }, execute)).result);

  steps.push((await runStep("Search users", "github_search_users", {
    q: "octocat", per_page: 1,
  }, execute)).result);

  // ── Phase 2: Notifications ──────────────────────────────────────────

  const rNotifs = await runStep("List notifications", "github_notification_list", { per_page: 2 }, execute);
  steps.push(rNotifs.result);

  steps.push((await runStep("Mark notifications read", "github_notification_mark_read", {
    last_read_at: new Date().toISOString(),
  }, execute)).result);

  const notifsParsed = extractResult(rNotifs.data) as { id?: string }[] | undefined;
  const threadId = Array.isArray(notifsParsed) && notifsParsed.length > 0
    ? Number(notifsParsed[0].id) : undefined;

  if (threadId) {
    steps.push((await runStep("Mark thread read", "github_notification_thread_read", {
      thread_id: threadId,
    }, execute)).result);

    steps.push((await runStep("Subscribe to thread", "github_notification_thread_subscribe", {
      thread_id: threadId, ignored: false,
    }, execute)).result);
  }

  // ── Phase 3: Gist round-trip ────────────────────────────────────────

  const rGistCreate = await runStep("Create test gist", "github_gist_create", {
    description: "[omniclaw-smoke] auto-cleanup",
    public: false,
    files: { "smoke.txt": { content: "Smoke test — will be deleted." } },
  }, execute);
  steps.push(rGistCreate.result);

  const gistParsed = extractResult(rGistCreate.data) as Record<string, unknown> | undefined;
  const gistId = gistParsed?.id as string | undefined;

  if (gistId) {
    steps.push((await runStep("Get test gist", "github_gist_get", { gist_id: gistId }, execute)).result);

    steps.push((await runStep("List gists", "github_gist_list", { per_page: 1 }, execute)).result);

    steps.push((await runStep("Update test gist", "github_gist_update", {
      gist_id: gistId, description: "[omniclaw-smoke] updated",
    }, execute)).result);

    steps.push((await runStep("Delete test gist", "github_gist_delete", { gist_id: gistId }, execute, true)).result);
  }

  // ── Phase 4: Star round-trip ────────────────────────────────────────

  steps.push((await runStep("Star repo", "github_repo_star", {
    owner: "octocat", repo: "Hello-World",
  }, execute)).result);

  steps.push((await runStep("Unstar repo", "github_repo_unstar", {
    owner: "octocat", repo: "Hello-World",
  }, execute, true)).result);

  // ── Phase 4b: User social actions ──────────────────────────────────

  steps.push((await runStep("List followers", "github_user_followers_list", { per_page: 1 }, execute)).result);

  steps.push((await runStep("List following", "github_user_following_list", { per_page: 1 }, execute)).result);

  steps.push((await runStep("List user events", "github_user_events_list", {
    username: "octocat", per_page: 1,
  }, execute)).result);

  steps.push((await runStep("Follow user", "github_user_follow", { username: "octocat" }, execute)).result);

  steps.push((await runStep("Unfollow user", "github_user_unfollow", { username: "octocat" }, execute, true)).result);

  steps.push((await runStep("Update user bio", "github_user_update", { bio: "Omniclaw smoke test bio" }, execute)).result);

  steps.push((await runStep("Restore user bio", "github_user_update", { bio: "" }, execute, true)).result);

  // ── Phase 5: Actions reads (public repo actions/checkout) ───────────

  const rWorkflows = await runStep("List workflows", "github_workflow_list", {
    owner: "actions", repo: "checkout", per_page: 5,
  }, execute);
  steps.push(rWorkflows.result);

  const wfParsed = extractResult(rWorkflows.data) as { id?: number }[] | undefined;
  const workflowId = Array.isArray(wfParsed) && wfParsed.length > 0
    ? wfParsed[0].id : undefined;

  if (workflowId) {
    steps.push((await runStep("Get workflow", "github_workflow_get", {
      owner: "actions", repo: "checkout", workflow_id: workflowId,
    }, execute)).result);
  }

  const rRuns = await runStep("List workflow runs", "github_run_list", {
    owner: "actions", repo: "checkout", per_page: 1,
  }, execute);
  steps.push(rRuns.result);

  const runsParsed = extractResult(rRuns.data) as { id?: number }[] | undefined;
  const runId = Array.isArray(runsParsed) && runsParsed.length > 0
    ? runsParsed[0].id : undefined;

  if (runId) {
    steps.push((await runStep("Get workflow run", "github_run_get", {
      owner: "actions", repo: "checkout", run_id: runId,
    }, execute)).result);

    steps.push((await runStep("List jobs for run", "github_job_list", {
      owner: "actions", repo: "checkout", run_id: runId,
    }, execute)).result);

    // run_logs, run_cancel, run_rerun, workflow_dispatch require admin on the
    // repo — they'll be tested in Phase 6 on the user's own smoke-test repo.
  }

  // ── Phase 6: Repo round-trip (create → exercise → delete) ──────────

  const repoName = `omniclaw-smoke-${Date.now()}`;
  const rRepoCreate = await runStep("Create test repo", "github_repo_create", {
    name: repoName, description: "Omniclaw smoke test", private: true, auto_init: true,
  }, execute);
  steps.push(rRepoCreate.result);

  const repoParsed = extractResult(rRepoCreate.data) as Record<string, unknown> | undefined;
  const repoFullName = repoParsed?.full_name as string | undefined;
  const owner = repoFullName?.split("/")[0];

  if (owner) {
    // --- Repo metadata ---
    steps.push((await runStep("Update repo", "github_repo_update", {
      owner, repo: repoName, description: "Smoke test — will be deleted",
    }, execute)).result);

    steps.push((await runStep("Replace repo topics", "github_repo_topics_replace", {
      owner, repo: repoName, names: ["smoke-test"],
    }, execute)).result);

    steps.push((await runStep("Get README content", "github_repo_content_get", {
      owner, repo: repoName, path: "README.md",
    }, execute)).result);

    // branch_protection_get requires GitHub Pro on private repos — skip

    // --- Labels ---
    steps.push((await runStep("Create label", "github_issue_label_create", {
      owner, repo: repoName, name: "smoke-test", color: "ff0000", description: "Smoke test label",
    }, execute)).result);

    steps.push((await runStep("List labels", "github_issue_label_list", {
      owner, repo: repoName,
    }, execute)).result);

    // --- Milestones ---
    steps.push((await runStep("Create milestone", "github_issue_milestone_create", {
      owner, repo: repoName, title: "Smoke Milestone",
    }, execute)).result);

    steps.push((await runStep("List milestones", "github_issue_milestone_list", {
      owner, repo: repoName,
    }, execute)).result);

    // --- Issues ---
    const rIssueCreate = await runStep("Create issue", "github_issue_create", {
      owner, repo: repoName, title: "Smoke test issue", body: "Auto-created by smoke test.",
    }, execute);
    steps.push(rIssueCreate.result);

    const issueParsed = extractResult(rIssueCreate.data) as Record<string, unknown> | undefined;
    const issueNumber = issueParsed?.number as number | undefined;

    if (issueNumber) {
      steps.push((await runStep("Get issue", "github_issue_get", {
        owner, repo: repoName, issue_number: issueNumber,
      }, execute)).result);

      steps.push((await runStep("List issues", "github_issue_list", {
        owner, repo: repoName, per_page: 5,
      }, execute)).result);

      steps.push((await runStep("Update issue", "github_issue_update", {
        owner, repo: repoName, issue_number: issueNumber, title: "Updated smoke issue",
      }, execute)).result);

      const rComment = await runStep("Create issue comment", "github_issue_comment_create", {
        owner, repo: repoName, issue_number: issueNumber, body: "Smoke test comment.",
      }, execute);
      steps.push(rComment.result);

      const commentParsed = extractResult(rComment.data) as Record<string, unknown> | undefined;
      const commentId = commentParsed?.id as number | undefined;

      steps.push((await runStep("List issue comments", "github_issue_comment_list", {
        owner, repo: repoName, issue_number: issueNumber,
      }, execute)).result);

      if (commentId) {
        steps.push((await runStep("Update issue comment", "github_issue_comment_update", {
          owner, repo: repoName, comment_id: commentId, body: "Updated smoke comment.",
        }, execute)).result);

        steps.push((await runStep("Delete issue comment", "github_issue_comment_delete", {
          owner, repo: repoName, comment_id: commentId,
        }, execute, true)).result);
      }
    }

    // --- Git objects ---
    const rCommits = await runStep("List commits", "github_commit_list", {
      owner, repo: repoName, per_page: 1,
    }, execute);
    steps.push(rCommits.result);

    const commitsParsed = extractResult(rCommits.data) as { sha?: string }[] | undefined;
    const commitSha = Array.isArray(commitsParsed) && commitsParsed.length > 0
      ? commitsParsed[0].sha : undefined;

    if (commitSha) {
      const rCommitGet = await runStep("Get commit", "github_commit_get", {
        owner, repo: repoName, ref: commitSha,
      }, execute);
      steps.push(rCommitGet.result);

      // Extract tree SHA from the commit for tree_get
      const commitDetail = extractResult(rCommitGet.data) as Record<string, unknown> | undefined;
      // The commit response includes files but not tree directly — use the SHA with ref_list
      // For tree_get, use the commit SHA itself (GitHub resolves it)
      steps.push((await runStep("Get git tree", "github_tree_get", {
        owner, repo: repoName, tree_sha: commitSha,
      }, execute)).result);
    }

    steps.push((await runStep("List refs", "github_ref_list", {
      owner, repo: repoName, ref: "heads",
    }, execute)).result);

    steps.push((await runStep("Compare commits", "github_compare", {
      owner, repo: repoName, base: "main", head: "main",
    }, execute)).result);

    // --- Branches & content for PR ---
    steps.push((await runStep("List branches", "github_branch_list", {
      owner, repo: repoName,
    }, execute)).result);

    const rBranchGet = await runStep("Get branch (main)", "github_branch_get", {
      owner, repo: repoName, branch: "main",
    }, execute);
    steps.push(rBranchGet.result);

    const branchParsed = extractResult(rBranchGet.data) as Record<string, unknown> | undefined;
    const branchCommit = branchParsed?.commit as Record<string, unknown> | undefined;
    const mainSha = (branchCommit?.sha ?? commitSha) as string | undefined;

    if (mainSha) {
      // Create a feature branch
      steps.push((await runStep("Create branch", "github_branch_create", {
        owner, repo: repoName, branch: "smoke-test-branch", sha: mainSha,
      }, execute)).result);

      // Add a file on the feature branch
      const rContentCreate = await runStep("Create file on branch", "github_repo_content_create", {
        owner, repo: repoName, path: "smoke.txt",
        message: "Add smoke test file",
        content: Buffer.from("Smoke test content").toString("base64"),
        branch: "smoke-test-branch",
      }, execute);
      steps.push(rContentCreate.result);

      // --- Pull Requests ---
      const rPrCreate = await runStep("Create pull request", "github_pull_create", {
        owner, repo: repoName, title: "Smoke test PR",
        body: "Auto-created by smoke test.", head: "smoke-test-branch", base: "main",
      }, execute);
      steps.push(rPrCreate.result);

      const prParsed = extractResult(rPrCreate.data) as Record<string, unknown> | undefined;
      const prNumber = prParsed?.number as number | undefined;

      if (prNumber) {
        steps.push((await runStep("Get pull request", "github_pull_get", {
          owner, repo: repoName, pull_number: prNumber,
        }, execute)).result);

        steps.push((await runStep("List pull requests", "github_pull_list", {
          owner, repo: repoName, state: "open",
        }, execute)).result);

        steps.push((await runStep("Update pull request", "github_pull_update", {
          owner, repo: repoName, pull_number: prNumber, title: "Updated smoke PR",
        }, execute)).result);

        steps.push((await runStep("List PR files", "github_pull_files", {
          owner, repo: repoName, pull_number: prNumber,
        }, execute)).result);

        steps.push((await runStep("Get PR diff", "github_pull_diff", {
          owner, repo: repoName, pull_number: prNumber,
        }, execute)).result);

        steps.push((await runStep("List PR reviews", "github_pull_review_list", {
          owner, repo: repoName, pull_number: prNumber,
        }, execute)).result);

        steps.push((await runStep("Create PR review", "github_pull_review_create", {
          owner, repo: repoName, pull_number: prNumber,
          event: "COMMENT", body: "Smoke test review.",
        }, execute)).result);

        steps.push((await runStep("List PR review comments", "github_pull_review_comments", {
          owner, repo: repoName, pull_number: prNumber,
        }, execute)).result);

        steps.push((await runStep("Request PR reviewers", "github_pull_request_reviewers", {
          owner, repo: repoName, pull_number: prNumber, reviewers: [],
        }, execute)).result);

        steps.push((await runStep("List PR checks", "github_pull_checks", {
          owner, repo: repoName, pull_number: prNumber,
        }, execute)).result);

        steps.push((await runStep("Merge pull request", "github_pull_merge", {
          owner, repo: repoName, pull_number: prNumber, merge_method: "squash",
        }, execute)).result);
      }

      // Clean up the feature branch
      steps.push((await runStep("Delete branch", "github_branch_delete", {
        owner, repo: repoName, branch: "smoke-test-branch",
      }, execute, true)).result);
    }

    // --- Content create & delete on main ---
    const rFileCreate = await runStep("Create file on main", "github_repo_content_create", {
      owner, repo: repoName, path: "delete-me.txt",
      message: "Add file to delete",
      content: Buffer.from("Will be deleted").toString("base64"),
    }, execute);
    steps.push(rFileCreate.result);

    const fileParsed = extractResult(rFileCreate.data) as Record<string, unknown> | undefined;
    const fileSha = fileParsed?.sha as string | undefined;

    if (fileSha) {
      steps.push((await runStep("Delete file", "github_repo_content_delete", {
        owner, repo: repoName, path: "delete-me.txt",
        message: "Remove smoke test file", sha: fileSha,
      }, execute, true)).result);
    }

    // --- Tags & Releases ---
    steps.push((await runStep("List tags", "github_tag_list", {
      owner, repo: repoName,
    }, execute)).result);

    const rRelease = await runStep("Create release", "github_release_create", {
      owner, repo: repoName, tag_name: "v0.0.1-smoke",
      name: "Smoke Test Release", body: "Auto-created by smoke test.",
    }, execute);
    steps.push(rRelease.result);

    const releaseParsed = extractResult(rRelease.data) as Record<string, unknown> | undefined;
    const releaseId = releaseParsed?.id as number | undefined;

    if (releaseId) {
      steps.push((await runStep("List releases", "github_release_list", {
        owner, repo: repoName,
      }, execute)).result);

      steps.push((await runStep("Get release", "github_release_get", {
        owner, repo: repoName, release_id: releaseId,
      }, execute)).result);

      steps.push((await runStep("Delete release", "github_release_delete", {
        owner, repo: repoName, release_id: releaseId,
      }, execute, true)).result);
    }

    // --- Webhooks ---
    const rWebhook = await runStep("Create webhook", "github_webhook_create", {
      owner, repo: repoName, url: "https://example.com/omniclaw-smoke-test",
      events: ["push"], active: false,
    }, execute);
    steps.push(rWebhook.result);

    const webhookParsed = extractResult(rWebhook.data) as Record<string, unknown> | undefined;
    const hookId = webhookParsed?.id as number | undefined;

    if (hookId) {
      steps.push((await runStep("List webhooks", "github_webhook_list", {
        owner, repo: repoName,
      }, execute)).result);

      steps.push((await runStep("Update webhook", "github_webhook_update", {
        owner, repo: repoName, hook_id: hookId, active: false,
      }, execute)).result);

      steps.push((await runStep("Delete webhook", "github_webhook_delete", {
        owner, repo: repoName, hook_id: hookId,
      }, execute, true)).result);
    }

    // Security tools (dependabot, code scanning, secret scanning, advisories)
    // require the features to be enabled on the repo and GitHub Advanced Security.
    // They'll always fail on a freshly-created free-tier private repo, so skip.

    // Classic projects API (v1) is deprecated and returns 404/410 on new repos.
    // Skip project_list, project_get, project_columns, project_cards.

    // --- Cleanup: delete the test repo ---
    steps.push((await runStep("Delete test repo", "github_repo_delete", {
      owner, repo: repoName,
    }, execute, true)).result);
  }

  return steps;
};

const geminiTest: ServiceTestFn = async (execute) => {
  const steps: TestStepResult[] = [];

  // Generate an image with native Gemini
  const s1 = await runStep("Generate image (native)", "gemini_generate_image", {
    prompt: "A simple blue circle on a white background",
    save_dir: "/tmp/omniclaw-smoke-gemini",
  }, execute);
  steps.push(s1.result);

  // Generate an image with Imagen
  const s2 = await runStep("Generate image (Imagen)", "gemini_imagen", {
    prompt: "A simple red square on a white background",
    save_dir: "/tmp/omniclaw-smoke-gemini",
    number_of_images: 1,
  }, execute);
  steps.push(s2.result);

  // Generate a video
  const s3 = await runStep("Generate video", "gemini_generate_video", {
    prompt: "A simple rotating blue cube on a white background",
    save_dir: "/tmp/omniclaw-smoke-gemini",
  }, execute);
  steps.push(s3.result);

  return steps;
};

const wolframTest: ServiceTestFn = async (execute) => {
  const steps: TestStepResult[] = [];

  // LLM API query
  const s1 = await runStep("Query (LLM API)", "wolfram_query", {
    input: "2+2",
  }, execute);
  steps.push(s1.result);

  // Full Results API query
  const s2 = await runStep("Query (Full API)", "wolfram_query_full", {
    input: "population of France",
    format: "plaintext",
  }, execute);
  steps.push(s2.result);

  return steps;
};

const linkedinTest: ServiceTestFn = async (execute) => {
  const steps: TestStepResult[] = [];

  const s1 = await runStep("Get profile", "linkedin_profile_get", {}, execute);
  steps.push(s1.result);

  const s2 = await runStep("List connections", "linkedin_connections_list", { count: 5 }, execute);
  steps.push(s2.result);

  const s3 = await runStep("Search people", "linkedin_search_people", {
    keywords: "test",
    count: 3,
  }, execute);
  steps.push(s3.result);

  const s4 = await runStep("List feed posts", "linkedin_post_list", { count: 3 }, execute);
  steps.push(s4.result);

  const s5 = await runStep("List messages", "linkedin_messages_list", { count: 3 }, execute);
  steps.push(s5.result);

  const s6 = await runStep("View another user profile", "linkedin_profile_view", {
    profile_url: "https://www.linkedin.com/in/williamhgates/",
  }, execute);
  steps.push(s6.result);

  const s7 = await runStep("Create post", "linkedin_post_create", {
    text: "[omniclaw-smoke] auto test — will be manually removed",
  }, execute, true);
  steps.push(s7.result);

  // Extract post URN from s4 to use for like and comment
  const feedParsed = extractResult(s4.data) as { urn?: string }[] | undefined;
  const postUrn = Array.isArray(feedParsed) && feedParsed.length > 0
    ? feedParsed[0].urn : undefined;

  if (postUrn) {
    const s8 = await runStep("Like post", "linkedin_post_like", {
      urn: postUrn,
    }, execute);
    steps.push(s8.result);

    const s9 = await runStep("Comment on post", "linkedin_post_comment", {
      urn: postUrn,
      text: "[omniclaw-smoke] test comment",
    }, execute);
    steps.push(s9.result);
  }

  // Extract a conversation URN from messages list to reply in an existing thread
  const msgParsed = extractResult(s5.data) as { elements?: Array<{ entityUrn?: string }> } | undefined;
  const convElements = msgParsed?.elements;
  const convUrn = Array.isArray(convElements) && convElements.length > 0
    ? convElements[0].entityUrn : undefined;

  if (convUrn) {
    const s10 = await runStep("Send message", "linkedin_messages_send", {
      conversation_urn: convUrn,
      text: "[omniclaw-smoke] auto test",
    }, execute);
    steps.push(s10.result);
  } else {
    steps.push({
      name: "Send message",
      tool: "linkedin_messages_send",
      status: "skipped",
      duration: 0,
      error: "No existing conversations to reply to",
    });
  }

  return steps;
};

const instagramTest: ServiceTestFn = async (execute) => {
  const steps: TestStepResult[] = [];

  const s1 = await runStep("Get profile", "instagram_profile_get", {}, execute);
  steps.push(s1.result);

  const s2 = await runStep("Search users", "instagram_search", { query: "nature" }, execute);
  steps.push(s2.result);

  const s3 = await runStep("Get timeline feed", "instagram_feed_get", {}, execute);
  steps.push(s3.result);

  const s4 = await runStep("Get inbox", "instagram_inbox_get", {}, execute);
  steps.push(s4.result);

  const s5 = await runStep("View another user profile", "instagram_profile_view", {
    username: "instagram",
  }, execute);
  steps.push(s5.result);

  const s6 = await runStep("List own posts", "instagram_post_list", { max_count: 3 }, execute);
  steps.push(s6.result);

  // Extract media_id from post list for subsequent steps
  const postListParsed = extractResult(s6.data) as { media_id?: string }[] | undefined;
  const mediaId = Array.isArray(postListParsed) && postListParsed.length > 0
    ? postListParsed[0].media_id : undefined;

  if (mediaId) {
    const s7 = await runStep("Get post details", "instagram_post_get", { media_id: mediaId }, execute);
    steps.push(s7.result);

    const s8 = await runStep("Like post", "instagram_post_like", { media_id: mediaId }, execute);
    steps.push(s8.result);

    const s9 = await runStep("Unlike post", "instagram_post_unlike", { media_id: mediaId }, execute, true);
    steps.push(s9.result);

    const s10 = await runStep("Comment on post", "instagram_post_comment", {
      media_id: mediaId,
      text: "[omniclaw-smoke] test",
    }, execute);
    steps.push(s10.result);
  }

  const s11 = await runStep("Get stories", "instagram_stories_get", {}, execute);
  steps.push(s11.result);

  // Extract thread_id from inbox for messages_get
  const inboxParsed = extractResult(s4.data) as { thread_id?: string }[] | undefined;
  const threadId = Array.isArray(inboxParsed) && inboxParsed.length > 0
    ? inboxParsed[0].thread_id : undefined;

  if (threadId) {
    const s12 = await runStep("Get messages from thread", "instagram_messages_get", {
      thread_id: threadId,
    }, execute);
    steps.push(s12.result);
  }

  // Extract user_id from profile_get result for message_send
  const profileParsed = extractResult(s1.data) as Record<string, unknown> | undefined;
  const userId = profileParsed?.pk as string | undefined ?? profileParsed?.id as string | undefined;

  if (userId) {
    const s13 = await runStep("Send message", "instagram_message_send", {
      recipient_id: userId,
      text: "[omniclaw-smoke] test",
    }, execute);
    steps.push(s13.result);
  }

  return steps;
};

const framerTest: ServiceTestFn = async (execute) => {
  const steps: TestStepResult[] = [];

  // Project info
  const s1 = await runStep("Get project info", "framer_project_info", {}, execute);
  steps.push(s1.result);

  const s2 = await runStep("Get publish info", "framer_publish_info", {}, execute);
  steps.push(s2.result);

  const s3 = await runStep("Get changed paths", "framer_changed_paths", {}, execute);
  steps.push(s3.result);

  // Deployments
  const s4 = await runStep("List deployments", "framer_deployments_list", {}, execute);
  steps.push(s4.result);

  // Nodes
  const s5 = await runStep("Get nodes by type", "framer_nodes_by_type", { type: "FrameNode" }, execute);
  steps.push(s5.result);

  const nodesParsed = extractResult(s5.data) as Array<{ id?: string }> | undefined;
  const firstNodeId = Array.isArray(nodesParsed) && nodesParsed.length > 0
    ? nodesParsed[0].id : undefined;

  if (firstNodeId) {
    const s5a = await runStep("Get node", "framer_node_get", { node_id: firstNodeId }, execute);
    steps.push(s5a.result);

    const s5b = await runStep("Get node children", "framer_node_children", { node_id: firstNodeId }, execute);
    steps.push(s5b.result);

    const s5c = await runStep("Get node parent", "framer_node_parent", { node_id: firstNodeId }, execute);
    steps.push(s5c.result);
  }

  const s6 = await runStep("Get nodes by attribute", "framer_nodes_by_attribute", { attribute: "name" }, execute);
  steps.push(s6.result);

  // Create frame, then clean up
  const s7 = await runStep("Create frame", "framer_node_create_frame", {
    attributes: { name: "omniclaw-smoke-frame" },
  }, execute);
  steps.push(s7.result);

  const frameParsed = extractResult(s7.data) as { id?: string } | undefined;
  const frameId = frameParsed?.id;

  // Add text
  const s8 = await runStep("Add text", "framer_node_add_text", {
    text: "[omniclaw-smoke] test text",
    tag: "p",
  }, execute);
  steps.push(s8.result);

  // Add SVG
  const s9 = await runStep("Add SVG", "framer_node_add_svg", {
    svg: "<svg width='10' height='10'><rect width='10' height='10' fill='red'/></svg>",
    name: "omniclaw-smoke-svg",
  }, execute);
  steps.push(s9.result);

  // Set attributes on frame
  if (frameId) {
    const s10 = await runStep("Set node attributes", "framer_node_set_attributes", {
      node_id: frameId,
      attributes: { name: "omniclaw-smoke-frame-updated" },
    }, execute);
    steps.push(s10.result);

    const s10b = await runStep("Clone node", "framer_node_clone", { node_id: frameId }, execute);
    steps.push(s10b.result);

    const cloneParsed = extractResult(s10b.data) as { id?: string } | undefined;
    if (cloneParsed?.id) {
      const s10c = await runStep("Remove cloned node", "framer_node_remove", { node_id: cloneParsed.id }, execute, true);
      steps.push(s10c.result);
    }

    const s10d = await runStep("Remove frame", "framer_node_remove", { node_id: frameId }, execute, true);
    steps.push(s10d.result);
  }

  // Pages
  const s11 = await runStep("Create web page", "framer_page_create_web", {
    path: "/omniclaw-smoke-test",
  }, execute);
  steps.push(s11.result);

  const s12 = await runStep("Create design page", "framer_page_create_design", {
    name: "omniclaw-smoke-design",
  }, execute);
  steps.push(s12.result);

  // Collections
  const s13 = await runStep("List collections", "framer_collections_list", {}, execute);
  steps.push(s13.result);

  const s14 = await runStep("Create collection", "framer_collection_create", {
    name: "omniclaw-smoke-collection",
  }, execute);
  steps.push(s14.result);

  const collParsed = extractResult(s14.data) as { id?: string } | undefined;
  const collId = collParsed?.id;

  if (collId) {
    const s14a = await runStep("Get collection", "framer_collection_get", { collection_id: collId }, execute);
    steps.push(s14a.result);

    // Fields
    const s14b = await runStep("Add field", "framer_field_add", {
      collection_id: collId,
      fields: [{ name: "smoke-field", type: "string" }],
    }, execute);
    steps.push(s14b.result);

    const s14c = await runStep("List fields", "framer_fields_list", { collection_id: collId }, execute);
    steps.push(s14c.result);

    const fieldsParsed = extractResult(s14c.data) as Array<{ id?: string }> | undefined;
    const fieldId = Array.isArray(fieldsParsed) && fieldsParsed.length > 0 ? fieldsParsed[0].id : undefined;

    if (fieldId) {
      const s14d = await runStep("Remove field", "framer_field_remove", {
        collection_id: collId,
        field_ids: [fieldId],
      }, execute, true);
      steps.push(s14d.result);
    }

    // Items
    const s14e = await runStep("Create item", "framer_item_create", {
      collection_id: collId,
      items: [{ fieldData: {} }],
    }, execute);
    steps.push(s14e.result);

    const s14f = await runStep("List items", "framer_items_list", { collection_id: collId }, execute);
    steps.push(s14f.result);

    const itemsParsed = extractResult(s14f.data) as Array<{ id?: string }> | undefined;
    const itemId = Array.isArray(itemsParsed) && itemsParsed.length > 0 ? itemsParsed[0].id : undefined;

    if (itemId) {
      const s14g = await runStep("Remove item", "framer_item_remove", {
        collection_id: collId,
        item_ids: [itemId],
      }, execute, true);
      steps.push(s14g.result);
    }
  }

  // Code files
  const s15 = await runStep("List code files", "framer_code_files_list", {}, execute);
  steps.push(s15.result);

  const s16 = await runStep("Create code file", "framer_code_file_create", {
    name: "omniclaw-smoke.tsx",
    code: "export default function() { return null; }",
  }, execute);
  steps.push(s16.result);

  const codeParsed = extractResult(s16.data) as { id?: string } | undefined;
  const codeFileId = codeParsed?.id;

  if (codeFileId) {
    const s16a = await runStep("Get code file", "framer_code_file_get", { file_id: codeFileId }, execute);
    steps.push(s16a.result);

    const s16b = await runStep("Update code file", "framer_code_file_update", {
      file_id: codeFileId,
      code: "export default function() { return 'updated'; }",
    }, execute);
    steps.push(s16b.result);

    const s16c = await runStep("Remove code file", "framer_code_file_remove", { file_id: codeFileId }, execute, true);
    steps.push(s16c.result);
  }

  // Styles
  const s17 = await runStep("List color styles", "framer_color_styles_list", {}, execute);
  steps.push(s17.result);

  const s18 = await runStep("Create color style", "framer_color_style_create", {
    name: "omniclaw-smoke-color",
    attributes: { light: "#ff0000", dark: "#cc0000" },
  }, execute);
  steps.push(s18.result);

  const colorParsed = extractResult(s18.data) as { id?: string } | undefined;
  const colorId = colorParsed?.id;

  if (colorId) {
    const s18a = await runStep("Update color style", "framer_color_style_update", {
      style_id: colorId,
      attributes: { light: "#00ff00" },
    }, execute);
    steps.push(s18a.result);

    const s18b = await runStep("Remove color style", "framer_color_style_remove", { style_id: colorId }, execute, true);
    steps.push(s18b.result);
  }

  const s19 = await runStep("List text styles", "framer_text_styles_list", {}, execute);
  steps.push(s19.result);

  // Custom code
  const s20 = await runStep("Get custom code", "framer_custom_code_get", {}, execute);
  steps.push(s20.result);

  // Redirects
  const s21 = await runStep("List redirects", "framer_redirects_list", {}, execute);
  steps.push(s21.result);

  const s22 = await runStep("Add redirect", "framer_redirect_add", {
    redirects: [{ from: "/omniclaw-smoke-old", to: "/omniclaw-smoke-new" }],
  }, execute);
  steps.push(s22.result);

  const redirectsParsed = extractResult(s22.data) as Array<{ id?: string }> | undefined;
  const redirectId = Array.isArray(redirectsParsed) && redirectsParsed.length > 0
    ? redirectsParsed[0].id : undefined;

  if (redirectId) {
    const s22a = await runStep("Remove redirect", "framer_redirect_remove", {
      redirect_ids: [redirectId],
    }, execute, true);
    steps.push(s22a.result);
  }

  // Localization
  const s23 = await runStep("List locales", "framer_locales_list", {}, execute);
  steps.push(s23.result);

  const s24 = await runStep("List localization groups", "framer_localization_groups", {}, execute);
  steps.push(s24.result);

  return steps;
};

const SERVICE_TESTS: Record<string, ServiceTestFn> = {
  gmail: gmailTest,
  calendar: calendarTest,
  drive: driveTest,
  docs: docsTest,
  sheets: sheetsTest,
  slides: slidesTest,
  youtube: youtubeTest,
  github: githubTest,
  gemini: geminiTest,
  wolfram: wolframTest,
  linkedin: linkedinTest,
  instagram: instagramTest,
  framer: framerTest,
};

export async function runServiceTest(
  serviceId: string,
  execute: ExecuteFn,
): Promise<ServiceTestResult> {
  const testFn = SERVICE_TESTS[serviceId];
  if (!testFn) {
    return { service: serviceId, steps: [], totalDuration: 0 };
  }

  const start = Date.now();
  const steps = await testFn(execute);
  return {
    service: serviceId,
    steps,
    totalDuration: Date.now() - start,
  };
}

export function getAvailableTests(): string[] {
  return Object.keys(SERVICE_TESTS);
}
