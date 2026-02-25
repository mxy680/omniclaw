---
name: imessage
description: Read iMessage conversations, search messages, view attachments, and send messages via BlueBubbles.
metadata: {"openclaw": {"emoji": "💬"}}
---

# iMessage

Read conversations, search messages, view attachments, and send iMessages via a BlueBubbles server.

## First-Time Setup

This integration requires a [BlueBubbles](https://bluebubbles.app/) server running on a Mac.

1. **Install BlueBubbles** on a Mac that stays on and is signed into iMessage.
2. Configure the BlueBubbles server and note the **server URL** and **password** from the app dashboard.
3. Set up credentials using one of these methods:

   **Via plugin config (recommended):**
   ```
   openclaw config set plugins.entries.omniclaw.config.bluebubbles_url "http://your-server:1234"
   openclaw config set plugins.entries.omniclaw.config.bluebubbles_password "your_password"
   ```

   **Via the auth tool:**
   Use `imessage_bb_auth_setup` with the `url` and `password` parameters.

4. All iMessage tools are now available.

## Available Tools

- `imessage_bb_auth_setup` — Connect to a BlueBubbles server
- `imessage_contacts` — List known contacts (phone numbers and emails) from your Messages history
- `imessage_chats` — List recent conversations (1:1 and group chats)
- `imessage_messages` — Read messages from a specific conversation
- `imessage_search` — Full-text search across all messages
- `imessage_send` — Send an iMessage to a phone number or email
- `imessage_attachments` — List attachments (images, files, etc.) in a conversation

## Workflow

1. Use `imessage_bb_auth_setup` to connect to your BlueBubbles server (if not already configured).
2. Use `imessage_chats` to see your recent conversations.
3. Use `imessage_messages` with a `chat_id` to read messages from a conversation.
4. Use `imessage_search` to find messages containing specific text across all conversations.
5. Use `imessage_contacts` to look up a phone number or email.
6. Use `imessage_send` to send a message to someone.
7. Use `imessage_attachments` to see files shared in a conversation.

## Examples

- "Show my recent iMessage conversations" → `imessage_chats`
- "Read my messages with +15551234567" → `imessage_messages` with chat_id "+15551234567"
- "Search my messages for 'dinner reservation'" → `imessage_search` with query "dinner reservation"
- "Send 'On my way!' to +15551234567" → `imessage_send` with to and text
- "What files were shared in my group chat?" → `imessage_attachments` with the chat_id

## Error Handling

If tools return a connection error, verify your BlueBubbles server is running and credentials are correct.
If `imessage_send` fails, verify the recipient uses iMessage.
