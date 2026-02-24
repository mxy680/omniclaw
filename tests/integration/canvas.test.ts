/**
 * Integration tests — hit the real Canvas LMS API.
 *
 * Re-authenticates in beforeAll via canvas_auth_setup (browser SSO + Duo TOTP)
 * to ensure fresh session cookies. Credentials are read from the openclaw
 * config file (~/.openclaw/openclaw.json), with env var overrides:
 *   CANVAS_BASE_URL       Canvas instance URL
 *   CANVAS_USERNAME       SSO username
 *   CANVAS_PASSWORD       SSO password
 *   DUO_TOTP_SECRET       Hex or base32-encoded Duo TOTP secret
 *
 * Optional env vars:
 *   CANVAS_ACCOUNT     Token store account name (default: "default")
 *   CANVAS_COURSE_ID   Specific course ID to use for course-specific tests
 *
 * Run:
 *   pnpm vitest run tests/integration/canvas.test.ts
 */

import { existsSync, readFileSync, readdirSync, unlinkSync, rmdirSync } from "fs";
import { homedir, tmpdir } from "os";
import { join } from "path";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { CanvasClientManager } from "../../src/auth/canvas-client-manager.js";
import { createCanvasAuthTool } from "../../src/tools/canvas-auth-tool.js";
import { createCanvasAnnouncementsTool } from "../../src/tools/canvas-announcements.js";
import {
  createCanvasAssignmentsTool,
  createCanvasGetAssignmentTool,
} from "../../src/tools/canvas-assignments.js";
import {
  createCanvasCoursesTool,
  createCanvasGetCourseTool,
} from "../../src/tools/canvas-courses.js";
import { createCanvasDownloadFileTool } from "../../src/tools/canvas-download.js";
import { createCanvasGradesTool } from "../../src/tools/canvas-grades.js";
import { createCanvasProfileTool } from "../../src/tools/canvas-profile.js";
import { createCanvasSubmissionsTool } from "../../src/tools/canvas-submissions.js";
import { createCanvasTodoTool } from "../../src/tools/canvas-todo.js";

// ---------------------------------------------------------------------------
// Config — read auth credentials from openclaw plugin config, env overrides
// ---------------------------------------------------------------------------
function loadOpenclawPluginConfig(): Record<string, string> {
  const configPath = join(homedir(), ".openclaw", "openclaw.json");
  if (!existsSync(configPath)) return {};
  try {
    const raw = JSON.parse(readFileSync(configPath, "utf-8"));
    return raw?.plugins?.entries?.omniclaw?.config ?? {};
  } catch {
    return {};
  }
}

const oclConfig = loadOpenclawPluginConfig();

const TOKENS_PATH = join(homedir(), ".openclaw", "omniclaw-canvas-tokens.json");
const ACCOUNT = process.env.CANVAS_ACCOUNT ?? "default";
const ENV_COURSE_ID = process.env.CANVAS_COURSE_ID ?? "";

const CANVAS_BASE_URL = process.env.CANVAS_BASE_URL || oclConfig.canvas_base_url || "";
const CANVAS_USERNAME = process.env.CANVAS_USERNAME || oclConfig.canvas_username || "";
const CANVAS_PASSWORD = process.env.CANVAS_PASSWORD || oclConfig.canvas_password || "";
const DUO_TOTP_SECRET = process.env.DUO_TOTP_SECRET || oclConfig.duo_totp_secret || "";

const authCredentialsAvailable =
  CANVAS_BASE_URL !== "" &&
  CANVAS_USERNAME !== "" &&
  CANVAS_PASSWORD !== "" &&
  DUO_TOTP_SECRET !== "";

if (!authCredentialsAvailable) {
  console.warn(
    "\n[integration] Skipping Canvas tests: auth credentials not found in " +
      "~/.openclaw/openclaw.json or env vars.\n",
  );
}

// ---------------------------------------------------------------------------
// Shared state
// ---------------------------------------------------------------------------
let canvasManager: CanvasClientManager;
let firstCourseId: string;
let firstAssignmentId: string;

const CANVAS_SAVE_DIR = join(tmpdir(), `omniclaw-canvas-test-${Date.now()}`);

// ---------------------------------------------------------------------------
describe.skipIf(!authCredentialsAvailable)("Canvas LMS API integration", { timeout: 120_000 }, () => {
  beforeAll(async () => {
    canvasManager = new CanvasClientManager(TOKENS_PATH);

    // Re-authenticate via browser SSO + Duo TOTP for fresh session cookies
    const tool = createCanvasAuthTool(canvasManager, {
      client_secret_path: "",
      canvas_base_url: CANVAS_BASE_URL,
      canvas_username: CANVAS_USERNAME,
      canvas_password: CANVAS_PASSWORD,
      canvas_auto_mfa: true,
      duo_totp_secret: DUO_TOTP_SECRET,
    });
    const result = await tool.execute("reauth", { account: ACCOUNT });
    console.log("[canvas] Re-auth result:", JSON.stringify(result.details, null, 2));
    expect(result.details.status).toBe("authenticated");
  }, 120_000);

  afterAll(() => {
    try {
      if (existsSync(CANVAS_SAVE_DIR)) {
        for (const file of readdirSync(CANVAS_SAVE_DIR)) {
          unlinkSync(join(CANVAS_SAVE_DIR, file));
        }
        rmdirSync(CANVAS_SAVE_DIR);
      }
    } catch { /* best-effort cleanup */ }
  });

  // -------------------------------------------------------------------------
  it("canvas_profile returns user profile", async () => {
    const tool = createCanvasProfileTool(canvasManager);
    const result = await tool.execute("t2", { account: ACCOUNT });
    const payload = JSON.parse(result.content[0].text);
    expect(payload).not.toHaveProperty("error");
    expect(typeof payload.name).toBe("string");
    expect(payload.id).toBeDefined();
  });

  // -------------------------------------------------------------------------
  it("canvas_courses returns active courses", async () => {
    const tool = createCanvasCoursesTool(canvasManager);
    const result = await tool.execute("t3", { account: ACCOUNT });
    const courses = JSON.parse(result.content[0].text);
    expect(Array.isArray(courses)).toBe(true);

    if (courses.length > 0) {
      firstCourseId = ENV_COURSE_ID || String(courses[0].id);
      expect(courses[0]).toHaveProperty("id");
      expect(courses[0]).toHaveProperty("name");
    } else if (ENV_COURSE_ID) {
      firstCourseId = ENV_COURSE_ID;
    }
  });

  // -------------------------------------------------------------------------
  it("canvas_get_course returns course details", async () => {
    const courseId = firstCourseId || ENV_COURSE_ID;
    if (!courseId) {
      console.warn("[canvas] Skipping canvas_get_course: no course ID available");
      return;
    }
    const tool = createCanvasGetCourseTool(canvasManager);
    const result = await tool.execute("t4", { course_id: courseId, account: ACCOUNT });
    const course = JSON.parse(result.content[0].text);
    expect(course).not.toHaveProperty("error");
    expect(String(course.id)).toBe(courseId);
  });

  // -------------------------------------------------------------------------
  it("canvas_assignments returns assignments for a course", async () => {
    const courseId = firstCourseId || ENV_COURSE_ID;
    if (!courseId) {
      console.warn("[canvas] Skipping canvas_assignments: no course ID available");
      return;
    }
    const tool = createCanvasAssignmentsTool(canvasManager);
    const result = await tool.execute("t5", { course_id: courseId, account: ACCOUNT });
    const assignments = JSON.parse(result.content[0].text);
    expect(Array.isArray(assignments)).toBe(true);

    if (assignments.length > 0) {
      firstAssignmentId = String(assignments[0].id);
      expect(assignments[0]).toHaveProperty("id");
      expect(assignments[0]).toHaveProperty("name");
    }
  });

  // -------------------------------------------------------------------------
  it("canvas_get_assignment returns assignment details", async () => {
    const courseId = firstCourseId || ENV_COURSE_ID;
    if (!courseId || !firstAssignmentId) {
      console.warn("[canvas] Skipping canvas_get_assignment: no course/assignment ID");
      return;
    }
    const tool = createCanvasGetAssignmentTool(canvasManager);
    const result = await tool.execute("t6", {
      course_id: courseId,
      assignment_id: firstAssignmentId,
      account: ACCOUNT,
    });
    const assignment = JSON.parse(result.content[0].text);
    expect(assignment).not.toHaveProperty("error");
    expect(String(assignment.id)).toBe(firstAssignmentId);
  });

  // -------------------------------------------------------------------------
  it("canvas_announcements returns announcements", async () => {
    const tool = createCanvasAnnouncementsTool(canvasManager);
    const result = await tool.execute("t7", { account: ACCOUNT });
    const announcements = JSON.parse(result.content[0].text);
    expect(Array.isArray(announcements)).toBe(true);
  });

  // -------------------------------------------------------------------------
  it("canvas_grades returns grade info for a course", async () => {
    const courseId = firstCourseId || ENV_COURSE_ID;
    if (!courseId) {
      console.warn("[canvas] Skipping canvas_grades: no course ID available");
      return;
    }
    const tool = createCanvasGradesTool(canvasManager);
    const result = await tool.execute("t8", { course_id: courseId, account: ACCOUNT });
    const payload = JSON.parse(result.content[0].text);
    expect(payload).not.toHaveProperty("error");
    expect(payload).toHaveProperty("course");
    expect(payload).toHaveProperty("enrollments");
  });

  // -------------------------------------------------------------------------
  it("canvas_submissions returns submissions or an authorization error", async () => {
    const courseId = firstCourseId || ENV_COURSE_ID;
    if (!courseId || !firstAssignmentId) {
      console.warn("[canvas] Skipping canvas_submissions: no course/assignment ID");
      return;
    }
    const tool = createCanvasSubmissionsTool(canvasManager);
    const result = await tool.execute("t9", {
      course_id: courseId,
      assignment_id: firstAssignmentId,
      account: ACCOUNT,
    });
    const payload = JSON.parse(result.content[0].text);
    // Students may not have permission to list all submissions for an assignment,
    // so the API may return an error object instead of an array.
    if (Array.isArray(payload)) {
      expect(payload.length).toBeGreaterThanOrEqual(0);
    } else {
      // Accept error responses (e.g. authorization errors or single submission object)
      expect(payload).toBeDefined();
    }
  });

  // -------------------------------------------------------------------------
  it("canvas_download_file — downloads a file when submission has attachments", async () => {
    const courseId = firstCourseId || ENV_COURSE_ID;
    if (!courseId || !firstAssignmentId) {
      console.warn("[canvas] Skipping canvas_download_file: no course/assignment ID");
      return;
    }

    // Get submissions to find one with attachments
    const subsTool = createCanvasSubmissionsTool(canvasManager);
    const subsResult = await subsTool.execute("t", {
      course_id: courseId,
      assignment_id: firstAssignmentId,
      account: ACCOUNT,
    });
    const submissions = JSON.parse(subsResult.content[0].text);

    if (!Array.isArray(submissions)) {
      console.warn("[canvas] Submissions not an array (authorization?) — skipping download test");
      return;
    }

    // Look for a submission with attachments
    let attachmentUrl: string | undefined;
    let attachmentFilename: string | undefined;
    for (const sub of submissions) {
      const attachments = sub.attachments ?? sub.submission_history?.[0]?.attachments;
      if (Array.isArray(attachments) && attachments.length > 0) {
        attachmentUrl = attachments[0].url;
        attachmentFilename = attachments[0].filename;
        break;
      }
    }

    if (!attachmentUrl) {
      console.warn("[canvas] No submission attachments found — skipping download test");
      return;
    }

    const tool = createCanvasDownloadFileTool(canvasManager);
    const result = await tool.execute("t", {
      url: attachmentUrl,
      save_dir: CANVAS_SAVE_DIR,
      filename: attachmentFilename,
      account: ACCOUNT,
    });

    const payload = result.details ?? JSON.parse(result.content[0].text);
    if (payload.error) {
      // May fail if file URL expired — accept graceful error
      expect(typeof payload.error).toBe("string");
    } else {
      expect(typeof payload.path).toBe("string");
      expect(existsSync(payload.path)).toBe(true);
      expect(payload.size).toBeGreaterThan(0);
    }
  });

  // -------------------------------------------------------------------------
  it("canvas_todo returns to-do list", async () => {
    const tool = createCanvasTodoTool(canvasManager);
    const result = await tool.execute("t10", { account: ACCOUNT });
    const todo = JSON.parse(result.content[0].text);
    expect(todo).toBeDefined();
    expect(todo).not.toHaveProperty("error");
  });

  // -------------------------------------------------------------------------
  it("returns auth_required sentinel when no credentials stored", async () => {
    const emptyManager = new CanvasClientManager(
      join(tmpdir(), `omniclaw-canvas-empty-${Date.now()}.json`),
    );
    const tool = createCanvasProfileTool(emptyManager);
    const result = await tool.execute("t11", { account: "nonexistent" });
    const payload = JSON.parse(result.content[0].text);
    expect(payload.error).toBe("auth_required");
  });
});
