# Messaging Operations

[&larr; Back to README](../README.md)

The **Send Message** and **Update Message** operations for sending and editing Discord messages.

For responding to interactions (slash commands, buttons, context menus, modals), see [Interaction Responses](interaction-responses.md).

## Contents

- [Send Message](#send-message)
- [Update Message](#update-message)
- [Send Message with Poll](#send-message-with-poll)
- [Message Payload Modes](#message-payload-modes)
- [Embed Builder](#embed-builder)
- [Button Builder](#button-builder)
- [Select Menu Builder](#select-menu-builder)
- [Layout Block Builder](#layout-block-builder)
- [Examples](#examples)

---

## Send Message

Sends a message to a guild channel or a user DM.

| Parameter | Description |
|-----------|-------------|
| Target Type | `Channel` or `User DM` |
| Guild | Used to load available channels (channel target only) |
| Channel | Target text channel (channel target only) |
| User ID | Target user's Discord ID (DM target only) |
| Content | Plain text message body (optional if embeds or components are provided) |
| Message Payload Mode | Controls how embeds and components are built (see [Message Payload Modes](#message-payload-modes)) |

**Output:** `{ operation, channelId, messageId, content }`

[^ Top](#messaging-operations)

---

## Update Message

Edits an existing message previously sent by the bot.

| Parameter | Description |
|-----------|-------------|
| Guild | Used to load available channels |
| Channel | Channel containing the message to edit |
| Message ID | The ID of the message to edit |
| Content | New plain text body (leave empty to clear; at least one of content, embeds, or components is required) |
| Message Payload Mode | Same three modes as Send Message |

All builder fields available in Send Message are also available here.

**Output:** `{ operation, channelId, messageId, content }`

[^ Top](#messaging-operations)

---

## Send Message with Poll

Sends a message containing a native Discord poll. Note: You must enable the `Message Content` intent and `Guild Message Polls` intent in the Discord Developer Portal.

| Parameter | Description |
|-----------|-------------|
| Target Type | `Channel` or `User DM` |
| Guild | Used to load available channels |
| Channel | Target text channel (channel target only) |
| User ID | Target user's Discord ID (DM target only) |
| Poll Question | The main question for the poll |
| Poll Answers | A list of answers. Each answer requires `Text` and optional `Emoji`. |
| Poll Duration | How long the poll should last (default: 24 hours, max 31 days) |
| Allow Multiselect | Whether users can select more than one answer |

Polls also support `Content`, `Embeds`, and `Components` which will be displayed alongside the poll.

**Output:** `{ operation, channelId, messageId, content }`

[^ Top](#messaging-operations)

---

## Message Payload Modes

| Mode | Description |
|------|-------------|
| **Builder** *(default)* | Fill out the visual Embed Builder and Button Builder fields. Raw JSON fields are hidden. |
| **Raw JSON** | Provide `Embeds JSON` and `Components JSON` directly as raw Discord API arrays. |
| **Builder + Advanced JSON Merge** | Build from UI fields and also supply additional raw JSON embeds/components that are appended to the builder output. |

[^ Top](#messaging-operations)

---

## Embed Builder

Available in Builder and Builder + Advanced JSON Merge modes.

Each embed supports: Title, Description, URL, Color (hex), Thumbnail Image URL, Image URL, Footer Text, Footer Icon URL, Author Name, Author URL, Author Icon URL, Timestamp (ISO 8601), and up to 25 named Embed Fields (Name, Value, Inline).

**Discord limits:**

| Field | Limit |
|-------|-------|
| Embeds per message | max 10 |
| Title | max 256 chars |
| Description | max 4096 chars |
| Footer text | max 2048 chars |
| Author name | max 256 chars |
| Field name | max 256 chars |
| Field value | max 1024 chars |

[^ Top](#messaging-operations)

---

## Button Builder

Available in Builder and Builder + Advanced JSON Merge modes.

Each button supports: Label, Style (Primary / Secondary / Success / Danger / Link), Custom ID, URL, Disabled, Emoji Name, Emoji ID, Emoji Animated.

- Buttons are automatically grouped into action rows of up to 5 - max 5 rows x 5 buttons = 25 buttons per message.
- **Link buttons** (Style = Link) require a URL and must not have a Custom ID.
- **Non-link buttons** require a Custom ID and must not have a URL.
- The node validates these rules before sending and throws a descriptive error if violated.

**String Select Menus** - dropdown menus with custom options. Each select menu occupies one action row.

| Field | Description |
|-------|-------------|
| Custom ID | Required. Unique identifier sent to your bot when a user makes a selection. |
| Placeholder | Greyed-out text shown before a selection is made (max 150 chars). |
| Min Values | Minimum number of options the user must pick (0-25, default 1). |
| Max Values | Maximum number of options the user can pick (1-25, default 1). |
| Disabled | Greys out the menu so it cannot be interacted with. |
| Select Options | Up to 25 options, each with a Label, Value, optional Description, and optional Emoji. |

[^ Top](#messaging-operations)

---

## Select Menu Builder

Available in Builder and Builder + Advanced JSON Merge modes.

**Auto-Populated Select Menus** - dropdowns that Discord fills automatically; no manual options needed.

| Type | Description |
|------|-------------|
| User Select | Populated with server members |
| Role Select | Populated with server roles |
| Mentionable Select | Populated with both users and roles |
| Channel Select | Populated with channels, with optional channel-type filtering |

Each auto-populated select menu also supports Custom ID, Placeholder, Min/Max Values, and Disabled.

**Discord limits for all components:** max 5 action rows per message. Each button group counts as one row (up to 5 buttons); each select menu occupies its own row.

---

## Layout Block Builder

Available in Builder and Builder + Advanced JSON Merge modes.

Discord Components v2 layout blocks are rendered as top-level message components rather than embeds. They cannot be mixed with embeds — the node will reject the payload with a descriptive validation error if both are configured.

### Text Display

A standalone block of markdown text.

| Field | Description |
|-------|-------------|
| Content | Markdown-formatted text rendered as a top-level block |

### Section

A titled content block with an optional thumbnail image on the right.

| Field | Description |
|-------|-------------|
| Title | Section title text |
| Content | Section body text |
| Thumbnail URL | Optional image URL displayed as a small thumbnail accessory |

### Separator

A visual divider inserted between blocks.

| Field | Description |
|-------|-------------|
| Type | `Horizontal` (a line) or `Emoji` (an emoji character) |
| Emoji | Emoji to display — only shown when Type is `Emoji` |

### Container

A grouped content block with an optional colored left border.

| Field | Description |
|-------|-------------|
| Title | Container title text |
| Content | Container body text |
| Accent Color | Hex color for the container's left border (e.g. `#5865F2`) |

### Media Gallery

A gallery of up to 10 images displayed in a grid layout.

| Field | Description |
|-------|-------------|
| Image URLs → Image URL | URL of each image to include in the gallery. Click **Add Image** to add more. |

### File

An inline attachment block that renders a file reference from a Discord attachment URL.

| Field | Description |
|-------|-------------|
| File URL | Attachment URL (must be an existing Discord CDN attachment URL) |
| File Name | Optional display name shown under the attachment |

[^ Top](#messaging-operations)

---

## Examples

### Sending a layout block message (Builder mode)

1. Set **Message Payload Mode** -> `Builder`.
2. Under **Text Displays**, click **Add Text Display** and set **Content** to `Hello from Discord Components v2!`.
3. Under **Sections**, click **Add Section** and fill in **Title**: `Summary` and **Content**: `This section uses a layout block instead of an embed.`.
4. Under **Separators**, click **Add Separator** to insert a visual divider.
5. Under **Containers**, click **Add Container**, set **Title**: `Note`, **Content**: `Layout blocks cannot be combined with embeds in the same message.`, and choose an **Accent Color**.
6. Optional: add a **Media Gallery** or **File** block to include images or attachments.
7. Execute the node - the message is rendered as layout blocks in Discord.

> Note: If you also add content under **Embeds**, the node will reject the message because embeds and layout blocks are mutually exclusive.

### Sending a simple embed (Builder mode)

1. Set **Message Payload Mode** -> `Builder`.
2. Under **Embeds**, click **Add Embed**.
3. Fill in **Title**, **Description**, and **Color** (`#5865F2`).
4. Execute the node - the embed appears in Discord.

### Sending a message with buttons (Builder mode)

1. Set **Message Payload Mode** -> `Builder`.
2. Under **Buttons**, click **Add Button** and fill in:
   - **Label**: `Approve`, **Style**: `Success (Green)`, **Custom ID**: `action_approve`
3. Add a second button: **Label**: `Discord`, **Style**: `Link`, **URL**: `https://discord.com`
4. Both buttons appear in the same action row in Discord.

To listen for button clicks, add a **Discord Bot Trigger** with event **Component Interaction** and set **Custom ID** to `action_approve`.

### Using Raw JSON mode

Set **Message Payload Mode** -> `Raw JSON` and provide the embeds and components as raw Discord API arrays:

```json
[
  {
    "title": "Alert",
    "description": "Something happened.",
    "color": 16711680
  }
]
```

```json
[
  {
    "type": 1,
    "components": [
      { "type": 2, "style": 1, "label": "OK", "custom_id": "ack" }
    ]
  }
]
```

### Builder + Advanced JSON Merge

Use this mode when you want most of your embeds/components built visually but need to append a dynamically-constructed embed from an expression:

1. Set **Message Payload Mode** -> `Builder + Advanced JSON Merge`.
2. Add a visual embed in the Embed Builder.
3. In **Embeds JSON**, paste or expression-build additional embeds to append.
4. The final message contains builder embeds first, followed by JSON embeds.

[^ Top](#messaging-operations)
