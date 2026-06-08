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

[^ Top](#messaging-operations)

---

## Examples

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
