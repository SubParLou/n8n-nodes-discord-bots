# n8n-nodes-discord-bots

n8n community node for building Discord bots:

- Trigger workflows from direct messages, channel messages, message reactions, slash commands, component interactions, and modal submissions.
- Send bot messages to channels or DMs.
- Edit existing bot messages.
- Register slash commands.
- Respond to Discord interactions from workflow data.
- Build rich messages with embeds, buttons, and select menus using a visual builder or raw JSON.

## Requirements

- n8n with community node support

## Install

### n8n Community Nodes (recommended)

1. In n8n go to **Settings > Community Nodes**.
2. Select **Install**.
3. Enter `n8n-nodes-discord-bots`.
4. Accept the risk notice and install.

### Manual install

In your n8n installation directory:

```bash
npm install n8n-nodes-discord-bots
```

## Discord bot setup

1. Create an app in the [Discord Developer Portal](https://discord.com/developers/applications).
2. Add a bot user under **Bot**.
3. Enable the following **Privileged Gateway Intents**:
   - **Message Content Intent** — required to read message body text
   - **Server Members Intent** — required only when using role filters
4. Invite the bot to your server using OAuth2 with scopes:
   - `bot`
   - `applications.commands`
5. Grant the bot the required permissions:
   - **Read Messages / View Channels**
   - **Send Messages**
   - **Read Message History**
   - **Add Reactions** (if using reaction events)
6. Create **Discord Bot API** credentials in n8n:
   - **Client ID** — from the OAuth2 section of your application
   - **Bot Token** — from the Bot section of your application

## Discord Bot Triggers

Listen for Discord events and starts an n8n workflow when they occur.

### Supported Triggers

| Trigger | Description |
|-------|-------------|
| New Channel Message | Triggered when a message is posted in a guild text channel |
| New Direct Message | Triggered when a user sends the bot a DM |
| Reaction Added | Triggered when a reaction is added to a message |
| Reaction Removed | Triggered when a reaction is removed from a message |
| Slash Command | Triggered when a user invokes a registered slash command |
| Component Interaction | Triggered when a user clicks a button or uses a select menu |
| Modal Submit | Triggered when a user submits a modal form |

---

### Operations

#### Send Message
Sends a message to a guild channel or a user DM.

| Parameter | Description |
|-----------|-------------|
| Target Type | `Channel` or `User DM` |
| Guild | Used to load available channels (channel target only) |
| Channel | Target text channel (channel target only) |
| User ID | Target user's Discord ID (DM target only) |
| Content | Plain text message body (optional if embeds or components are provided) |
| **Message Payload Mode** | Controls how embeds and components are built (see below) |

**Message Payload Mode options:**

| Mode | Description |
|------|-------------|
| **Builder** *(default)* | Fill out the visual Embed Builder and Button Builder fields. Raw JSON fields are hidden. |
| **Raw JSON** | Provide `Embeds JSON` and `Components JSON` directly as raw Discord API arrays. Existing workflows use this mode. |
| **Builder + Advanced JSON Merge** | Build from UI fields and also supply additional raw JSON embeds/components that are appended to the builder output. |

**Embed Builder fields** (available in Builder and Builder + Advanced JSON Merge modes):

Each embed supports: Title, Description, URL, Color (hex), Thumbnail Image URL, Image URL, Footer Text, Footer Icon URL, Author Name, Author URL, Author Icon URL, Timestamp (ISO 8601), and up to 25 named Embed Fields (Name, Value, Inline).

Discord limits: max 10 embeds per message, title ≤ 256 chars, description ≤ 4096 chars, footer text ≤ 2048 chars, author name ≤ 256 chars, field name ≤ 256 chars, field value ≤ 1024 chars.

**Button Builder fields** (available in Builder and Builder + Advanced JSON Merge modes):

Each button supports: Label, Style (Primary/Secondary/Success/Danger/Link), Custom ID, URL, Disabled, Emoji Name, Emoji ID, Emoji Animated.

- Buttons are **automatically grouped into action rows of up to 5** — max 5 rows × 5 buttons = **25 buttons** per message.
- **Link buttons** (Style = Link) require a **URL** and must **not** have a Custom ID.
- **Non-link buttons** require a **Custom ID** and must **not** have a URL.
- The node validates these rules before sending and throws a descriptive error if violated.

**String Select Menu Builder fields** (available in Builder and Builder + Advanced JSON Merge modes):

Dropdown menus with your own custom options. Each select menu occupies one action row.

| Field | Description |
|-------|-------------|
| Custom ID | Required. Unique identifier sent to your bot when a user makes a selection. |
| Placeholder | Greyed-out text shown before a selection is made (max 150 chars). |
| Min Values | Minimum number of options the user must pick (0–25, default 1). |
| Max Values | Maximum number of options the user can pick (1–25, default 1). |
| Disabled | Greys out the menu so it cannot be interacted with. |
| Select Options | Up to 25 options, each with a Label, Value, optional Description, and optional Emoji. |

**Auto-Populated Select Menu Builder fields** (available in Builder and Builder + Advanced JSON Merge modes):

Dropdowns that Discord fills automatically — no manual options needed. Four types are supported:

| Type | Description |
|------|-------------|
| User Select | Populated with server members |
| Role Select | Populated with server roles |
| Mentionable Select | Populated with both users and roles |
| Channel Select | Populated with channels, with optional channel-type filtering |

Each auto-populated select menu also supports Custom ID, Placeholder, Min/Max Values, and Disabled.

Discord limits for all components: max **5 action rows** per message. Each button group counts as one row (up to 5 buttons); each select menu occupies its own row.

Output: `{ operation, channelId, messageId, content }`

---

#### Update Message
Edits an existing message previously sent by the bot.

| Parameter | Description |
|-----------|-------------|
| Guild | Used to load available channels |
| Channel | Channel containing the message to edit |
| Message ID | The ID of the message to edit |
| Content | New plain text body (leave empty to clear; at least one of content, embeds, or components is required) |
| **Message Payload Mode** | Same three modes as Send Message (Builder, Raw JSON, Builder + Advanced JSON Merge) |

All Embed Builder, Button Builder, String Select Menu, and Auto-Populated Select Menu fields available in Send Message are also available here.

Output: `{ operation, channelId, messageId, content }`

---

### Send Message examples

#### Sending a simple embed (Builder mode)

1. Set **Message Payload Mode** → `Builder`.
2. Under **Embeds**, click **Add Embed**.
3. Fill in:
   - **Title**: `Hello from n8n!`
   - **Description**: `This embed was built without writing any JSON.`
   - **Color**: `#5865F2`
4. Execute the node — the embed appears in Discord.

#### Sending a message with buttons (Builder mode)

1. Set **Message Payload Mode** → `Builder`.
2. Under **Buttons**, click **Add Button**.
3. Fill in:
   - **Label**: `Approve`
   - **Style**: `Success (Green)`
   - **Custom ID**: `action_approve`
4. Add a second button:
   - **Label**: `Discord`
   - **Style**: `Link`
   - **URL**: `https://discord.com`
5. Both buttons appear in the same action row in Discord.

To listen for button clicks, use a **Discord Bot Trigger** node with event **Component Interaction** and set **Custom ID** to `action_approve`.

#### Using Raw JSON mode (advanced)

Set **Message Payload Mode** → `Raw JSON` and provide the embeds and components as raw Discord API arrays:

```json
// Embeds JSON
[
  {
    "title": "Alert",
    "description": "Something happened.",
    "color": 16711680
  }
]
```

```json
// Components JSON
[
  {
    "type": 1,
    "components": [
      { "type": 2, "style": 1, "label": "OK", "custom_id": "ack" }
    ]
  }
]
```

#### Builder + Advanced JSON Merge

Use **Builder + Advanced JSON Merge** when you want most of your embeds/components built visually but need to append a dynamically-constructed embed from an expression:

1. Set **Message Payload Mode** → `Builder + Advanced JSON Merge`.
2. Add a visual embed in the Embed Builder.
3. In **Embeds JSON**, paste or expression-build additional embeds to append.
4. The final message contains builder embeds first, followed by JSON embeds.



#### Register Slash Command
Registers or updates a slash command for the bot. Can be guild-scoped (instant) or global (up to 1 hour to propagate).

| Parameter | Description |
|-----------|-------------|
| Guild ID | Guild to register under. Leave empty to register as a global command. |
| Command Name | The slash command name — **1–32 characters, lowercase, letters/numbers/hyphens/underscores only, no spaces** |
| Command Description | Short description shown in Discord |
| Command Options (builder) | Visual builder for up to 25 options — fill in Option Name, Description, Type (String/Integer/Boolean/User/Channel/Role), and Required |
| Or Provide Raw JSON Instead | Advanced: JSON array of [command option objects](https://discord.com/developers/docs/interactions/application-commands#application-command-object-application-command-option-structure) — used when the builder does not meet your needs |

The visual builder takes precedence; the JSON field is used only when no options are added via the builder.

Output: `{ operation, commandId, commandName, scope, guildId }`

#### Respond to Interaction
Sends a response to a Discord slash command, button, select menu, or modal interaction. Must be called within 15 minutes of the interaction (3 seconds if not auto-acknowledged by the trigger).

| Parameter | Description |
|-----------|-------------|
| **Use Interaction Data From Input** | When enabled *(default)*, reads `interactionId` and `interactionToken` automatically from the incoming item (e.g. from Discord Bot Trigger output). Disable to enter them manually. |
| Interaction ID | `{{$json.interactionId}}` — only shown when *Use Interaction Data From Input* is off |
| Interaction Token | `{{$json.interactionToken}}` — only shown when *Use Interaction Data From Input* is off |
| Content | Plain text response body |
| **Message Payload Mode** | Controls how embeds and components are built — same three modes as Send Message (Builder, Raw JSON, Builder + Advanced JSON Merge) |
| Reply Embeds | Visual embed builder (shown in Builder and Builder + Advanced JSON Merge modes). Full field support: title, description, color, footer, author, thumbnail, image, embed fields, timestamp. |
| Embeds JSON | Raw JSON array of embed objects (shown in Raw JSON and Builder + Advanced JSON Merge modes) |
| Reply Components | Visual button builder (shown in Builder and Builder + Advanced JSON Merge modes). Buttons are auto-grouped into rows of 5. |
| String Select Menus | Dropdown menus with custom options (shown in Builder and Builder + Advanced JSON Merge modes). Same fields as in Send Message. |
| Auto-Populated Select Menus | User/Role/Mentionable/Channel selects (shown in Builder and Builder + Advanced JSON Merge modes). |
| Components JSON | Raw JSON array of action row component objects (shown in Raw JSON and Builder + Advanced JSON Merge modes) |
| Ephemeral | When true, the response is only visible to the user who triggered the interaction |

Output: `{ operation, interactionId, responded: true, responseType: 'initial' | 'follow-up' }`

> `responseType` is `'initial'` when the interaction has not yet been acknowledged, or `'follow-up'` when the trigger used auto-acknowledge and this node is sending the deferred follow-up.

---

## Typical workflow patterns

### Slash command bot

1. Run `Discord Bot` → **Register Slash Command** once on deploy (or in a setup workflow).
2. Add `Discord Bot Trigger` with event **Slash Command**. Set **Auto Acknowledge Interactions** to `true`.
3. Branch on `{{$json.commandName}}` to handle different commands.
4. Use `Discord Bot` → **Respond to Interaction**:
   - `interactionId`: `{{$json.interactionId}}`
   - `interactionToken`: `{{$json.interactionToken}}`

### DM auto-responder

1. `Discord Bot Trigger` with event **New Direct Message**.
2. Add AI or business logic nodes.
3. `Discord Bot` → **Send Message** with target **User DM** and `userId` set to `{{$json.userId}}`.

### Button / select menu interaction handler

1. Send a message with `Discord Bot` → **Send Message** including a `Components JSON` with action row buttons.
2. `Discord Bot Trigger` with event **Component Interaction**. Set **Custom ID** to match the button's `custom_id`.
3. Use `Discord Bot` → **Respond to Interaction** with the result content.
   - Use **Ephemeral** if the response should be private.

### Modal form submission

1. Respond to a slash command or button interaction by sending a modal using the Discord API (outside this node, via HTTP Request).
2. `Discord Bot Trigger` with event **Modal Submit**. Set **Custom ID** to match the modal's `custom_id`.
3. Access submitted values via `{{$json.fields}}` — array of `{ customId, value }`.
4. Use `Discord Bot` → **Respond to Interaction** to acknowledge.

### Reaction-based automation

1. `Discord Bot Trigger` with event **Reaction Added**.
2. Optionally set **Message ID** and **Emoji Name** to narrow the filter.
3. Execute workflow logic based on `emojiName`, `userId`, and `channelId`.

---

## Notes

- One Discord WebSocket connection is maintained per unique bot token. All n8n workflows that share the same credentials (same token) reuse that single connection — no matter how many trigger or action nodes reference it. To run a second independent bot, create a second Discord application and a second set of `Discord Bot API` credentials with its own token.
- Discord interaction responses must be sent within 3 seconds of receipt. Enable **Auto Acknowledge Interactions** on the trigger so the workflow has up to 15 minutes to respond via **Respond to Interaction**.
- Guild-scoped slash commands register instantly. Global commands can take up to 1 hour to appear in Discord.
- The **Message Content Intent** must be enabled in the Discord Developer Portal for the bot to receive message text in channel and DM events.

## Milestone Versions
- v1.1.0: Most of the triggers have been validated with exception of Component Interaction and Modal Submit.
- v1.0.0: Initial build and testing.
