# Scheduled Events

[&larr; Back to README](../README.md)

Triggers and operations for guild scheduled events.

All triggers require the **GuildScheduledEvents** intent, which is automatically requested by the node.

## Contents

- [Triggers](#triggers)
  - [Scheduled Event Created](#scheduled-event-created)
  - [Scheduled Event Updated](#scheduled-event-updated)
  - [Scheduled Event Deleted](#scheduled-event-deleted)
- [Operations](#operations)
  - [Create Scheduled Event](#create-scheduled-event)
  - [Edit Scheduled Event](#edit-scheduled-event)
  - [Delete Scheduled Event](#delete-scheduled-event)
  - [List Scheduled Events](#list-scheduled-events)

---

## Triggers

**Optional filter for all triggers:** Guild

### Scheduled Event Created

Fires when a new scheduled event is created in a guild.

| Field | Description |
|-------|-------------|
| eventId | Discord ID of the scheduled event |
| eventName | Name of the event |
| guildId | Guild where the event was created |
| channelId | Voice or stage channel ID, or `null` for External events |
| creatorId | Discord ID of the user who created the event |
| description | Event description, or `null` |
| scheduledStartTime | ISO datetime when the event is scheduled to start |
| scheduledEndTime | ISO datetime when the event is scheduled to end, or `null` |
| status | Event status: `1`=Scheduled, `2`=Active, `3`=Completed, `4`=Canceled |
| entityType | `1`=Stage Channel, `2`=Voice Channel, `3`=External |
| location | Location string for External events, or `null` |
| userCount | Number of subscribed users, or `null` |
| url | Discord URL for the event |

[^ Top](#scheduled-events)

---

### Scheduled Event Updated

Fires when a scheduled event is modified (name change, status transition, time update, etc.).

| Field | Description |
|-------|-------------|
| eventId | Discord ID of the scheduled event |
| guildId | Guild where the event lives |
| oldName | Previous event name |
| newName | New event name |
| oldStatus | Previous status code |
| newStatus | New status code |
| oldScheduledStartTime | Previous start time |
| newScheduledStartTime | New start time |
| oldScheduledEndTime | Previous end time |
| newScheduledEndTime | New end time |
| channelId | Voice or stage channel ID, or `null` |
| entityType | `1`=Stage, `2`=Voice, `3`=External |
| description | Current description |
| location | Location string for External events, or `null` |
| url | Discord URL for the event |

[^ Top](#scheduled-events)

---

### Scheduled Event Deleted

Fires when a scheduled event is deleted from a guild.

| Field | Description |
|-------|-------------|
| eventId | Discord ID of the deleted event |
| eventName | Name of the event at time of deletion |
| guildId | Guild where the event was |
| channelId | Voice or stage channel ID, or `null` |
| status | Status at time of deletion |
| entityType | `1`=Stage, `2`=Voice, `3`=External |
| scheduledStartTime | Scheduled start time |
| scheduledEndTime | Scheduled end time, or `null` |
| location | Location string for External events, or `null` |

[^ Top](#scheduled-events)

---

## Operations

### Create Scheduled Event

Creates a new guild scheduled event.

| Parameter | Description |
|-----------|-------------|
| Guild ID | ID of the guild to create the event in |
| Event Name | Name of the event (max 100 characters) |
| Start Time | ISO 8601 datetime string (e.g. `2024-12-31T20:00:00Z`) |
| Entity Type | `Voice Channel`, `Stage Channel`, or `External Location` |
| Channel ID | ID of the voice or stage channel *(Voice/Stage events only)* |
| Location | Physical or virtual location description *(External events only)* |
| Additional Fields -> End Time | ISO 8601 end time. Required for External events |
| Additional Fields -> Description | Event description (max 1000 characters) |
| Additional Fields -> Image URL | URL of a cover image for the event |
| Additional Fields -> Reason | Reason recorded in the audit log |

**Output fields:** `eventId`, `eventName`, `guildId`, `channelId`, `entityType`, `status`, `scheduledStartTime`, `scheduledEndTime`, `description`, `url`

[^ Top](#scheduled-events)

---

### Edit Scheduled Event

Modifies an existing guild scheduled event. At least one field must be set.

| Parameter | Description |
|-----------|-------------|
| Guild ID | ID of the guild containing the event |
| Event ID | Discord ID of the scheduled event |
| Event Edit Fields -> Name | New event name |
| Event Edit Fields -> Start Time | New start time (ISO 8601) |
| Event Edit Fields -> End Time | New end time (ISO 8601) |
| Event Edit Fields -> Channel ID | Move event to a different voice or stage channel |
| Event Edit Fields -> Location | New location for External events |
| Event Edit Fields -> Description | New description |
| Event Edit Fields -> Image URL | New cover image URL |
| Event Edit Fields -> Status | `Scheduled` (1), `Active` (2), `Completed` (3), or `Canceled` (4) |
| Event Edit Fields -> Reason | Reason recorded in the audit log |

**Output fields:** `eventId`, `eventName`, `guildId`, `channelId`, `entityType`, `status`, `scheduledStartTime`, `scheduledEndTime`, `description`, `url`

[^ Top](#scheduled-events)

---

### Delete Scheduled Event

Deletes a guild scheduled event.

| Parameter | Description |
|-----------|-------------|
| Guild ID | ID of the guild containing the event |
| Event ID | Discord ID of the scheduled event |
| Reason | Reason recorded in the audit log (optional) |

**Output fields:** `operation`, `eventId`, `guildId`, `deleted`

[^ Top](#scheduled-events)

---

### List Scheduled Events

Fetches all scheduled events in a guild.

| Parameter | Description |
|-----------|-------------|
| Guild ID | ID of the guild to fetch events from |
| Include User Count | Whether to include subscriber counts for each event (default: true) |

**Output fields:** `operation`, `guildId`, `count`, `events` - array of event objects each containing `eventId`, `eventName`, `guildId`, `channelId`, `entityType`, `status`, `scheduledStartTime`, `scheduledEndTime`, `description`, `url`, `userCount`, `location`, `creatorId`

[^ Top](#scheduled-events)
