import {
  Mail,
  Calendar,
  HardDrive,
  FileText,
  Table2,
  Presentation,
  Github,
  Sparkles,
  Youtube,
  GraduationCap,
  Linkedin,
  Instagram,
  MessageCircle,
  ChefHat,
} from "lucide-react";

export interface Tool {
  name: string;
  label: string;
  description: string;
}

export interface Integration {
  id: string;
  name: string;
  icon: typeof Mail;
  color: string;
  tools: Tool[];
}

export const integrations: Integration[] = [
  {
    id: "gmail",
    name: "Gmail",
    icon: Mail,
    color: "#ea4335",
    tools: [
      { name: "gmail_auth_setup", label: "Gmail Auth Setup", description: "Authenticate omniclaw with Gmail via Google OAuth2. Opens a browser window for the Google sign-in flow." },
      { name: "gmail_inbox", label: "Gmail Inbox", description: "List recent Gmail inbox messages. Returns up to max_results emails with id, subject, from, date, and snippet." },
      { name: "gmail_search", label: "Gmail Search", description: "Search Gmail messages using Gmail query syntax (e.g. 'from:alice after:2025/01/01 has:attachment')." },
      { name: "gmail_get", label: "Gmail Get Email", description: "Fetch the full body of a single Gmail message by ID. Returns subject, from, to, date, both plain-text and HTML body, and attachments." },
      { name: "gmail_download_attachment", label: "Gmail Download Attachment", description: "Download an email attachment to disk. Use gmail_get to find attachment IDs first." },
      { name: "gmail_send", label: "Gmail Send Email", description: "Send a new email via Gmail." },
      { name: "gmail_reply", label: "Gmail Reply", description: "Reply to an existing Gmail message, keeping it in the same thread." },
      { name: "gmail_forward", label: "Gmail Forward", description: "Forward an existing Gmail message to another recipient, optionally adding a note." },
      { name: "gmail_modify", label: "Gmail Modify", description: "Change the state of a Gmail message: mark as read/unread, archive, or move to trash." },
      { name: "gmail_accounts", label: "Gmail Accounts", description: "List all authenticated Gmail accounts. Returns each account name and its associated email address." },
    ],
  },
  {
    id: "calendar",
    name: "Calendar",
    icon: Calendar,
    color: "#4285f4",
    tools: [
      { name: "calendar_auth_setup", label: "Calendar Auth Setup", description: "Authenticate omniclaw with Google Calendar via Google OAuth2." },
      { name: "calendar_list_calendars", label: "List Calendars", description: "List all Google Calendars the user has access to (primary, shared, subscribed)." },
      { name: "calendar_events", label: "List Events", description: "List upcoming Google Calendar events. Defaults to the primary calendar and upcoming events from now." },
      { name: "calendar_get", label: "Get Event", description: "Fetch full details of a single Google Calendar event by its ID." },
      { name: "calendar_create", label: "Create Event", description: "Create a new Google Calendar event with title, start/end times, description, location, and attendees." },
      { name: "calendar_update", label: "Update Event", description: "Update an existing Google Calendar event. Only provide the fields you want to change." },
      { name: "calendar_delete", label: "Delete Event", description: "Delete a Google Calendar event by its ID. Sends cancellation notifications to all attendees." },
      { name: "calendar_respond", label: "RSVP", description: "RSVP to a Google Calendar event invite. Set your response to accepted, declined, or tentative." },
    ],
  },
  {
    id: "drive",
    name: "Drive",
    icon: HardDrive,
    color: "#0f9d58",
    tools: [
      { name: "drive_auth_setup", label: "Drive Auth Setup", description: "Authenticate omniclaw with Google Drive via Google OAuth2." },
      { name: "drive_list", label: "List Files", description: "List files and folders in Google Drive. Optionally filter by parent folder." },
      { name: "drive_search", label: "Search Files", description: "Search for files in Google Drive using query syntax like name, mimeType, or fullText contains." },
      { name: "drive_get", label: "Get File", description: "Fetch full metadata for a single Google Drive file by its ID." },
      { name: "drive_read", label: "Read File", description: "Read the text content of a Google Drive file. Works with Docs, Sheets, Slides, and plain-text files." },
      { name: "drive_upload", label: "Upload File", description: "Create a new file or update an existing file in Google Drive from a local path or inline content." },
      { name: "drive_create_folder", label: "Create Folder", description: "Create a new folder in Google Drive. Optionally place it inside a parent folder." },
      { name: "drive_move", label: "Move File", description: "Move a Google Drive file or folder to a different parent folder." },
      { name: "drive_delete", label: "Delete File", description: "Move a Google Drive file or folder to trash, or permanently delete it." },
      { name: "drive_share", label: "Share File", description: "Share a Google Drive file or folder with another user as reader, commenter, or writer." },
      { name: "drive_download", label: "Download File", description: "Download a file from Google Drive to local disk. Supports Google Workspace export formats." },
    ],
  },
  {
    id: "docs",
    name: "Docs",
    icon: FileText,
    color: "#4285f4",
    tools: [
      { name: "docs_auth_setup", label: "Docs Auth Setup", description: "Authenticate omniclaw with Google Docs via Google OAuth2." },
      { name: "docs_create", label: "Create Doc", description: "Create a new Google Doc with a given title and optional initial text content." },
      { name: "docs_get", label: "Get Doc", description: "Fetch a Google Doc by its ID and return its title, plain-text content, and character count." },
      { name: "docs_append", label: "Append Text", description: "Append text to the end of an existing Google Doc." },
      { name: "docs_replace_text", label: "Replace Text", description: "Find and replace all occurrences of a text string in a Google Doc." },
      { name: "docs_export", label: "Export Doc", description: "Export a Google Doc to local disk as PDF or DOCX." },
    ],
  },
  {
    id: "sheets",
    name: "Sheets",
    icon: Table2,
    color: "#0f9d58",
    tools: [
      { name: "sheets_auth_setup", label: "Sheets Auth Setup", description: "Authenticate omniclaw with Google Sheets via Google OAuth2." },
      { name: "sheets_create", label: "Create Sheet", description: "Create a new Google Sheets spreadsheet with a given title." },
      { name: "sheets_get", label: "Get Sheet", description: "Read cell values from a Google Sheet range using A1 notation." },
      { name: "sheets_update", label: "Update Sheet", description: "Write values to a range in a Google Sheet. Existing cell content is overwritten." },
      { name: "sheets_append", label: "Append Rows", description: "Append rows of data after the last row with content in a Google Sheet." },
      { name: "sheets_clear", label: "Clear Range", description: "Clear all values from a range in a Google Sheet. Formatting is preserved." },
      { name: "sheets_export", label: "Export Sheet", description: "Export a Google Sheets spreadsheet to local disk as PDF, XLSX, or CSV." },
    ],
  },
  {
    id: "slides",
    name: "Slides",
    icon: Presentation,
    color: "#f4b400",
    tools: [
      { name: "slides_auth_setup", label: "Slides Auth Setup", description: "Authenticate omniclaw with Google Slides via Google OAuth2." },
      { name: "slides_create", label: "Create Presentation", description: "Create a new Google Slides presentation with a given title." },
      { name: "slides_get", label: "Get Presentation", description: "Fetch a presentation by its ID. Returns title, slide count, text content, and speaker notes." },
      { name: "slides_append_slide", label: "Append Slide", description: "Append a new slide with a title and optional body text." },
      { name: "slides_replace_text", label: "Replace Text", description: "Find and replace all occurrences of a text string across all slides." },
      { name: "slides_export", label: "Export Presentation", description: "Export a Google Slides presentation to local disk as PDF or PPTX." },
    ],
  },
  {
    id: "github",
    name: "GitHub",
    icon: Github,
    color: "#f0f6fc",
    tools: [
      { name: "github_auth_setup", label: "GitHub Auth Setup", description: "Authenticate with GitHub using a Personal Access Token (PAT)." },
      { name: "github_repos", label: "List Repos", description: "List repositories for the authenticated user." },
      { name: "github_get_repo", label: "Get Repo", description: "Get details for a specific GitHub repository." },
      { name: "github_search_code", label: "Search Code", description: "Search for code across GitHub repositories." },
      { name: "github_get_file", label: "Get File", description: "Read the contents of a file from a GitHub repository." },
      { name: "github_branches", label: "List Branches", description: "List branches for a GitHub repository." },
      { name: "github_issues", label: "List Issues", description: "List issues for a repository. Returns number, title, state, labels, and assignees." },
      { name: "github_get_issue", label: "Get Issue", description: "Get details for a specific GitHub issue, including its comments." },
      { name: "github_create_issue", label: "Create Issue", description: "Create a new issue in a GitHub repository." },
      { name: "github_update_issue", label: "Update Issue", description: "Update an existing GitHub issue (title, body, state, labels, assignees)." },
      { name: "github_add_issue_comment", label: "Add Issue Comment", description: "Add a comment to a GitHub issue." },
      { name: "github_pulls", label: "List Pull Requests", description: "List pull requests for a GitHub repository." },
      { name: "github_get_pull", label: "Get Pull Request", description: "Get details for a specific pull request, including diff stats and review summary." },
      { name: "github_create_pull", label: "Create Pull Request", description: "Create a new pull request." },
      { name: "github_merge_pull", label: "Merge Pull Request", description: "Merge a pull request." },
      { name: "github_add_pull_review", label: "Add Pull Review", description: "Create a review on a pull request (approve, comment, or request changes)." },
      { name: "github_notifications", label: "Notifications", description: "List your GitHub notifications." },
      { name: "github_mark_notification_read", label: "Mark Notification Read", description: "Mark a notification thread as read." },
    ],
  },
  {
    id: "gemini",
    name: "Gemini",
    icon: Sparkles,
    color: "#8e75b2",
    tools: [
      { name: "gemini_auth_setup", label: "Gemini Auth Setup", description: "Authenticate with Google Gemini using an API key." },
      { name: "gemini_generate_image", label: "Generate Image", description: "Generate images from a text prompt using Gemini or Imagen models." },
      { name: "gemini_edit_image", label: "Edit Image", description: "Edit an existing image using a text instruction." },
      { name: "gemini_generate_video", label: "Generate Video", description: "Generate videos from text prompts or images using Veo models." },
      { name: "gemini_analyze_video", label: "Analyze Video", description: "Upload and analyze a video file using Gemini for understanding, transcription, and Q&A." },
    ],
  },
  {
    id: "youtube",
    name: "YouTube",
    icon: Youtube,
    color: "#ff0000",
    tools: [
      { name: "youtube_auth_setup", label: "YouTube Auth Setup", description: "Authenticate omniclaw with YouTube via Google OAuth2." },
      { name: "youtube_get_transcript", label: "Get Transcript", description: "Get the transcript (captions/subtitles) of a YouTube video. No auth required." },
      { name: "youtube_search", label: "Search Videos", description: "Search YouTube for videos by keyword or phrase." },
      { name: "youtube_video_details", label: "Video Details", description: "Get detailed metadata for a video: title, description, duration, view/like counts, tags, and more." },
      { name: "youtube_channel_info", label: "Channel Info", description: "Get details about a YouTube channel: name, description, subscriber count, video count." },
      { name: "youtube_video_comments", label: "Video Comments", description: "Read top-level comments on a YouTube video." },
      { name: "youtube_download_thumbnail", label: "Download Thumbnail", description: "Download a YouTube video thumbnail to local disk." },
    ],
  },
  {
    id: "canvas",
    name: "Canvas",
    icon: GraduationCap,
    color: "#e03e2d",
    tools: [
      { name: "canvas_auth_setup", label: "Canvas Auth Setup", description: "Authenticate with Canvas LMS via browser SSO and Duo/MFA." },
      { name: "canvas_profile", label: "Profile", description: "Get your Canvas user profile including name, email, and login ID." },
      { name: "canvas_courses", label: "Courses", description: "List your Canvas courses with id, name, course_code, and enrollment state." },
      { name: "canvas_get_course", label: "Get Course", description: "Get details for a specific Canvas course by ID." },
      { name: "canvas_assignments", label: "Assignments", description: "List assignments for a course with id, name, due date, and points possible." },
      { name: "canvas_get_assignment", label: "Get Assignment", description: "Get details for a specific Canvas assignment." },
      { name: "canvas_announcements", label: "Announcements", description: "List announcements for Canvas courses." },
      { name: "canvas_grades", label: "Grades", description: "Get grade information for a course, including current score and enrollment details." },
      { name: "canvas_submissions", label: "Submissions", description: "List submissions for a Canvas assignment with score, grade, and attachments." },
      { name: "canvas_todo", label: "Todo", description: "Get your Canvas to-do list: upcoming assignments, quizzes, and items needing attention." },
      { name: "canvas_download_file", label: "Download File", description: "Download a file from Canvas LMS to local disk." },
    ],
  },
  {
    id: "linkedin",
    name: "LinkedIn",
    icon: Linkedin,
    color: "#0a66c2",
    tools: [
      { name: "linkedin_auth_setup", label: "LinkedIn Auth Setup", description: "Authenticate with LinkedIn via browser login and session cookie capture." },
      { name: "linkedin_profile", label: "My Profile", description: "Get the authenticated user's LinkedIn profile including name, headline, and picture." },
      { name: "linkedin_get_profile", label: "Get Profile", description: "Get any user's full profile by public identifier: experience, education, and skills." },
      { name: "linkedin_feed", label: "Feed", description: "Get posts from your LinkedIn feed with author info, content, and engagement metrics." },
      { name: "linkedin_connections", label: "Connections", description: "List your LinkedIn connections sorted by most recently added." },
      { name: "linkedin_conversations", label: "Conversations", description: "List your LinkedIn message conversations with participants and last message preview." },
      { name: "linkedin_messages", label: "Messages", description: "Get messages from a specific LinkedIn conversation by conversation URN." },
      { name: "linkedin_notifications", label: "Notifications", description: "List your LinkedIn notifications with headline text and timestamps." },
      { name: "linkedin_pending_invitations", label: "Pending Invitations", description: "List pending incoming connection requests." },
      { name: "linkedin_company", label: "Company Info", description: "Get detailed company information by universal name: description, industry, size, and more." },
      { name: "linkedin_search", label: "Search", description: "Search LinkedIn for people or companies." },
      { name: "linkedin_search_jobs", label: "Search Jobs", description: "Search for jobs on LinkedIn with title, company, location, and description." },
      { name: "linkedin_job_details", label: "Job Details", description: "Get full details of a job posting by its job ID." },
      { name: "linkedin_post_comments", label: "Post Comments", description: "Get comments on a specific LinkedIn feed post." },
      { name: "linkedin_profile_views", label: "Profile Views", description: "See who viewed your LinkedIn profile recently." },
      { name: "linkedin_saved_jobs", label: "Saved Jobs", description: "List your saved/bookmarked LinkedIn job postings." },
      { name: "linkedin_download_media", label: "Download Media", description: "Download a LinkedIn media file (image or video) to local disk." },
    ],
  },
  {
    id: "instagram",
    name: "Instagram",
    icon: Instagram,
    color: "#e1306c",
    tools: [
      { name: "instagram_auth_setup", label: "Instagram Auth Setup", description: "Authenticate with Instagram via browser login and session cookie capture." },
      { name: "instagram_profile", label: "My Profile", description: "Get your Instagram profile: username, bio, follower/following counts, and profile picture." },
      { name: "instagram_get_profile", label: "Get Profile", description: "Get any Instagram user's public profile by username." },
      { name: "instagram_feed", label: "Feed", description: "Get posts from your Instagram home feed with captions and engagement metrics." },
      { name: "instagram_user_posts", label: "User Posts", description: "Get recent posts from a specific Instagram user by username." },
      { name: "instagram_post_details", label: "Post Details", description: "Get detailed info about a specific post by shortcode or URL." },
      { name: "instagram_post_comments", label: "Post Comments", description: "Get comments on a specific Instagram post." },
      { name: "instagram_stories", label: "Stories", description: "Get stories from your feed or from a specific user." },
      { name: "instagram_search", label: "Search", description: "Search Instagram for users, hashtags, and places." },
      { name: "instagram_followers", label: "Followers", description: "Get followers of an Instagram user by username." },
      { name: "instagram_following", label: "Following", description: "Get accounts that a user is following by username." },
      { name: "instagram_saved", label: "Saved Posts", description: "Get your saved/bookmarked Instagram posts." },
      { name: "instagram_conversations", label: "DM Conversations", description: "List your Instagram Direct Message conversations." },
      { name: "instagram_messages", label: "DM Messages", description: "Get messages from a specific Instagram DM conversation." },
      { name: "instagram_reels", label: "Reels", description: "Get trending/popular Instagram Reels." },
      { name: "instagram_notifications", label: "Notifications", description: "List your Instagram activity notifications (likes, comments, follows, mentions)." },
      { name: "instagram_download_media", label: "Download Media", description: "Download an Instagram image or video to local disk." },
    ],
  },
  {
    id: "imessage",
    name: "iMessage",
    icon: MessageCircle,
    color: "#34c759",
    tools: [
      { name: "imessage_bb_auth_setup", label: "BlueBubbles Auth Setup", description: "Connect to a BlueBubbles server for cross-platform iMessage access." },
      { name: "imessage_contacts", label: "Contacts", description: "List known iMessage contacts (phone numbers and emails) from your Messages history." },
      { name: "imessage_chats", label: "Chats", description: "List recent iMessage conversations (1:1 and group chats)." },
      { name: "imessage_messages", label: "Messages", description: "Read messages from a specific iMessage conversation by chat identifier or phone number." },
      { name: "imessage_search", label: "Search", description: "Full-text search across all iMessage conversations." },
      { name: "imessage_send", label: "Send Message", description: "Send an iMessage to a phone number or email address." },
      { name: "imessage_attachments", label: "Attachments", description: "List file attachments (images, videos, documents) in an iMessage conversation." },
    ],
  },
  {
    id: "factor75",
    name: "Factor75",
    icon: ChefHat,
    color: "#7ac143",
    tools: [
      { name: "factor75_auth_setup", label: "Auth Setup", description: "Authenticate with Factor75 via browser automation and JWT token capture." },
      { name: "factor75_menu", label: "Menu", description: "Get the weekly Factor75 meal menu with names, descriptions, nutrition info, and dietary tags." },
      { name: "factor75_meal_details", label: "Meal Details", description: "Get full details for a specific meal — nutrition facts, ingredients, allergens, and prep instructions." },
      { name: "factor75_get_selections", label: "Selections", description: "Get current meal selections for a given week with slot counts and quantities." },
      { name: "factor75_select_meal", label: "Select Meal", description: "Add a meal to your selections for a given delivery week." },
      { name: "factor75_remove_meal", label: "Remove Meal", description: "Remove a meal from your selections for a given delivery week." },
      { name: "factor75_subscription", label: "Subscription", description: "Get subscription details — plan, status, meals per week, pricing, and next delivery." },
      { name: "factor75_skip_week", label: "Skip Week", description: "Skip a delivery week so it won't be charged or delivered." },
      { name: "factor75_pause", label: "Pause", description: "Pause your Factor75 subscription. No deliveries until resumed." },
      { name: "factor75_resume", label: "Resume", description: "Resume a paused Factor75 subscription from the next available week." },
      { name: "factor75_deliveries", label: "Deliveries", description: "List upcoming and recent deliveries with dates, statuses, and tracking info." },
      { name: "factor75_delivery_details", label: "Delivery Details", description: "Get full details for a specific delivery — tracking, meals, nutrition, and address." },
      { name: "factor75_account", label: "Account", description: "Get account info — name, email, delivery address, subscription plan, and credits." },
    ],
  },
];

/** Find the integration that owns a given tool name. */
export function findIntegrationForTool(toolName: string): Integration | undefined {
  return integrations.find((i) => i.tools.some((t) => t.name === toolName));
}

/** Find a Tool object by its tool name across all integrations. */
export function findToolByName(toolName: string): Tool | undefined {
  for (const integration of integrations) {
    const tool = integration.tools.find((t) => t.name === toolName);
    if (tool) return tool;
  }
  return undefined;
}
