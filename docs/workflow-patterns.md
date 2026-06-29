# Workflow Patterns

[&larr; Back to README](../README.md)

Common workflow patterns and example setups using n8n-nodes-discord-bots.

## Contents

- [Slash Command Bot](#slash-command-bot)
- [DM Auto-Responder](#dm-auto-responder)
- [Button / Select Menu Interaction Handler](#button--select-menu-interaction-handler)
- [Context Menu Command Workflow](#context-menu-command-workflow)
- [Modal Form Submission](#modal-form-submission)
- [Reaction-Based Automation](#reaction-based-automation)
- [Native Poll with Vote Tracking](#native-poll-with-vote-tracking)
- [Layout Block Announcement](#layout-block-announcement)

---

## Slash Command Bot

1. Run `Discord Bot` -> **Register Slash Command** once on deploy (or in a setup workflow).
2. Add `Discord Bot Trigger` with event **Slash Command**. Set **Auto Acknowledge Interactions** to `true`.
3. Branch on `{{$json.commandName}}` to handle different commands.
4. Use `Discord Bot` -> **Respond to Interaction**:
   - `interactionId`: `{{$json.interactionId}}`
   - `interactionToken`: `{{$json.interactionToken}}`

See: [Command Registration](command-registration.md) | [Interaction Triggers](interaction-triggers.md) | [Interaction Responses](interaction-responses.md)

[^ Top](#workflow-patterns)

---

## DM Auto-Responder

1. `Discord Bot Trigger` with event **New Direct Message**.
2. Add AI or business logic nodes.
3. `Discord Bot` -> **Send Message** with target **User DM** and `userId` set to `{{$json.userId}}`.

See: [Message Triggers](message-triggers.md) | [Messaging Operations](messaging-operations.md)

[^ Top](#workflow-patterns)

---

## Button / Select Menu Interaction Handler

1. Send a message with `Discord Bot` -> **Send Message** including buttons via the Components builder.
2. `Discord Bot Trigger` with event **Component Interaction**. Set **Custom ID** to match the button's `custom_id`.
3. Use `Discord Bot` -> **Respond to Interaction** with the result content.
   - Use **Ephemeral** if the response should be private.

See: [Interaction Triggers](interaction-triggers.md) | [Interaction Responses](interaction-responses.md)

[^ Top](#workflow-patterns)

---

## Context Menu Command Workflow

1. Run `Discord Bot` -> **Register Context Menu Command** once on deploy.
   - Set **Command Type** to `User` (right-click on a member) or `Message` (right-click on a message).
2. `Discord Bot Trigger` with event **Context Menu Command**. Set **Auto Acknowledge Interactions** to `true`.
3. Branch on `{{$json.commandName}}` if you have multiple context menu commands.
4. Use `Discord Bot` -> **Respond to Interaction** with the result.

For User type: access `{{$json.targetUserId}}`, `{{$json.targetUserName}}`, `{{$json.targetMemberRoleIds}}`, etc.

For Message type: access `{{$json.targetMessageContent}}`, `{{$json.targetMessageAuthorId}}`, etc.

See: [Command Registration](command-registration.md) | [Interaction Triggers](interaction-triggers.md)

[^ Top](#workflow-patterns)

---

## Modal Form Submission

1. Trigger a slash command or button interaction (`Discord Bot Trigger`).
2. Enable **Auto Acknowledge Interactions** on the trigger so the 15-minute window is available.
3. Use `Discord Bot` -> **Send Modal** to open a modal form for the user:
   - Set **Custom ID** to a unique identifier (e.g. `feedback-modal`).
   - Add **Text Inputs** with their own `customId` values (e.g. `reason`, `details`).
4. Add a second `Discord Bot Trigger` with event **Modal Submit**. Set **Custom ID** to `feedback-modal`.
5. Access submitted field values via `{{$json.fields}}` — an array of `{ customId, value }` objects:
   - `{{ $json.fields.find(f => f.customId === 'reason').value }}`
6. Use `Discord Bot` -> **Respond to Interaction** to send the final response.

See: [Interaction Triggers](interaction-triggers.md) | [Interaction Responses](interaction-responses.md)

[^ Top](#workflow-patterns)

---

## Reaction-Based Automation

1. `Discord Bot Trigger` with event **Reaction Added**.
2. Optionally set **Message ID** and **Emoji Name** to narrow the filter.
3. Execute workflow logic based on `emojiName`, `userId`, and `channelId`.

See: [Member & Message Event Triggers](member-triggers.md)

[^ Top](#workflow-patterns)

---

## Native Poll with Vote Tracking

Send a poll and record every vote in a database or spreadsheet as they arrive.

1. **Send the poll** — `Discord Bot` -> **Send Message with Poll**:
   - Set **Poll Question** (e.g. `Which feature should we build next?`).
   - Add **Poll Answers** with text (and optional emoji) for each choice.
   - Set **Poll Duration** (hours) and optionally enable **Allow Multiselect**.
   - Save the `messageId` from the output (pin it or store it in a static data node).
2. **Track votes** — `Discord Bot Trigger` with event **Poll Vote Added**:
   - Filter by **Guild** and **Channel** to limit to the right poll channel.
   - Output includes `messageId`, `answerId`, `answerText`, `userId`, and `username`.
3. Connect to a **Google Sheets** or **Postgres** node to log each `{ userId, answerText, messageId }` row.
4. Optionally add a parallel `Discord Bot Trigger` for **Poll Vote Removed** to handle vote changes.

> Requires **Guild Message Polls** intent enabled in the Discord Developer Portal.

See: [Messaging Operations](messaging-operations.md) | [Message Triggers](message-triggers.md)

[^ Top](#workflow-patterns)

---

## Layout Block Announcement

Send a rich announcement using Discord Components v2 layout blocks instead of embeds.

1. `Discord Bot` -> **Send Message**.
2. Set **Message Payload Mode** -> `Builder`.
3. Add a **Section** block:
   - **Title**: `Deployment Complete`
   - **Content**: `Version **{{ $json.version }}** has been deployed to production.`
   - **Thumbnail URL**: your logo or status icon URL
4. Add a **Separator** (Type: `Horizontal`) to visually divide the announcement.
5. Add a **Container** block:
   - **Title**: `Details`
   - **Content**: `Environment: {{ $json.environment }}\nDuration: {{ $json.duration }}s`
   - **Accent Color**: `#57F287` (Discord green)
6. Optionally add a **Text Display** block with a footer note or runbook link.
7. Add **Buttons** (in the Buttons collection) for quick actions — e.g. `View Runbook` (Link style) and `Acknowledge` (Primary style with a custom ID).

> Embeds and layout blocks cannot coexist in the same message. Use one or the other.

See: [Messaging Operations](messaging-operations.md) | [Interaction Triggers](interaction-triggers.md)

[^ Top](#workflow-patterns)
