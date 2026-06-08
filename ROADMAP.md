# Discord.js Feature Gap Analysis & Roadmap

This document compares the current node capabilities against the full Discord.js v14 API surface, assesses n8n feasibility, and tracks planned milestones.

---

## What is currently covered

| Area | Covered |
|------|---------|
| Triggers: channel messages, DMs, reactions (add/remove), slash commands, component interactions, modal submissions | ✅ |
| Triggers: member joined/left/updated, message edited/deleted, ban added/removed | ✅ v1.1.4 |
| Actions: send message (channel + DM), update message, register slash command, respond to interaction | ✅ |
| Actions: delete message, fetch message, fetch history, add/remove reactions, pin/unpin, bulk delete | ✅ v1.1.4 |
| Actions: send modal to an interaction | ✅ v1.1.4 |
| Actions: add/remove roles, kick, ban, unban, timeout, fetch member, set nickname | ✅ v1.1.4 |
| Actions: Fetch Member now returns globalName, accountCreatedAt, serverAvatarUrl, isBoosting, boostingSince, userFlags, pending, status, clientStatus | ✅ v1.5.3 |
| Triggers: New Channel/DM Message — Bot Mentioned or Replied To pattern; referencedMessage field on all message events | ✅ v1.5.4 |
| Triggers: Voice State (join/leave/move between voice channels) | ✅ v1.3.0 |
| Triggers: Guild Scheduled Event created/updated/deleted | ✅ v1.4.0 |
| Actions: create/edit/delete/list guild scheduled events | ✅ v1.4.0 |
| Actions: register context menu commands (user & message types); Context Menu Command trigger | ✅ v1.6.0 |
| Actions: set bot status and activity (Playing/Watching/Listening/Streaming/Competing) | ✅ v1.7.0 |
| Actions: Send messages with native Discord polls; poll vote triggers | ✅ v1.8.0 |
| Message components: embeds, buttons (all 5 styles), string select menus, auto-populated select menus (user/role/mentionable/channel) | ✅ |
| Message payload modes: visual builder, raw JSON, builder + JSON merge | ✅ |

---

## What Discord.js v14 offers that is not yet covered

### New Message Components — Discord Layout Blocks (Components v2)
| Feature | discord.js API | n8n Feasibility | Milestone |
|---------|-----------------|-----------------|-----------|
| Text Display (rich text block without an embed) | `TextDisplayBuilder` | ✅ Supported in discord.js v14.19.3; Note: Cannot be mixed with embeds in the same message. | v1.9.0 |
| Section (side-by-side thumbnail + text accessory) | `SectionBuilder` | ✅ Supported | v1.9.0 |
| Separator (visual divider between content blocks) | `SeparatorBuilder` | ✅ Supported | v1.9.0 |
| Container (grouped content block with optional accent color) | `ContainerBuilder` | ✅ Supported | v1.9.0 |
| Media Gallery (up to 10 images in a grid layout) | `MediaGalleryBuilder` | ✅ Supported | v1.9.0 |
| File (inline attachment display) | `FileBuilder` | ✅ Supported | v1.9.0 |

### Features Not Feasible in n8n
| Feature | Why Not Feasible |
|---------|-----------------|
| Voice / Audio (join voice channel, play audio, TTS) | Requires real-time audio streaming maintained across node execution. n8n workflows are request/response and cannot sustain a streaming audio session. |
| Message Collectors / Await (collect N messages/reactions over time) | discord.js collectors are stateful, time-bounded listeners. n8n's event-driven trigger model is the correct pattern — each event fires a new workflow execution instead. |
| Typing Indicator (`channel.sendTyping()`) | Only useful when held continuously during processing. n8n node execution is not designed to emit keepalive signals mid-run. |
| Stage Channel Speaker Management | Extremely niche; requires voice connection infrastructure. |
| Gateway Presence / Rich Presence tracking | Requires `GuildPresences` privileged intent and produces very high event volume; unsuitable as a trigger without heavy filtering. |

---

## Planned Milestones

| Milestone | Title | Key Features |
|-----------|-------|-------------|
| **v1.9.0** | Components v2 Layout Blocks | TextDisplay, Section, Separator, Container, MediaGallery, File components |
