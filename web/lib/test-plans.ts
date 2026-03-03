export interface TestStepResult {
  name: string;
  tool: string;
  status: "success" | "error";
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

  // Round-trip: create draft → delete draft
  const s6 = await runStep("Create test draft", "gmail_draft_create", {
    to: "test@example.com",
    subject: "Omniclaw Smoke Test Draft",
    body: "This draft will be deleted immediately.",
  }, execute);
  steps.push(s6.result);

  const draftParsed = extractResult(s6.data) as Record<string, unknown> | undefined;
  const draftId = draftParsed?.id as string | undefined;

  if (draftId) {
    const s7 = await runStep("Delete test draft", "gmail_draft_delete", { draft_id: draftId }, execute, true);
    steps.push(s7.result);
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
    // List permissions on the folder
    const s3 = await runStep("List permissions", "drive_permissions_list", { file_id: folderId }, execute);
    steps.push(s3.result);

    const s4 = await runStep("Delete test folder", "drive_delete", { file_id: folderId, permanent: true }, execute, true);
    steps.push(s4.result);
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

    // Read it back
    const s3 = await runStep("Get test spreadsheet", "sheets_get", { spreadsheet_id: sheetId, range: "Sheet1!A1:B2" }, execute);
    steps.push(s3.result);

    // Add a new sheet tab
    const s4 = await runStep("Add sheet tab", "sheets_add_sheet", {
      spreadsheet_id: sheetId,
      title: "SmokeTab",
    }, execute);
    steps.push(s4.result);

    // Delete the added sheet tab
    const tabParsed = extractResult(s4.data) as Record<string, unknown> | undefined;
    const tabSheetId = tabParsed?.sheetId as number | undefined;

    if (tabSheetId !== undefined) {
      const s5 = await runStep("Delete sheet tab", "sheets_delete_sheet", {
        spreadsheet_id: sheetId,
        sheet_id: tabSheetId,
      }, execute, true);
      steps.push(s5.result);
    }

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

    const s3 = await runStep("Get transcript", "youtube_get_transcript", { video: videoId }, execute);
    steps.push(s3.result);

    const s4 = await runStep("Get video comments", "youtube_video_comments", { video: videoId, max_results: 2 }, execute);
    steps.push(s4.result);
  }

  // Channel info
  const s5 = await runStep("Get channel info", "youtube_channel_info", { channel: "@Google" }, execute);
  steps.push(s5.result);

  // List playlists (authenticated user)
  const s6 = await runStep("List playlists", "youtube_playlists_list", { max_results: 2 }, execute);
  steps.push(s6.result);

  return steps;
};

const githubTest: ServiceTestFn = async (execute) => {
  const steps: TestStepResult[] = [];

  // Read: list repos for authenticated user
  const s1 = await runStep("List repos", "github_repo_list", { per_page: 3 }, execute);
  steps.push(s1.result);

  // Read: get a well-known public repo
  const s2 = await runStep("Get repo (octocat/Hello-World)", "github_repo_get", {
    owner: "octocat", repo: "Hello-World",
  }, execute);
  steps.push(s2.result);

  // Read: search repos
  const s3 = await runStep("Search repos", "github_search_repos", { q: "typescript", per_page: 1 }, execute);
  steps.push(s3.result);

  // Read: get a public user
  const s4 = await runStep("Get user (octocat)", "github_user_get", { username: "octocat" }, execute);
  steps.push(s4.result);

  // Read: list notifications
  const s5 = await runStep("List notifications", "github_notification_list", { per_page: 3 }, execute);
  steps.push(s5.result);

  // Round-trip: create gist → get → delete
  const s6 = await runStep("Create test gist", "github_gist_create", {
    description: "[omniclaw-smoke] auto-cleanup",
    public: false,
    files: { "smoke.txt": { content: "Smoke test — will be deleted." } },
  }, execute);
  steps.push(s6.result);

  const gistParsed = extractResult(s6.data) as Record<string, unknown> | undefined;
  const gistId = gistParsed?.id as string | undefined;

  if (gistId) {
    const s7 = await runStep("Get test gist", "github_gist_get", { gist_id: gistId }, execute);
    steps.push(s7.result);

    const s8 = await runStep("Delete test gist", "github_gist_delete", { gist_id: gistId }, execute, true);
    steps.push(s8.result);
  }

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
