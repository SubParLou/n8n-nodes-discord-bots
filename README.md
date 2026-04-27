# n8n-nodes-discord-bots

n8n community nodes for building Discord bots with:

- Triggering workflows from direct messages, channel messages, message reactions, slash commands, component interactions, and modal submissions.
- Sending bot messages to channels or DMs.
- Registering slash commands.
- Responding to Discord interactions from workflow data.

## Requirements

- n8n with community node support
- Node.js 22 or higher (for self-hosted installs)

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

## Nodes

### Discord Bot Trigger

Listens for Discord events and starts an n8n workflow when they occur.

#### Supported events

| Event | Description |
|-------|-------------|
| New Channel Message | Triggered when a message is posted in a guild text channel |
| New Direct Message | Triggered when a user sends the bot a DM |
| Reaction Added | Triggered when a reaction is added to a message |
| Reaction Removed | Triggered when a reaction is removed from a message |
| Slash Command | Triggered when a user invokes a registered slash command |
| Component Interaction | Triggered when a user clicks a button or uses a select menu |
| Modal Submit | Triggered when a user submits a modal form |

#### Filtering options

| Option | Applies to | Description |
|--------|-----------|-------------|
| Guild | All except Direct Message | Limit to specific guilds (leave empty for all) |
| Channel | Channel Message, Reaction Added/Removed | Limit to specific text channels |
| From Role | Channel Message, Reaction Added/Removed | Only trigger for members who have at least one of the selected roles |
| Pattern | Channel Message, Direct Message | Filter by message content: Every Message, Equals, Starts With, Contains, Ends With, Regex |
| Case Sensitive | Channel Message, Direct Message | Whether the pattern match is case-sensitive (default: false) |
| Message ID | Reaction Added/Removed | Only trigger for reactions on a specific message |
| Emoji Name | Reaction Added/Removed | Only trigger for a specific emoji (e.g. `thumbsup` or custom emoji name) |
| Slash Command Name | Slash Command | Only trigger for a specific command name |
| Custom ID | Component Interaction, Modal Submit | Only trigger for a specific button/select/modal custom ID |

#### Additional fields

| Field | Default | Description |
|-------|---------|-------------|
| Auto Acknowledge Interactions | true | Automatically defers the interaction reply so the workflow has time to complete before Discord's 3-second timeout |
| Acknowledge as Ephemeral | false | When auto-acknowledging, defers as an ephemeral (user-only visible) response |
| Trigger on Bot Messages | false | Whether to trigger when the message author is a bot |

#### Output payload

Each event type produces a JSON output object. Common fields across all events:

| Field | Description |
|-------|-------------|
| `userId` | Discord user ID who caused the event |
| `userName` | Discord username |
| `guildId` | Guild (server) ID, or null for DMs |
| `channelId` | Channel ID |
| `createdTimestamp` | Unix timestamp (milliseconds) of the event |

**Channel Message / Direct Message** adds:

| Field | Description |
|-------|-------------|
| `type` | `channel-message` or `direct-message` |
| `messageId` | Discord message ID |
| `content` | Message text content |
| `authorIsBot` | Whether the author is a bot |
| `attachments` | Array of attachment objects with `id`, `name`, `contentType`, `size`, `url` |

**Reaction Added / Reaction Removed** adds:

| Field | Description |
|-------|-------------|
| `type` | `reaction-add` or `reaction-remove` |
| `messageId` | ID of the message that was reacted to |
| `emojiName` | Emoji name (Unicode name or custom emoji name) |
| `emojiId` | Custom emoji ID, or null for Unicode emoji |
| `count` | Current total reaction count for that emoji |

**Slash Command** adds:

| Field | Description |
|-------|-------------|
| `type` | `slash-command` |
| `interactionId` | Interaction ID (required for Respond to Interaction) |
| `interactionToken` | Interaction token (required for Respond to Interaction) |
| `applicationId` | Bot application ID |
| `commandName` | Name of the slash command that was invoked |
| `commandId` | Discord command ID |
| `options` | Array of command option data provided by the user |

**Component Interaction** (button / select menu) adds:

| Field | Description |
|-------|-------------|
| `type` | `component-interaction` |
| `interactionId` | Interaction ID (required for Respond to Interaction) |
| `interactionToken` | Interaction token (required for Respond to Interaction) |
| `applicationId` | Bot application ID |
| `customId` | Custom ID set on the button or select menu |
| `componentType` | Discord component type number |
| `values` | Array of selected values (select menus only; empty for buttons) |
| `messageId` | ID of the message that contained the component |

**Modal Submit** adds:

| Field | Description |
|-------|-------------|
| `type` | `modal-submit` |
| `interactionId` | Interaction ID (required for Respond to Interaction) |
| `interactionToken` | Interaction token (required for Respond to Interaction) |
| `applicationId` | Bot application ID |
| `customId` | Custom ID set on the modal |
| `fields` | Array of `{ customId, value }` objects for each submitted form field |

---

### Discord Bot

Performs actions on a Discord bot. Requires **Discord Bot API** credentials.

#### Operation: Send Message

Sends a message to a guild channel or a user DM.

| Parameter | Description |
|-----------|-------------|
| Target Type | `Channel` or `User DM` |
| Guild | Used to load available channels (channel target only) |
| Channel | Target text channel (channel target only) |
| User ID | Target user's Discord ID (DM target only) |
| Content | Plain text message body (optional if embeds or components are provided) |
| Embeds JSON | JSON array of [Discord embed objects](https://discord.com/developers/docs/resources/message#embed-object) |
| Components JSON | JSON array of [action row objects](https://discord.com/developers/docs/interactions/message-components) containing buttons or select menus |

Output: `{ operation, channelId, messageId, content }`

#### Operation: Register Slash Command

Registers or updates a slash command for the bot. Can be guild-scoped (instant) or global (up to 1 hour to propagate).

| Parameter | Description |
|-----------|-------------|
| Guild ID | Guild to register under. Leave empty to register as a global command. |
| Command Name | The slash command name (lowercase, no spaces) |
| Command Description | Short description shown in Discord |
| Command Options JSON | JSON array of [command option objects](https://discord.com/developers/docs/interactions/application-commands#application-command-object-application-command-option-structure) |

Output: `{ operation, commandId, commandName, scope, guildId }`

#### Operation: Respond to Interaction

Sends a response to a Discord slash command, button, select menu, or modal interaction. Must be called within 15 minutes of the interaction (3 seconds if not auto-acknowledged by the trigger).

| Parameter | Description |
|-----------|-------------|
| Interaction ID | `{{$json.interactionId}}` from the trigger output |
| Interaction Token | `{{$json.interactionToken}}` from the trigger output |
| Content | Plain text response body |
| Embeds JSON | JSON array of embed objects |
| Components JSON | JSON array of action row component objects |
| Ephemeral | When true, the response is only visible to the user who triggered the interaction |

Output: `{ operation, interactionId, responded: true }`

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

## Development

```bash
npm install
npm run build   # compile TypeScript + copy icons
npm run lint    # run ESLint checks
npm run dev     # watch mode for TypeScript
```

---

## Notes

- One Discord WebSocket connection is maintained per unique bot token. All n8n workflows that share the same credentials (same token) reuse that single connection — no matter how many trigger or action nodes reference it. To run a second independent bot, create a second Discord application and a second set of `Discord Bot API` credentials with its own token.
- Discord interaction responses must be sent within 3 seconds of receipt. Enable **Auto Acknowledge Interactions** on the trigger so the workflow has up to 15 minutes to respond via **Respond to Interaction**.
- Guild-scoped slash commands register instantly. Global commands can take up to 1 hour to appear in Discord.
- The **Message Content Intent** must be enabled in the Discord Developer Portal for the bot to receive message text in channel and DM events.
