# Bot Presence & Status

[&larr; Back to README](../README.md)

Operations for updating the bot account's visible online status and activity text in Discord.

## Contents

- [Set Bot Status](#set-bot-status)
- [Set Bot Activity](#set-bot-activity)
- [Examples](#examples)

---

## Set Bot Status

Updates the bot's global online status.

| Parameter | Description |
|-----------|-------------|
| Status | `Online`, `Idle`, `Do Not Disturb`, or `Invisible` |

**Output:** `{ operation, status, botUserId, botTag }`

[^ Top](#bot-presence--status)

---

## Set Bot Activity

Sets the bot's visible activity text (for example, `Playing with n8n`).

| Parameter | Description |
|-----------|-------------|
| Activity Name | Activity text shown in Discord |
| Activity Type | `Playing`, `Watching`, `Listening`, `Streaming`, or `Competing` |
| Streaming URL | Required only when Activity Type is `Streaming` |

**Output:** `{ operation, activity: { name, type, url }, botUserId, botTag }`

[^ Top](#bot-presence--status)

---

## Examples

### Set bot status to Do Not Disturb

1. Set **Operation** -> `Set Bot Status`.
2. Set **Status** -> `Do Not Disturb`.
3. Execute the node.

### Set bot activity to Playing

1. Set **Operation** -> `Set Bot Activity`.
2. Set **Activity Type** -> `Playing`.
3. Set **Activity Name** -> `with n8n workflows`.
4. Execute the node.

### Set bot activity to Streaming

1. Set **Operation** -> `Set Bot Activity`.
2. Set **Activity Type** -> `Streaming`.
3. Set **Activity Name** -> `Live automations`.
4. Set **Streaming URL** -> `https://twitch.tv/yourchannel`.
5. Execute the node.

[^ Top](#bot-presence--status)