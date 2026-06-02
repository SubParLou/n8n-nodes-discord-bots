# Voice State

[&larr; Back to README](../README.md)

Trigger for voice channel activity in a guild.

---

## Voice State Update Trigger

Fires whenever a user's voice state changes in a guild - joining, leaving, moving between channels, or toggling mute/deafen/stream/video.

Requires the **Server Members Intent** to be enabled on your Discord bot.

**Optional filters:** Guild, Voice Channel (for `move` events, triggers if either the old or new channel matches)

### Subtype Values

| Subtype | When it fires |
|---------|---------------|
| `join` | User enters a voice channel from no channel |
| `leave` | User leaves a voice channel and is now in no channel |
| `move` | User moves from one voice channel to another |
| `update` | User stays in the same channel but changes mute/deafen/stream/video state |

### Output Fields

| Field | Description |
|-------|-------------|
| subtype | `join`, `leave`, `move`, or `update` |
| guildId | Guild where the event occurred |
| userId | Discord ID of the user |
| userName | Username of the user |
| userDisplayName | Display name (server nickname if set, otherwise global name or username) |
| userGlobalName | Global display name, or `null` |
| userTag | Discord tag (e.g. `User#0000`) |
| userAvatarUrl | URL of the user's avatar |
| memberNickname | Server nickname, or `null` |
| memberRoleIds | Array of role IDs held by the member (excludes `@everyone`) |
| oldChannelId | Voice channel ID the user was in before, or `null` |
| newChannelId | Voice channel ID the user is in now, or `null` |
| oldChannelName | Name of the previous voice channel, or `null` |
| newChannelName | Name of the current voice channel, or `null` |
| selfMute | Whether the user has muted themselves |
| selfDeaf | Whether the user has deafened themselves |
| serverMute | Whether the user has been server-muted by a moderator |
| serverDeaf | Whether the user has been server-deafened by a moderator |
| streaming | Whether the user is screen-sharing (Go Live) |
| selfVideo | Whether the user has their camera on |
