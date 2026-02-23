/**
 * Integration tests — hit the real Canvas LMS API.
 *
 * Required env vars:
 *   CANVAS_BASE_URL          Canvas instance URL (e.g. https://canvas.case.edu)
 *   CANVAS_SESSION_COOKIE    Value of the canvas_session cookie (grab from browser devtools)
 *
 * Optional env vars:
 *   CANVAS_ACCOUNT     Token store account name (default: "default")
 *   CANVAS_COURSE_ID   Specific course ID to use for course-specific tests
 *
 * Run:
 *   CANVAS_BASE_URL="https://canvas.case.edu" CANVAS_SESSION_COOKIE="<value>" \
 *   CANVAS_COURSE_ID=<id> pnpm vitest run tests/integration/canvas.test.ts
 */

import { describe, it, expect, beforeAll } from "vitest";
import * as os from "os";
import * as path from "path";

import { CanvasClientManager } from "../../src/auth/canvas-client-manager";
import { createCanvasProfileTool } from "../../src/tools/canvas-profile";
import { createCanvasCoursesTool, createCanvasGetCourseTool } from "../../src/tools/canvas-courses";
import { createCanvasAssignmentsTool, createCanvasGetAssignmentTool } from "../../src/tools/canvas-assignments";
import { createCanvasAnnouncementsTool } from "../../src/tools/canvas-announcements";
import { createCanvasGradesTool } from "../../src/tools/canvas-grades";
import { createCanvasSubmissionsTool } from "../../src/tools/canvas-submissions";
import { createCanvasTodoTool } from "../../src/tools/canvas-todo";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const BASE_URL = process.env.CANVAS_BASE_URL ?? "";
const SESSION_COOKIE = process.env.CANVAS_SESSION_COOKIE ?? "";
const ACCOUNT = process.env.CANVAS_ACCOUNT ?? "default";
const ENV_COURSE_ID = process.env.CANVAS_COURSE_ID ?? "";

const credentialsProvided = BASE_URL !== "" && SESSION_COOKIE !== "";

if (!credentialsProvided) {
  console.warn(
    "\n[integration] Skipping Canvas tests: CANVAS_BASE_URL and CANVAS_SESSION_COOKIE env vars not set.\n"
  );
}

// ---------------------------------------------------------------------------
// Shared state
// ---------------------------------------------------------------------------
let canvasManager: CanvasClientManager;
let firstCourseId: string;
let firstAssignmentId: string;

// ---------------------------------------------------------------------------
describe.skipIf(!credentialsProvided)("Canvas LMS API integration", { timeout: 30_000 }, () => {
  beforeAll(() => {
    const tokensPath = path.join(os.tmpdir(), `omniclaw-canvas-test-${Date.now()}.json`);
    canvasManager = new CanvasClientManager(tokensPath);
    // Bootstrap session from just the canvas_session cookie value
    canvasManager.setSessionFromCookie(ACCOUNT, BASE_URL.replace(/\/$/, ""), SESSION_COOKIE);
  });

  // -------------------------------------------------------------------------
  // canvas_auth_setup requires MFA — runs automatically with DUO_TOTP_SECRET,
  // otherwise skipped. See tests/integration/duo-totp.test.ts for the full
  // TOTP auth flow test.
  it.skip("canvas_auth_setup authenticates via browser SSO", () => {
    // Run the dedicated TOTP integration test instead:
    //   DUO_TOTP_SECRET="..." pnpm vitest run tests/integration/duo-totp.test.ts
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
  it("canvas_submissions returns submissions for an assignment", async () => {
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
    const submissions = JSON.parse(result.content[0].text);
    expect(Array.isArray(submissions)).toBe(true);
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
      path.join(os.tmpdir(), `omniclaw-canvas-empty-${Date.now()}.json`)
    );
    const tool = createCanvasProfileTool(emptyManager);
    const result = await tool.execute("t11", { account: "nonexistent" });
    const payload = JSON.parse(result.content[0].text);
    expect(payload.error).toBe("auth_required");
  });
});
