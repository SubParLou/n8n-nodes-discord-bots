# n8n-nodes-discord-bots

n8n community node for building Discord bots using [discord.js](https://discord.js.org/).

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

## Discord Bot Setup

1. Create an app in the [Discord Developer Portal](https://discord.com/developers/applications).
2. Add a bot user under **Bot**.
3. Enable the following **Gateway Intents**:
   - **Message Content Intent** (Privileged) - required to read message body text
   - **Server Members Intent** (Privileged) - required to use role filters and the Fetch Member action
   - **Presence Intent** (Privileged) - required for `status` and `clientStatus` fields on the Fetch Member action
   - **Guild Message Polls** - required for poll vote triggers
4. Invite the bot to your server using OAuth2 with scopes:
   - `bot`
   - `applications.commands`
5. Grant the bot the required permissions:
   - **Read Messages / View Channels**
   - **Send Messages**
   - **Send Polls** (if using poll operations)
   - **Read Message History**
   - **Add Reactions** (if using reaction events)
6. Create **Discord Bot API** credentials in n8n:
   - **Client ID** - from the OAuth2 section of your application
   - **Bot Token** - from the Bot section of your application

---

## Features

| Feature Area | Description |
|---|---|
| [Message Triggers](docs/message-triggers.md) | Trigger on new channel messages, DMs, or poll votes |
| [Interaction Triggers](docs/interaction-triggers.md) | Trigger on slash commands, button/select interactions, context menu commands, and modal submissions |
| [Member & Message Event Triggers](docs/member-triggers.md) | Trigger on member join/leave/update, bans, and message edits/deletes |
| [Messaging Operations](docs/messaging-operations.md) | Send and update messages with a visual builder or raw JSON - supports embeds, buttons, select menus, and polls |
| [Command Registration](docs/command-registration.md) | Register slash commands and context menu (right-click) commands, guild-scoped or global |
| [Interaction Responses](docs/interaction-responses.md) | Respond to slash commands, buttons, select menus, context menus, and modal submissions |
| [Thread Management](docs/thread-management.md) | Create, edit, and manage threads; triggers for thread creation, updates, and deletion |
| [Voice State](docs/voice-state.md) | Trigger on users joining, leaving, moving between, or changing state in voice channels |
| [Scheduled Events](docs/scheduled-events.md) | Create, edit, delete, and list guild scheduled events; triggers for event lifecycle |
| [Bot Presence & Status](docs/bot-presence-status.md) | Set bot online status and activity text (Playing/Watching/Listening/Streaming/Competing) |
| [Workflow Patterns](docs/workflow-patterns.md) | Common workflow patterns and example setups |

---

## Notes

- One Discord WebSocket connection is maintained per unique bot token. All n8n workflows sharing the same credentials reuse that single connection. To run a second independent bot, create a second Discord application with its own token.
- Discord interaction responses must be sent within 3 seconds of receipt. Enable **Auto Acknowledge Interactions** on the trigger so the workflow has up to 15 minutes to respond via **Respond to Interaction**.
- Guild-scoped slash commands register instantly. Global commands can take up to 1 hour to appear in Discord.
- The **Message Content Intent** must be enabled in the Discord Developer Portal for the bot to receive message text.

---

## Telemetry

This node includes a minimal telemetry feature to help me understand how many active installations and updates occur.

### What is collected?
- **Version**: The version of the node currently installed.
- **Node Type**: Whether it's the regular node or the trigger node.
- **Instance ID**: A persistent, anonymous unique identifier stored locally in your n8n configuration directory (`~/.n8n/n8n-nodes-discord-bots-telemetry.json`).

### Privacy
- **No private data** (credentials, message content, guild IDs, user IDs, etc.) is ever collected.
- **Respects opt-out**: You can disable telemetry at any time in the **Discord Bot API** credential settings.
- **Minimal impact**: Telemetry only pings the server once per version update. It does **not** ping every time a workflow runs.

---

## Changelog

| Version | Highlights |
|---|---|
| **v1.8.0** | Message Polls - send native polls and trigger on poll votes |
| **v1.7.0** | Bot Presence & Status - set bot online status and activity text |
| **v1.6.1** | Docs restructure - slim README with feature-area sub-docs; encoding fixes |
| **v1.6.0** | Context Menu Commands - register and trigger on right-click user/message commands |
| **v1.5.4** | Reply features - Bot Mentioned or Replied To pattern; `referencedMessage` field on message events |
| **v1.5.3** | Fetch Member enhancements - `globalName`, `accountCreatedAt`, presence data, and more |
| **v1.5.2** | AI Tool support - Discord Bot node exposed as an n8n AI Agent tool |
| **v1.5.0** | Channel & Role Management - 7 new operations |
| **v1.4.0** | Guild Scheduled Events - triggers and CRUD operations |
| **v1.3.0** | Voice State Trigger |
| **v1.2.0** | Thread Management - triggers and operations |
| **v1.1.4** | Message management, Send Modal, Member management, member/message triggers |

See [ROADMAP.md](ROADMAP.md) for the full feature gap analysis and upcoming milestone planning.
