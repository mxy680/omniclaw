---
name: framer
description: Design and manage Framer projects — pages, components, collections, styles, publishing, and more.
metadata: {"openclaw": {"emoji": "🎨"}}
---

# Framer

Control Framer projects through the Server API using WebSocket connections. Manage pages, nodes, collections, styles, code files, redirects, localization, and publishing.

## First-Time Setup

1. Click **Connect Account** on the Framer integration in the web dashboard
2. Enter your Framer **Project URL** (e.g. `https://framer.com/projects/...`) and **API Key**
3. Credentials are stored locally

Alternatively, call `framer_auth_setup` directly from an agent conversation.

**Note:** The connection uses WebSocket with a 30-second idle timeout. Connections are re-established automatically when needed.

## Available Tools

### Auth & Project
- `framer_auth_setup` — Set up Framer credentials and validate the connection
- `framer_project_info` — Get project metadata
- `framer_publish_info` — Get publish/domain configuration
- `framer_changed_paths` — List paths changed since last publish

### Publishing & Deployment
- `framer_publish` — Publish the project
- `framer_deploy` — Deploy a specific deployment to domains
- `framer_deployments_list` — List all deployments

### Canvas Nodes (Read)
- `framer_node_get` — Get a node by ID
- `framer_node_children` — Get child nodes of a parent
- `framer_node_parent` — Get parent of a node
- `framer_nodes_by_type` — Find nodes by type (e.g. FrameNode, TextNode)
- `framer_nodes_by_attribute` — Find nodes by attribute name

### Canvas Nodes (Create)
- `framer_node_create_frame` — Create a frame container
- `framer_node_add_text` — Add a text node (h1–h6 or p)
- `framer_node_add_image` — Add an image from URL
- `framer_node_add_svg` — Add raw SVG markup
- `framer_node_add_component` — Add a component instance by module URL

### Canvas Nodes (Edit)
- `framer_node_set_attributes` — Update node attributes
- `framer_node_set_parent` — Move a node to a new parent
- `framer_node_clone` — Clone a node
- `framer_node_remove` — Delete a node

### Pages
- `framer_page_create_web` — Create a web page at a URL path
- `framer_page_create_design` — Create a design (non-routable) page

### CMS Collections
- `framer_collections_list` — List all collections
- `framer_collection_get` — Get collection details
- `framer_collection_create` — Create a collection
- `framer_collection_create_managed` — Create a managed (API-controlled) collection

### CMS Fields
- `framer_fields_list` — List fields in a collection
- `framer_field_add` — Add fields to a collection
- `framer_field_remove` — Remove fields from a collection

### CMS Items
- `framer_items_list` — List items in a collection
- `framer_item_create` — Add items to a collection
- `framer_item_update` — Update an item's attributes
- `framer_item_remove` — Remove items from a collection
- `framer_item_set_order` — Reorder items in a collection

### Code Files
- `framer_code_files_list` — List code override files
- `framer_code_file_get` — Read a code file's content
- `framer_code_file_create` — Create a new code file
- `framer_code_file_update` — Update a code file's content
- `framer_code_file_remove` — Delete a code file

### Styles
- `framer_color_styles_list` — List color styles
- `framer_color_style_create` — Create a color style
- `framer_color_style_update` — Update a color style
- `framer_color_style_remove` — Delete a color style
- `framer_text_styles_list` — List text styles
- `framer_text_style_create` — Create a text style
- `framer_text_style_update` — Update a text style
- `framer_text_style_remove` — Delete a text style

### Custom Code
- `framer_custom_code_get` — Get custom HTML/JS snippets
- `framer_custom_code_set` — Set custom code at a specific location (headStart, headEnd, bodyStart, bodyEnd)

### Redirects
- `framer_redirects_list` — List URL redirects
- `framer_redirect_add` — Add or update URL redirects (supports wildcards)
- `framer_redirect_remove` — Remove redirects by ID

### Localization
- `framer_locales_list` — List locales and default locale
- `framer_localization_groups` — List localization groups
- `framer_localization_update` — Update localized content

### Uploads
- `framer_upload_image` — Upload an image from URL
- `framer_upload_file` — Upload a file from URL

### Export
- `framer_export_html` — Export project as static HTML (no auth required)

## Workflow

1. Authenticate with `framer_auth_setup`
2. Explore the project with `framer_project_info` and `framer_nodes_by_type`
3. Create or modify content using node, page, collection, and style tools
4. Publish changes with `framer_publish`

## Examples

- "Show my Framer project info" → `framer_project_info`
- "Create a new page at /about" → `framer_page_create_web` with path "/about"
- "Add a heading to the canvas" → `framer_node_add_text` with text and tag "h1"
- "List all CMS collections" → `framer_collections_list`
- "Publish the project" → `framer_publish`
- "Set up a redirect from /old to /new" → `framer_redirect_add`
- "Upload this image" → `framer_upload_image` with URL
- "Export as static HTML" → `framer_export_html` with project URL

## Error Handling

- `auth_required` → Call `framer_auth_setup` to configure credentials
- `operation_failed` → Check the error message; the WebSocket connection may have dropped and will auto-reconnect on retry
