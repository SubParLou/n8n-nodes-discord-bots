# Member & Message Event Triggers

[&larr; Back to README](../README.md)

Triggers on guild member lifecycle events, ban actions, and message edits or deletions.

## Contents

- [Member Joined](#member-joined)
- [Member Left](#member-left)
- [Member Updated](#member-updated)
- [Ban Added](#ban-added)
- [Ban Removed](#ban-removed)
- [Message Edited](#message-edited)
- [Message Deleted](#message-deleted)

---

## Member Joined

Fires when a user joins the guild.

**Optional filters:** Guild

| Field | Description |
|-------|-------------|
| userId | Discord ID of the user who joined |
| userName | Username |
| userDisplayName | Display name |
| userGlobalName | Global display name, or `null` |
| userAvatarUrl | Avatar URL |
| userTag | Discord tag (e.g. `User#0000`) |
| guildId | ID of the guild |
| joinedTimestamp | Unix timestamp (ms) when the user joined |
| accountCreatedAt | ISO timestamp of when the Discord account was created |
| memberRoleIds | Array of role IDs (will be empty on join) |
| isBot | Whether the user is a bot |

[^ Top](#member--message-event-triggers)

---

## Member Left

Fires when a user leaves or is removed from the guild.

**Optional filters:** Guild

| Field | Description |
|-------|-------------|
| userId | Discord ID of the user who left |
| userName | Username |
| userDisplayName | Display name |
| userTag | Discord tag |
| userAvatarUrl | Avatar URL |
| guildId | ID of the guild |
| leftTimestamp | Unix timestamp (ms) of when the event was received |

[^ Top](#member--message-event-triggers)

---

## Member Updated

Fires when a guild member's roles, nickname, or other properties change.

**Optional filters:** Guild

| Field | Description |
|-------|-------------|
| userId | Discord ID of the member |
| userName | Username |
| guildId | ID of the guild |
| oldNickname | Previous nickname, or `null` |
| newNickname | New nickname, or `null` |
| oldRoleIds | Array of role IDs before the update |
| newRoleIds | Array of role IDs after the update |
| addedRoleIds | Roles that were added |
| removedRoleIds | Roles that were removed |

[^ Top](#member--message-event-triggers)

---

## Ban Added

Fires when a user is banned from the guild.

**Optional filters:** Guild

| Field | Description |
|-------|-------------|
| userId | Discord ID of the banned user |
| userName | Username |
| userTag | Discord tag |
| userAvatarUrl | Avatar URL |
| guildId | ID of the guild |

[^ Top](#member--message-event-triggers)

---

## Ban Removed

Fires when a user's ban is lifted.

**Optional filters:** Guild

| Field | Description |
|-------|-------------|
| userId | Discord ID of the unbanned user |
| userName | Username |
| userTag | Discord tag |
| userAvatarUrl | Avatar URL |
| guildId | ID of the guild |

[^ Top](#member--message-event-triggers)

---

## Message Edited

Fires when a message is edited.

**Optional filters:** Guild, Channel

| Field | Description |
|-------|-------------|
| messageId | Discord ID of the message |
| channelId | Channel ID |
| guildId | Guild ID, or `null` for DMs |
| oldContent | Message content before the edit, or `null` if not cached |
| newContent | Message content after the edit |
| authorId | Discord ID of the message author |
| authorName | Username of the author |
| editedTimestamp | Unix timestamp (ms) of the edit |

[^ Top](#member--message-event-triggers)

---

## Message Deleted

Fires when a message is deleted.

**Optional filters:** Guild, Channel

| Field | Description |
|-------|-------------|
| messageId | Discord ID of the deleted message |
| channelId | Channel ID |
| guildId | Guild ID, or `null` for DMs |
| content | Message content, or `null` if not cached |
| authorId | Discord ID of the author, or `null` if not cached |
| authorName | Username, or `null` if not cached |
| deletedTimestamp | Unix timestamp (ms) of when the deletion was received |

[^ Top](#member--message-event-triggers)
