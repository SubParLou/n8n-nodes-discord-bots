# Message Triggers

[&larr; Back to README](../README.md)

Triggers on new messages in guild channels or direct messages sent to the bot.

## Contents

- [New Channel Message](#new-channel-message)
- [New Direct Message](#new-direct-message)
- [Poll Vote Added / Removed](#poll-vote-added--removed)
- [Filters](#filters)
- [Pattern Options](#pattern-options)
- [Output Fields](#output-fields)

---

## New Channel Message

Fires when a message is posted in a guild text channel the bot can see.

**Available filters:** Guild, Channel, Role, Pattern, Case Sensitive, Trigger on Bot Messages

[^ Top](#message-triggers)

---

## New Direct Message

Fires when a user sends a direct message to the bot.

**Available filters:** Pattern, Case Sensitive, Trigger on Bot Messages

[^ Top](#message-triggers)

---

## Poll Vote Added / Removed

Fires when a user adds or removes a vote from a poll.

**Available filters:** Guild, Channel

**Output Fields (specific to polls):**
- `type`: `poll-vote-add` or `poll-vote-remove`
- `userId`: ID of the user who voted
- `username`: Username of the user
- `userGlobalName`: Global display name of the user
- `guildId`: ID of the guild
- `channelId`: ID of the channel
- `messageId`: ID of the message containing the poll
- `answerId`: ID of the answer chosen
- `answerText`: Text of the answer chosen
- `pollQuestion`: The question of the poll

[^ Top](#message-triggers)

---

## Filters

| Filter | Description |
|--------|-------------|
| Guild | Restrict to one or more guilds (channel messages only) |
| Channel | Restrict to one or more channels or parent categories (channel messages only) |
| Role | Only fire for messages from members holding at least one of the selected roles |
| Pattern | Content-matching rule (see [Pattern Options](#pattern-options)) |
| Case Sensitive | Whether the pattern match is case-sensitive (default: off) |
| Trigger on Bot Messages | Whether to also fire for messages from other bots (default: off) |

[^ Top](#message-triggers)

---

## Pattern Options

| Pattern | Description |
|---------|-------------|
| Every Message | Fire for every message regardless of content (default) |
| Bot Mentioned or Replied To | Fire when the bot is `@mentioned` directly **or** when the message is a reply to one of the bot's messages |
| Contains | Fire when the message contains the specified value |
| Equals | Fire when the message content exactly matches the value |
| Starts With | Fire when the message content starts with the value |
| Ends With | Fire when the message content ends with the value |
| Regex | Fire when the message content matches the regular expression |

[^ Top](#message-triggers)

---

## Output Fields

| Field | Description |
|-------|-------------|
| type | `channel-message` or `direct-message` |
| messageId | Snowflake ID of the message |
| content | Text content of the message |
| guildId | Guild ID, or `null` for DMs |
| channelId | Channel ID where the message was posted |
| userId | Discord ID of the message author |
| userDisplayName | Display name (server nickname > global name > username) |
| userGlobalName | Global display name, or `null` |
| userName | Username (the unique handle) |
| userTag | Discord tag (e.g. `User#0000`) |
| userAvatarUrl | URL of the author's avatar |
| memberDisplayName | Server-specific display name, or `null` for DMs |
| memberNickname | Server nickname, or `null` |
| memberRoleIds | Array of role IDs held by the member (excludes `@everyone`) |
| authorIsBot | Whether the author is a bot |
| createdTimestamp | Unix timestamp (ms) of the message |
| attachments | Array of attachment objects: `{ id, name, contentType, size, url }` |
| referencedMessage | If the message is a reply: `{ messageId, channelId, content, authorId, authorName, createdTimestamp }`. `null` if not a reply. If the original message was deleted: `{ messageId, channelId }`. |

[^ Top](#message-triggers)
