# LinkedIn Write Tools Design

**Date**: 2026-02-27
**Status**: Approved

## Overview

Add 6 write/action tools to the LinkedIn integration, bringing the total from 16 (read-only + auth) to 22 tools. All tools follow the existing factory pattern and use the LinkedIn Voyager API through the `LinkedInClientManager`.

## Infrastructure Change

### Add `post()` and `delete()` to `LinkedInClientManager`

The client manager (`src/auth/linkedin-client-manager.ts`) currently only has `get()` and `getPaginated()`. Write tools need POST and DELETE HTTP methods.

**`post(account, path, body, params?, rawQs?)`** — mirrors `get()` but with:
- `method: "POST"` in the fetch call
- `Content-Type: application/json` header
- JSON-serialized request body

**`delete(account, path, params?, rawQs?)`** — mirrors `get()` but with `method: "DELETE"`.

Both reuse the same Playwright browser context pattern, cookie/CSRF auth, and error handling as `get()`.

## New Tools

### 1. `linkedin_send_message` — `src/tools/linkedin-send-message.ts`

Send a direct message to a LinkedIn connection.

**Parameters:**
- `recipient_urn` (string, required) — Profile URN of the recipient (from search/connections results)
- `text` (string, required) — Message text
- `account` (string, optional) — Account name, defaults to "default"

**API:** POST to Voyager messaging endpoint. Uses the messaging GraphQL mutation or REST create-message endpoint. Resolves the sender's mailbox URN (same pattern as `linkedin_conversations`), then sends the message to the recipient.

### 2. `linkedin_send_connection_request` — `src/tools/linkedin-connection-request.ts`

Send a connection request (invitation) to another LinkedIn user.

**Parameters:**
- `profile_urn` (string, required) — Target user's profile URN
- `message` (string, optional) — Personalization note (max 300 characters)
- `account` (string, optional) — Account name, defaults to "default"

**API:** POST to `relationships/invitations` with invitation type `MEMBER_TO_MEMBER`.

### 3. `linkedin_respond_invitation` — `src/tools/linkedin-respond-invitation.ts`

Accept or decline a pending connection request.

**Parameters:**
- `invitation_urn` (string, required) — Invitation URN from `linkedin_pending_invitations`
- `action` (string, required) — "accept" or "decline"
- `account` (string, optional) — Account name, defaults to "default"

**API:**
- Accept: POST/PUT to invitation accept endpoint
- Decline: DELETE/PUT to invitation decline endpoint

### 4. `linkedin_create_post` — `src/tools/linkedin-create-post.ts`

Create a new LinkedIn post with optional image attachment.

**Parameters:**
- `text` (string, required) — Post content
- `image_path` (string, optional) — Local file path to an image to attach
- `image_url` (string, optional) — URL of an image to attach (downloaded then uploaded)
- `visibility` (string, optional) — "public" (default) or "connections"
- `account` (string, optional) — Account name, defaults to "default"

**API flow:**
1. **Text-only:** Single POST to UGC/shares endpoint with text content
2. **With image:**
   - Register an image upload with Voyager to get an upload URL + media URN
   - Upload the image binary to the upload URL
   - Create the post referencing the media URN

**Returns:** The created post/activity URN.

### 5. `linkedin_react_to_post` — `src/tools/linkedin-react.ts`

React to a feed post (like, celebrate, etc.).

**Parameters:**
- `activity_urn` (string, required) — Activity/update URN from `linkedin_feed`
- `reaction_type` (string, optional) — One of: "LIKE" (default), "CELEBRATE", "SUPPORT", "LOVE", "INSIGHTFUL", "FUNNY"
- `account` (string, optional) — Account name, defaults to "default"

**API:** POST to `voyagerSocialDashReactions` endpoint with the reaction type and activity URN.

### 6. `linkedin_comment_on_post` — `src/tools/linkedin-comment.ts`

Add a comment to a feed post.

**Parameters:**
- `activity_urn` (string, required) — Activity/update URN from `linkedin_feed`
- `text` (string, required) — Comment text
- `account` (string, optional) — Account name, defaults to "default"

**API:** POST to `voyagerSocialDashComments` endpoint.

**Returns:** The created comment URN.

## File Summary

| File | Action | Description |
|------|--------|-------------|
| `src/auth/linkedin-client-manager.ts` | Modify | Add `post()` and `delete()` methods |
| `src/tools/linkedin-send-message.ts` | Create | Send DM tool |
| `src/tools/linkedin-connection-request.ts` | Create | Send connection request tool |
| `src/tools/linkedin-respond-invitation.ts` | Create | Accept/decline invitation tool |
| `src/tools/linkedin-create-post.ts` | Create | Create post (text + optional image) tool |
| `src/tools/linkedin-react.ts` | Create | React to post tool |
| `src/tools/linkedin-comment.ts` | Create | Comment on post tool |
| `src/plugin.ts` | Modify | Register 6 new tools |
| `skills/linkedin.SKILL.md` | Modify | Add new tools to docs |
| `docs/linkedin.md` | Modify | Add new tools to docs |
| `CLAUDE.md` | Modify | Update tool count (17 -> 23) |
