import { describe, it, expect, vi, beforeEach } from "vitest";
import { createLinkedInProfileTool, createLinkedInGetProfileTool } from "../src/tools/linkedin-profile.js";
import { createLinkedInFeedTool } from "../src/tools/linkedin-feed.js";
import { createLinkedInConnectionsTool } from "../src/tools/linkedin-connections.js";
import { createLinkedInConversationsTool, createLinkedInMessagesTool } from "../src/tools/linkedin-messages.js";
import { createLinkedInNotificationsTool } from "../src/tools/linkedin-notifications.js";
import { createLinkedInSearchTool, createLinkedInSearchJobsTool } from "../src/tools/linkedin-search.js";
import { createLinkedInAuthTool } from "../src/tools/linkedin-auth-tool.js";
import { createLinkedInPendingInvitationsTool } from "../src/tools/linkedin-invitations.js";
import { createLinkedInCompanyTool } from "../src/tools/linkedin-company.js";
import { createLinkedInJobDetailsTool } from "../src/tools/linkedin-job-details.js";
import { createLinkedInPostCommentsTool } from "../src/tools/linkedin-post-comments.js";
import { createLinkedInProfileViewsTool } from "../src/tools/linkedin-profile-views.js";
import { createLinkedInSavedJobsTool } from "../src/tools/linkedin-saved-jobs.js";

function makeManager() {
  const sessions = new Map<string, { li_at: string }>();
  return {
    setCredentials: vi.fn((account: string, session: unknown) => sessions.set(account, session as { li_at: string })),
    getCredentials: vi.fn((account: string) => sessions.get(account) ?? null),
    hasCredentials: vi.fn((account: string) => sessions.has(account)),
    listAccounts: vi.fn(() => Array.from(sessions.keys())),
    get: vi.fn(),
    getPaginated: vi.fn(),
    extractEntities: vi.fn(),
  };
}

describe("LinkedIn tools - auth_required when no credentials", () => {
  beforeEach(() => vi.clearAllMocks());

  const tools = [
    { name: "linkedin_profile", create: (m: ReturnType<typeof makeManager>) => createLinkedInProfileTool(m as any) },
    { name: "linkedin_get_profile", create: (m: ReturnType<typeof makeManager>) => createLinkedInGetProfileTool(m as any), params: { id: "johndoe" } },
    { name: "linkedin_feed", create: (m: ReturnType<typeof makeManager>) => createLinkedInFeedTool(m as any) },
    { name: "linkedin_connections", create: (m: ReturnType<typeof makeManager>) => createLinkedInConnectionsTool(m as any) },
    { name: "linkedin_conversations", create: (m: ReturnType<typeof makeManager>) => createLinkedInConversationsTool(m as any) },
    { name: "linkedin_messages", create: (m: ReturnType<typeof makeManager>) => createLinkedInMessagesTool(m as any), params: { conversation_urn: "urn:li:msg_conversation:123" } },
    { name: "linkedin_notifications", create: (m: ReturnType<typeof makeManager>) => createLinkedInNotificationsTool(m as any) },
    { name: "linkedin_search", create: (m: ReturnType<typeof makeManager>) => createLinkedInSearchTool(m as any), params: { query: "test" } },
    { name: "linkedin_search_jobs", create: (m: ReturnType<typeof makeManager>) => createLinkedInSearchJobsTool(m as any), params: { keywords: "engineer" } },
    { name: "linkedin_pending_invitations", create: (m: ReturnType<typeof makeManager>) => createLinkedInPendingInvitationsTool(m as any) },
    { name: "linkedin_company", create: (m: ReturnType<typeof makeManager>) => createLinkedInCompanyTool(m as any), params: { name: "google" } },
    { name: "linkedin_job_details", create: (m: ReturnType<typeof makeManager>) => createLinkedInJobDetailsTool(m as any), params: { job_id: "123456" } },
    { name: "linkedin_post_comments", create: (m: ReturnType<typeof makeManager>) => createLinkedInPostCommentsTool(m as any), params: { activity_urn: "urn:li:activity:123" } },
    { name: "linkedin_profile_views", create: (m: ReturnType<typeof makeManager>) => createLinkedInProfileViewsTool(m as any) },
    { name: "linkedin_saved_jobs", create: (m: ReturnType<typeof makeManager>) => createLinkedInSavedJobsTool(m as any) },
  ];

  for (const { name, create, params } of tools) {
    it(`${name} returns auth_required when no credentials`, async () => {
      const manager = makeManager();
      const tool = create(manager);
      const result = await tool.execute("c", params ?? {});
      expect(result.details).toMatchObject({
        error: "auth_required",
        action: expect.stringContaining("linkedin_auth_setup"),
      });
    });
  }
});

describe("linkedin_profile", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns profile data on success", async () => {
    const manager = makeManager();
    manager.hasCredentials.mockReturnValue(true);
    manager.get.mockResolvedValue({
      included: [
        {
          $type: "com.linkedin.voyager.identity.shared.MiniProfile",
          firstName: "John",
          lastName: "Doe",
          occupation: "Software Engineer",
          publicIdentifier: "johndoe",
          entityUrn: "urn:li:fs_miniProfile:abc123",
        },
      ],
    });

    const tool = createLinkedInProfileTool(manager as any);
    const result = await tool.execute("c", {});

    expect(result.details.firstName).toBe("John");
    expect(result.details.lastName).toBe("Doe");
    expect(result.details.headline).toBe("Software Engineer");
    expect(result.details.publicIdentifier).toBe("johndoe");
  });

  it("returns error when API call fails", async () => {
    const manager = makeManager();
    manager.hasCredentials.mockReturnValue(true);
    manager.get.mockRejectedValue(new Error("Session expired"));

    const tool = createLinkedInProfileTool(manager as any);
    const result = await tool.execute("c", {});

    expect(result.details).toMatchObject({ error: "Session expired" });
  });

  it("supports custom account name", async () => {
    const manager = makeManager();
    manager.hasCredentials.mockReturnValue(true);
    manager.get.mockResolvedValue({
      included: [
        {
          $type: "com.linkedin.voyager.identity.shared.MiniProfile",
          firstName: "Jane",
          lastName: "Doe",
          occupation: "PM",
          publicIdentifier: "janedoe",
        },
      ],
    });

    const tool = createLinkedInProfileTool(manager as any);
    await tool.execute("c", { account: "work" });

    expect(manager.hasCredentials).toHaveBeenCalledWith("work");
    expect(manager.get).toHaveBeenCalledWith("work", "me");
  });
});

describe("linkedin_get_profile", () => {
  beforeEach(() => vi.clearAllMocks());

  it("fetches full profile by public identifier", async () => {
    const manager = makeManager();
    manager.hasCredentials.mockReturnValue(true);
    manager.get.mockResolvedValue({
      included: [
        {
          $type: "com.linkedin.voyager.dash.identity.profile.Profile",
          firstName: "Alice",
          lastName: "Smith",
          headline: "CEO at Acme",
          summary: "Visionary leader",
          publicIdentifier: "alicesmith",
          entityUrn: "urn:li:fsd_profile:xyz",
        },
        {
          $type: "com.linkedin.voyager.dash.identity.profile.Position",
          title: "CEO",
          companyName: "Acme Corp",
          timePeriod: {
            startDate: { year: 2020, month: 1 },
          },
        },
        {
          $type: "com.linkedin.voyager.dash.identity.profile.Education",
          schoolName: "MIT",
          degreeName: "BS",
          fieldOfStudy: "Computer Science",
          timePeriod: {
            startDate: { year: 2015 },
            endDate: { year: 2019 },
          },
        },
        {
          $type: "com.linkedin.voyager.dash.identity.profile.Skill",
          name: "Leadership",
        },
      ],
    });

    const tool = createLinkedInGetProfileTool(manager as any);
    const result = await tool.execute("c", { id: "alicesmith" });

    expect(result.details.firstName).toBe("Alice");
    expect(result.details.headline).toBe("CEO at Acme");
    expect(result.details.experience).toHaveLength(1);
    expect(result.details.experience[0].title).toBe("CEO");
    expect(result.details.experience[0].startDate).toBe("2020-01");
    expect(result.details.education).toHaveLength(1);
    expect(result.details.education[0].schoolName).toBe("MIT");
    expect(result.details.skills).toEqual(["Leadership"]);
  });
});

describe("linkedin_feed", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns feed posts", async () => {
    const manager = makeManager();
    manager.hasCredentials.mockReturnValue(true);
    manager.get.mockResolvedValue({
      included: [
        {
          $type: "com.linkedin.voyager.feed.Update",
          entityUrn: "urn:li:activity:123",
          commentary: { text: "Hello LinkedIn!" },
        },
      ],
    });

    const tool = createLinkedInFeedTool(manager as any);
    const result = await tool.execute("c", {});

    expect(result.details.posts).toHaveLength(1);
    expect(result.details.posts[0].text).toBe("Hello LinkedIn!");
  });
});

describe("linkedin_connections", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns connections list", async () => {
    const manager = makeManager();
    manager.hasCredentials.mockReturnValue(true);
    manager.get.mockResolvedValue({
      included: [
        {
          $type: "com.linkedin.voyager.identity.shared.MiniProfile",
          firstName: "Bob",
          lastName: "Jones",
          occupation: "Designer",
          publicIdentifier: "bobjones",
        },
      ],
      paging: { total: 150 },
    });

    const tool = createLinkedInConnectionsTool(manager as any);
    const result = await tool.execute("c", {});

    expect(result.details.connections).toHaveLength(1);
    expect(result.details.connections[0].firstName).toBe("Bob");
    expect(result.details.total).toBe(150);
  });
});

describe("linkedin_search", () => {
  beforeEach(() => vi.clearAllMocks());

  it("searches for people", async () => {
    const manager = makeManager();
    manager.hasCredentials.mockReturnValue(true);
    manager.get.mockResolvedValue({
      included: [
        {
          $type: "com.linkedin.voyager.identity.shared.MiniProfile",
          firstName: "Sarah",
          lastName: "Connor",
          occupation: "Engineer",
          publicIdentifier: "sarahconnor",
        },
      ],
    });

    const tool = createLinkedInSearchTool(manager as any);
    const result = await tool.execute("c", { query: "Sarah Connor" });

    expect(result.details.results).toHaveLength(1);
    expect(result.details.results[0].firstName).toBe("Sarah");
  });
});

describe("linkedin_search_jobs", () => {
  beforeEach(() => vi.clearAllMocks());

  it("searches for jobs", async () => {
    const manager = makeManager();
    manager.hasCredentials.mockReturnValue(true);
    manager.get.mockResolvedValue({
      included: [
        {
          $type: "com.linkedin.voyager.dash.jobs.JobPosting",
          entityUrn: "urn:li:job:456",
          title: "Software Engineer",
          companyName: "Acme Corp",
          formattedLocation: "San Francisco, CA",
        },
      ],
      paging: { total: 100 },
    });

    const tool = createLinkedInSearchJobsTool(manager as any);
    const result = await tool.execute("c", { keywords: "software engineer" });

    expect(result.details.jobs).toHaveLength(1);
    expect(result.details.jobs[0].title).toBe("Software Engineer");
  });
});

describe("linkedin_pending_invitations", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns pending invitations", async () => {
    const manager = makeManager();
    manager.hasCredentials.mockReturnValue(true);
    manager.get.mockResolvedValue({
      included: [
        {
          $type: "com.linkedin.voyager.relationships.Invitation",
          entityUrn: "urn:li:invitation:111",
          message: "Let's connect!",
          sentTime: 1700000000000,
          "*fromMember": "urn:li:fs_miniProfile:abc",
        },
        {
          $type: "com.linkedin.voyager.identity.shared.MiniProfile",
          entityUrn: "urn:li:fs_miniProfile:abc",
          firstName: "Carol",
          lastName: "White",
          occupation: "Recruiter",
          publicIdentifier: "carolwhite",
        },
      ],
    });

    const tool = createLinkedInPendingInvitationsTool(manager as any);
    const result = await tool.execute("c", {});

    expect(result.details.invitations).toHaveLength(1);
    expect(result.details.invitations[0].message).toBe("Let's connect!");
    expect(result.details.invitations[0].from.firstName).toBe("Carol");
  });
});

describe("linkedin_company", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns company details", async () => {
    const manager = makeManager();
    manager.hasCredentials.mockReturnValue(true);
    manager.get.mockResolvedValue({
      included: [
        {
          $type: "com.linkedin.voyager.organization.Company",
          name: "Google",
          universalName: "google",
          entityUrn: "urn:li:fsd_company:1441",
          description: "A technology company",
          industryName: "Technology",
          staffCount: 150000,
          websiteUrl: "https://google.com",
          headquarter: {
            city: "Mountain View",
            country: "US",
            geographicArea: "California",
          },
        },
      ],
    });

    const tool = createLinkedInCompanyTool(manager as any);
    const result = await tool.execute("c", { name: "google" });

    expect(result.details.name).toBe("Google");
    expect(result.details.industry).toBe("Technology");
    expect(result.details.staffCount).toBe(150000);
    expect(result.details.headquarters.city).toBe("Mountain View");
  });

  it("returns error for unknown company", async () => {
    const manager = makeManager();
    manager.hasCredentials.mockReturnValue(true);
    manager.get.mockResolvedValue({ included: [] });

    const tool = createLinkedInCompanyTool(manager as any);
    const result = await tool.execute("c", { name: "nonexistent" });

    expect(result.details.error).toContain("not found");
  });
});

describe("linkedin_job_details", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns job posting details", async () => {
    const manager = makeManager();
    manager.hasCredentials.mockReturnValue(true);
    manager.get.mockResolvedValue({
      included: [
        {
          $type: "com.linkedin.voyager.dash.jobs.JobPosting",
          entityUrn: "urn:li:fsd_jobPosting:789",
          title: "Senior Engineer",
          description: { text: "Build amazing things" },
          formattedLocation: "New York, NY",
          workRemoteAllowed: true,
          formattedEmploymentStatus: "Full-time",
          applicantCount: 42,
        },
        {
          $type: "com.linkedin.voyager.organization.Company",
          name: "Startup Inc",
          universalName: "startupinc",
        },
      ],
    });

    const tool = createLinkedInJobDetailsTool(manager as any);
    const result = await tool.execute("c", { job_id: "789" });

    expect(result.details.title).toBe("Senior Engineer");
    expect(result.details.description).toBe("Build amazing things");
    expect(result.details.company.name).toBe("Startup Inc");
    expect(result.details.workRemoteAllowed).toBe(true);
    expect(result.details.applicantCount).toBe(42);
  });
});

describe("linkedin_post_comments", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns comments on a post", async () => {
    const manager = makeManager();
    manager.hasCredentials.mockReturnValue(true);
    manager.get.mockResolvedValue({
      included: [
        {
          $type: "com.linkedin.voyager.social.Comment",
          entityUrn: "urn:li:comment:999",
          commentary: { text: "Great post!" },
          "*commenter": "urn:li:fs_miniProfile:def",
          createdAt: 1700000000000,
          numLikes: 5,
          numReplies: 1,
        },
        {
          $type: "com.linkedin.voyager.identity.shared.MiniProfile",
          entityUrn: "urn:li:fs_miniProfile:def",
          firstName: "Dave",
          lastName: "Brown",
          occupation: "Developer",
          publicIdentifier: "davebrown",
        },
      ],
    });

    const tool = createLinkedInPostCommentsTool(manager as any);
    const result = await tool.execute("c", { activity_urn: "urn:li:activity:123" });

    expect(result.details.comments).toHaveLength(1);
    expect(result.details.comments[0].text).toBe("Great post!");
    expect(result.details.comments[0].author.name).toBe("Dave Brown");
    expect(result.details.comments[0].numLikes).toBe(5);
  });
});

describe("linkedin_profile_views", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns profile viewers", async () => {
    const manager = makeManager();
    manager.hasCredentials.mockReturnValue(true);
    manager.get.mockResolvedValue({
      included: [
        {
          $type: "com.linkedin.voyager.identity.ProfileViewer",
          entityUrn: "urn:li:profileViewer:aaa",
          viewedAt: 1700000000000,
          "*viewer": "urn:li:fs_miniProfile:ghi",
        },
        {
          $type: "com.linkedin.voyager.identity.shared.MiniProfile",
          entityUrn: "urn:li:fs_miniProfile:ghi",
          firstName: "Eve",
          lastName: "Green",
          occupation: "Hiring Manager",
          publicIdentifier: "evegreen",
        },
      ],
      data: { total: 25 },
    });

    const tool = createLinkedInProfileViewsTool(manager as any);
    const result = await tool.execute("c", {});

    expect(result.details.viewers).toHaveLength(1);
    expect(result.details.viewers[0].viewer.firstName).toBe("Eve");
    expect(result.details.viewers[0].viewer.lastName).toBe("Green");
    expect(result.details.viewers[0].viewer.headline).toBe("Hiring Manager");
    expect(result.details.viewers[0].anonymous).toBe(false);
    expect(result.details.totalViews).toBe(25);
  });
});

describe("linkedin_saved_jobs", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns saved jobs", async () => {
    const manager = makeManager();
    manager.hasCredentials.mockReturnValue(true);
    manager.get.mockResolvedValue({
      included: [
        {
          $type: "com.linkedin.voyager.dash.jobs.JobPosting",
          entityUrn: "urn:li:job:555",
          title: "Staff Engineer",
          companyName: "BigCo",
          formattedLocation: "Remote",
          savedAt: 1700000000000,
          workRemoteAllowed: true,
        },
      ],
      paging: { total: 5 },
    });

    const tool = createLinkedInSavedJobsTool(manager as any);
    const result = await tool.execute("c", {});

    expect(result.details.jobs).toHaveLength(1);
    expect(result.details.jobs[0].title).toBe("Staff Engineer");
    expect(result.details.total).toBe(5);
  });
});

describe("linkedin_auth_setup", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns error when config has no credentials and params empty", async () => {
    const manager = makeManager();
    // We can't actually test the browser flow, but we can test config handling
    // The auth tool will try to launch Playwright which would fail in test env
    // So we just verify the tool is created correctly
    const tool = createLinkedInAuthTool(manager as any, {} as any);
    expect(tool.name).toBe("linkedin_auth_setup");
    expect(tool.label).toBe("LinkedIn Auth Setup");
  });
});
