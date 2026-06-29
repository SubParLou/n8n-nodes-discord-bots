# Command Registration

[&larr; Back to README](../README.md)

Operations for registering Discord application commands with the bot. Commands can be registered as guild-scoped (instant propagation) or global (up to 1 hour to appear).

For triggering on command invocations, see [Interaction Triggers](interaction-triggers.md).

## Contents

- [Register Slash Command](#register-slash-command)
- [Delete Slash Command](#delete-slash-command)
- [List Slash Commands](#list-slash-commands)
- [Register Context Menu Command](#register-context-menu-command)

---

## Register Slash Command

Registers or updates a slash command for the bot.

| Parameter | Description |
|-----------|-------------|
| Guild ID | Guild to register under. Leave empty to register as a global command. |
| Command Name | **1-32 characters, lowercase, letters/numbers/hyphens/underscores only, no spaces** |
| Command Description | Short description shown in Discord |
| Command Options (builder) | Visual builder for up to 25 options - fill in Option Name, Description, Type (String/Integer/Boolean/User/Channel/Role), and Required |
| Or Provide Raw JSON Instead | Advanced: JSON array of [command option objects](https://discord.com/developers/docs/interactions/application-commands#application-command-object-application-command-option-structure) - used when the builder does not meet your needs |

The visual builder takes precedence; the JSON field is used only when no options are added via the builder.

**Output:** `{ operation, commandId, commandName, scope, guildId }`

> Guild-scoped commands register instantly. Global commands can take up to 1 hour to appear in Discord.

[^ Top](#command-registration)

---

## Delete Slash Command

Removes a previously registered slash command. Use this in teardown workflows or when a command is being renamed or retired.

| Parameter | Description |
|-----------|-------------|
| Command ID | The Discord application command ID to delete (returned by **Register Slash Command** as `commandId`) |
| Guild ID | Guild the command was registered under. Leave empty for a global command. |

**Output:** `{ operation, commandId, scope, guildId }`

> To find the command ID of an existing command, use **List Slash Commands** first.

[^ Top](#command-registration)

---

## List Slash Commands

Returns all slash commands currently registered to the bot, optionally scoped to a guild.

| Parameter | Description |
|-----------|-------------|
| Guild ID | Restrict listing to commands in this guild. Leave empty to list global commands. |

**Output:** Array of `{ id, name, description, type, guild_id? }` objects — one item per registered command.

[^ Top](#command-registration)

---

## Register Context Menu Command

Registers a context menu command (right-click action) for the bot. Context menu commands appear in the right-click menu on users or messages - they have no description or parameters.

| Parameter | Description |
|-----------|-------------|
| Command Type | **User** - appears in the right-click menu on a guild member; **Message** - appears in the right-click menu on a message |
| Command Name | **1-32 characters**, can include spaces and mixed case (unlike slash commands) |
| Guild ID | Guild to register under. Leave empty to register as a global command. |

**Output:** `{ operation, commandId, commandName, commandType, scope, guildId }`

> Context menu command names support spaces and mixed case (e.g. `Report User`, `Translate Message`).

[^ Top](#command-registration)
