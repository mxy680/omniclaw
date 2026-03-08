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

  steps.push((await runStep("List teams", "github_team_list", {
    org: "github", per_page: 1,
  }, execute)).result);

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

    steps.push((await runStep("Get run logs URL", "github_run_logs", {
      owner: "actions", repo: "checkout", run_id: runId,
    }, execute)).result);
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

    steps.push((await runStep("Get README content", "github_repo_content_get", {
      owner, repo: repoName, path: "README.md",
    }, execute)).result);

    steps.push((await runStep("Get branch protection", "github_branch_protection_get", {
      owner, repo: repoName, branch: "main",
    }, execute)).result);

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

    // --- Security (read-only, may return empty or 403) ---
    steps.push((await runStep("Dependabot alerts", "github_dependabot_alerts", {
      owner, repo: repoName,
    }, execute)).result);

    steps.push((await runStep("Code scanning alerts", "github_code_scanning_alerts", {
      owner, repo: repoName,
    }, execute)).result);

    steps.push((await runStep("Secret scanning alerts", "github_secret_scanning_alerts", {
      owner, repo: repoName,
    }, execute)).result);

    steps.push((await runStep("Security advisories", "github_security_advisories", {
      owner, repo: repoName,
    }, execute)).result);

    // --- Projects (classic v1, likely empty) ---
    const rProjects = await runStep("List projects", "github_project_list", {
      owner, repo: repoName, state: "all",
    }, execute);
    steps.push(rProjects.result);

    const projectsParsed = extractResult(rProjects.data) as { id?: number }[] | undefined;
    const projectId = Array.isArray(projectsParsed) && projectsParsed.length > 0
      ? projectsParsed[0].id : undefined;

    if (projectId) {
      steps.push((await runStep("Get project", "github_project_get", {
        project_id: projectId,
      }, execute)).result);

      const rColumns = await runStep("List project columns", "github_project_columns", {
        project_id: projectId,
      }, execute);
      steps.push(rColumns.result);

      const colsParsed = extractResult(rColumns.data) as { id?: number }[] | undefined;
      const columnId = Array.isArray(colsParsed) && colsParsed.length > 0
        ? colsParsed[0].id : undefined;

      if (columnId) {
        steps.push((await runStep("List project cards", "github_project_cards", {
          column_id: columnId,
        }, execute)).result);
      }
    }

    // --- Cleanup: delete the test repo ---
    steps.push((await runStep("Delete test repo", "github_repo_delete", {
      owner, repo: repoName,
    }, execute, true)).result);
  }

  return steps;
};

const geminiTest: ServiceTestFn = async (execute) => {
  const steps: TestStepResult[] = [];

  // Auth setup — validates the API key
  const s1 = await runStep("Auth setup", "gemini_auth_setup", {
    api_key: "test-placeholder",
  }, execute);
  steps.push(s1.result);

  // Generate an image with native Gemini
  const s2 = await runStep("Generate image (native)", "gemini_generate_image", {
    prompt: "A simple blue circle on a white background",
    save_dir: "/tmp/omniclaw-smoke-gemini",
  }, execute);
  steps.push(s2.result);

  // Generate an image with Imagen
  const s3 = await runStep("Generate image (Imagen)", "gemini_imagen", {
    prompt: "A simple red square on a white background",
    save_dir: "/tmp/omniclaw-smoke-gemini",
    number_of_images: 1,
  }, execute);
  steps.push(s3.result);

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
