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

1. Respond to a slash command or button interaction by sending a modal using the Discord API (outside this node, via HTTP Request node).
2. `Discord Bot Trigger` with event **Modal Submit**. Set **Custom ID** to match the modal's `custom_id`.
3. Access submitted values via `{{$json.fields}}` - array of `{ customId, value }`.
4. Use `Discord Bot` -> **Respond to Interaction** to acknowledge.

See: [Interaction Triggers](interaction-triggers.md) | [Interaction Responses](interaction-responses.md)

[^ Top](#workflow-patterns)

---

## Reaction-Based Automation

1. `Discord Bot Trigger` with event **Reaction Added**.
2. Optionally set **Message ID** and **Emoji Name** to narrow the filter.
3. Execute workflow logic based on `emojiName`, `userId`, and `channelId`.

See: [Member & Message Event Triggers](member-triggers.md)

[^ Top](#workflow-patterns)
