# Thread Management

[&larr; Back to README](../README.md)

Triggers and operations for Discord thread channels.

## Contents

- [Triggers](#triggers)
  - [Thread Created](#thread-created)
  - [Thread Updated](#thread-updated)
  - [Thread Deleted](#thread-deleted)
- [Operations](#operations)
  - [Create Thread from Message](#create-thread-from-message)
  - [Create Standalone Thread](#create-standalone-thread)
  - [Create Forum Post](#create-forum-post)
  - [Edit Thread](#edit-thread)
  - [Add Member to Thread](#add-member-to-thread)
  - [Remove Member from Thread](#remove-member-from-thread)

---

## Triggers

### Thread Created

Fires when a new thread is created. Only emits for freshly-created threads (not on bot restart).

**Optional filters:** Guild, Parent Channel

| Field | Description |
|-------|-------------|
| threadId | Snowflake ID of the new thread |
| threadName | Name of the thread |
| parentChannelId | ID of the parent channel |
| guildId | ID of the guild |
| threadType | Discord channel type integer (`11` = Public, `12` = Private, `10` = Announcement) |
| archived | Whether the thread started archived |
| locked | Whether the thread is locked |
| autoArchiveDuration | Minutes until auto-archive (60, 1440, 4320, or 10080) |
| ownerId | Discord ID of the user who created the thread |
| createdTimestamp | Unix timestamp (ms) of thread creation |
| memberCount | Approximate member count |
| messageCount | Approximate message count |

[^ Top](#thread-management)

---

### Thread Updated

Fires when a thread's properties change.

**Optional filters:** Guild, Parent Channel

| Field | Description |
|-------|-------------|
| threadId | Snowflake ID of the thread |
| oldName / newName | Thread name before and after the edit |
| oldArchived / newArchived | Archived state before and after |
| oldLocked / newLocked | Locked state before and after |
| autoArchiveDuration | Current auto-archive duration |
| memberCount | Approximate member count |

[^ Top](#thread-management)

---

### Thread Deleted

Fires when a thread is deleted.

**Optional filters:** Guild, Parent Channel

| Field | Description |
|-------|-------------|
| threadId | Snowflake ID of the deleted thread |
| threadName | Name of the thread at time of deletion |
| parentChannelId | ID of the parent channel |
| guildId | ID of the guild |

[^ Top](#thread-management)

---

## Operations

### Create Thread from Message

Creates a public thread attached to an existing message.

| Parameter | Description |
|-----------|-------------|
| Guild | Used to load available channels |
| Channel | Channel containing the source message |
| Message ID | ID of the message to start the thread from |
| Thread Name | Name for the new thread (1-100 characters) |
| Auto Archive Duration | Inactivity minutes before auto-archive: `60`, `1440` (1 day), `4320` (3 days), `10080` (1 week) |
| Slow Mode (seconds) | Per-user message cooldown (0-21600 seconds, 0 = disabled) |
| Reason | Audit log reason (optional) |

**Output:** `{ operation, threadId, threadName, parentChannelId, guildId }`

[^ Top](#thread-management)

---

### Create Standalone Thread

Creates a new thread in a channel without attaching it to a message. Supports public, private, and announcement threads.

| Parameter | Description |
|-----------|-------------|
| Guild | Used to load available channels |
| Channel | Parent channel |
| Thread Name | Name for the new thread (1-100 characters) |
| Thread Type | `Public Thread`, `Private Thread`, or `Announcement Thread` |
| Auto Archive Duration | Inactivity minutes before auto-archive: `60`, `1440`, `4320`, `10080` |
| Invitable | *(Private threads only)* Whether non-moderators can add other members |
| Slow Mode (seconds) | Per-user message cooldown (0-21600 seconds) |
| Reason | Audit log reason (optional) |

**Output:** `{ operation, threadId, threadName, parentChannelId, guildId, threadType }`

[^ Top](#thread-management)

---

### Create Forum Post

Creates a new post (thread) in a Forum or Media channel. Forum channels don't accept plain messages — every post starts a thread with an initial message, so this is the way to publish into one from a workflow.

| Parameter | Description |
|-----------|-------------|
| Guild | Used to load available forum/media channels |
| Forum Channel | The forum or media channel to post in |
| Post Title | Title of the new post (1-100 characters) |
| Content | Plain-text body of the starting message |
| Message Payload Mode | `Builder`, `Raw JSON`, or `Builder + Advanced JSON Merge` — same embed/component builders used by Send Message, for posts that need embeds or Components v2 layout blocks |
| Applied Tags | Optional tags configured on the forum channel, loaded from the selected channel |
| Auto Archive Duration | Inactivity minutes before auto-archive: `60`, `1440`, `4320`, `10080` |
| Slow Mode (seconds) | Per-user message cooldown (0-21600 seconds) |
| Reason | Audit log reason (optional) |

At least one of Content, an embed, or a component must be provided.

**Output:** `{ operation, threadId, threadName, parentChannelId, guildId, appliedTags, archived, autoArchiveDuration, createdTimestamp }`

[^ Top](#thread-management)

---

### Edit Thread

Updates properties of an existing thread. At least one field must be provided.

| Parameter | Description |
|-----------|-------------|
| Thread ID | ID of the thread to edit |
| Thread Edit Fields | One or more of: **Name**, **Archived**, **Locked**, **Auto Archive Duration**, **Slow Mode**, **Reason** |

**Output:** `{ operation, threadId, threadName }`

[^ Top](#thread-management)

---

### Add Member to Thread

Adds a user to an existing thread.

| Parameter | Description |
|-----------|-------------|
| Thread ID | ID of the thread |
| User ID | Discord snowflake ID of the user to add |

**Output:** `{ operation, threadId, userId }`

[^ Top](#thread-management)

---

### Remove Member from Thread

Removes a user from an existing thread.

| Parameter | Description |
|-----------|-------------|
| Thread ID | ID of the thread |
| User ID | Discord snowflake ID of the user to remove |

**Output:** `{ operation, threadId, userId }`

[^ Top](#thread-management)
