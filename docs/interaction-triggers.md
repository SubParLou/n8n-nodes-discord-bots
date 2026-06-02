# Interaction Triggers

[&larr; Back to README](../README.md)

Triggers on Discord interactions - slash commands, button/select menu clicks, context menu (right-click) commands, and modal form submissions.

## Contents

- [Slash Command](#slash-command)
- [Component Interaction](#component-interaction)
- [Context Menu Command](#context-menu-command)
- [Modal Submit](#modal-submit)
- [Common Interaction Output Fields](#common-interaction-output-fields)
- [Auto Acknowledge Interactions](#auto-acknowledge-interactions)

---

## Slash Command

Fires when a user invokes a registered slash command. See [Command Registration](command-registration.md) for how to register slash commands.

**Filters:**

| Filter | Description |
|--------|-------------|
| Guild | Restrict to one or more guilds |
| Command Name | Only fire for a specific slash command name |
| Auto Acknowledge Interaction | Immediately acknowledge the interaction (extends response window to 15 minutes) |
| Acknowledge Ephemeral | Whether the deferred response is only visible to the invoking user |

**Output fields (plus [common fields](#common-interaction-output-fields)):**

| Field | Description |
|-------|-------------|
| type | `'slash-command'` |
| commandName | The name of the invoked slash command |
| commandId | Discord application command ID |
| options | Array of `{ name, value, type }` objects for provided command options |

[^ Top](#interaction-triggers)

---

## Component Interaction

Fires when a user clicks a button or uses a select menu.

**Filters:**

| Filter | Description |
|--------|-------------|
| Guild | Restrict to one or more guilds |
| Custom ID | Only fire for a specific `custom_id` value |
| Auto Acknowledge Interaction | Immediately acknowledge the interaction |
| Acknowledge Ephemeral | Whether the deferred response is ephemeral |

**Output fields (plus [common fields](#common-interaction-output-fields)):**

| Field | Description |
|-------|-------------|
| type | `'button'`, `'string-select'`, `'user-select'`, `'role-select'`, `'mentionable-select'`, or `'channel-select'` |
| customId | The `custom_id` value of the component |
| values | Array of selected values (select menus only) |

[^ Top](#interaction-triggers)

---

## Context Menu Command

Fires when a user right-clicks a guild member or message and selects a registered context menu command. See [Command Registration](command-registration.md) for how to register context menu commands.

**Filters:**

| Filter | Description |
|--------|-------------|
| Guild | Restrict to one or more guilds |
| Command Name | Only fire for a specific command name (exact match) |
| Command Type | `Any` (default), `User` (right-click on a member), or `Message` (right-click on a message) |
| Auto Acknowledge Interaction | Immediately acknowledge the interaction |
| Acknowledge Ephemeral | Whether the deferred response is ephemeral |

**Output fields common to all context menu types (plus [common fields](#common-interaction-output-fields)):**

| Field | Description |
|-------|-------------|
| type | `'context-menu-command'` |
| commandType | `'user'` or `'message'` |
| commandName | The name of the invoked command |
| commandId | Discord application command ID |

**Additional output for User type (right-click on a member):**

| Field | Description |
|-------|-------------|
| targetUserId | Discord user ID of the right-clicked member |
| targetUserName | Username of the right-clicked member |
| targetUserGlobalName | Global display name of the right-clicked member |
| targetUserAvatarUrl | Avatar URL of the right-clicked member |
| targetUserIsBot | Whether the right-clicked member is a bot |
| targetMemberDisplayName | Server display name (nickname if set, otherwise username) |
| targetMemberNickname | Server nickname (`null` if none) |
| targetMemberRoleIds | Array of role IDs assigned to the right-clicked member |

**Additional output for Message type (right-click on a message):**

| Field | Description |
|-------|-------------|
| targetMessageId | Discord message ID of the right-clicked message |
| targetMessageChannelId | Channel ID the right-clicked message is in |
| targetMessageContent | Text content of the right-clicked message |
| targetMessageAuthorId | Discord user ID of the message author |
| targetMessageAuthorName | Username of the message author |
| targetMessageAuthorGlobalName | Global display name of the message author |
| targetMessageCreatedTimestamp | Unix timestamp (ms) of when the message was sent |
| targetMessageAttachments | Array of attachment objects: `{ id, name, contentType, size, url }` |

[^ Top](#interaction-triggers)

---

## Modal Submit

Fires when a user submits a modal form.

**Filters:**

| Filter | Description |
|--------|-------------|
| Guild | Restrict to one or more guilds |
| Custom ID | Only fire for a specific modal `custom_id` value |
| Auto Acknowledge Interaction | Immediately acknowledge the interaction |
| Acknowledge Ephemeral | Whether the deferred response is ephemeral |

**Output fields (plus [common fields](#common-interaction-output-fields)):**

| Field | Description |
|-------|-------------|
| type | `'modal-submit'` |
| customId | The `custom_id` of the modal |
| fields | Array of `{ customId, value }` objects representing submitted field values |

[^ Top](#interaction-triggers)

---

## Common Interaction Output Fields

All interaction triggers include these base fields:

| Field | Description |
|-------|-------------|
| interactionId | Discord interaction ID - required for [Respond to Interaction](interaction-responses.md) |
| interactionToken | Interaction token - required for [Respond to Interaction](interaction-responses.md) |
| userId | Discord ID of the user who triggered the interaction |
| userDisplayName | Display name of the triggering user |
| userName | Username of the triggering user |
| userAvatarUrl | Avatar URL of the triggering user |
| guildId | Guild the interaction occurred in |
| channelId | Channel the interaction occurred in |
| memberRoleIds | Role IDs of the triggering member |

[^ Top](#interaction-triggers)

---

## Auto Acknowledge Interactions

Discord requires all interactions to be acknowledged within **3 seconds**. If your workflow takes longer, enable **Auto Acknowledge Interactions** on the trigger node.

When enabled, the trigger immediately sends a deferred acknowledgement and the workflow has up to 15 minutes to call [Respond to Interaction](interaction-responses.md) with the final content.

Use **Acknowledge Ephemeral** to make the loading state (and final response) only visible to the user who triggered the interaction.

[^ Top](#interaction-triggers)
