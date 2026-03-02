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

  return steps;
};

const calendarTest: ServiceTestFn = async (execute) => {
  const steps: TestStepResult[] = [];

  const s1 = await runStep("List calendars", "calendar_list_calendars", {}, execute);
  steps.push(s1.result);

  const s2 = await runStep("List events", "calendar_events", { max_results: 2 }, execute);
  steps.push(s2.result);

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

  return steps;
};

const driveTest: ServiceTestFn = async (execute) => {
  const steps: TestStepResult[] = [];

  const s1 = await runStep("List files", "drive_list", { max_results: 2 }, execute);
  steps.push(s1.result);

  // Round-trip: create folder → delete
  const folderName = `omniclaw-smoke-test-${Date.now()}`;
  const s2 = await runStep("Create test folder", "drive_create_folder", { name: folderName }, execute);
  steps.push(s2.result);

  const parsed = extractResult(s2.data) as Record<string, unknown> | undefined;
  const folderId = parsed?.id as string | undefined;

  if (folderId) {
    const s3 = await runStep("Delete test folder", "drive_delete", { file_id: folderId, permanent: true }, execute, true);
    steps.push(s3.result);
  }

  return steps;
};

const docsTest: ServiceTestFn = async (execute) => {
  const steps: TestStepResult[] = [];

  // Round-trip: create → get → delete via Drive
  const s1 = await runStep("Create test document", "docs_create", { title: "Omniclaw Smoke Test" }, execute);
  steps.push(s1.result);

  const parsed = extractResult(s1.data) as Record<string, unknown> | undefined;
  const docId = parsed?.id as string | undefined;

  if (docId) {
    const s2 = await runStep("Get test document", "docs_get", { document_id: docId }, execute);
    steps.push(s2.result);

    const s3 = await runStep("Delete test document", "drive_delete", { file_id: docId, permanent: true }, execute, true);
    steps.push(s3.result);
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
    const s2 = await runStep("Get test spreadsheet", "sheets_get", { spreadsheet_id: sheetId, range: "Sheet1!A1:A1" }, execute);
    steps.push(s2.result);

    const s3 = await runStep("Delete test spreadsheet", "drive_delete", { file_id: sheetId, permanent: true }, execute, true);
    steps.push(s3.result);
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
    const s2 = await runStep("Get test presentation", "slides_get", { presentation_id: presId }, execute);
    steps.push(s2.result);

    const s3 = await runStep("Delete test presentation", "drive_delete", { file_id: presId, permanent: true }, execute, true);
    steps.push(s3.result);
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
