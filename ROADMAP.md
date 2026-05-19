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
| Triggers: Voice State (join/leave/move between voice channels) | ✅ v1.3.0 |
| Triggers: Guild Scheduled Event created/updated/deleted | ✅ v1.4.0 |
| Actions: create/edit/delete/list guild scheduled events | ✅ v1.4.0 |
| Message components: embeds, buttons (all 5 styles), string select menus, auto-populated select menus (user/role/mentionable/channel) | ✅ |
| Message payload modes: visual builder, raw JSON, builder + JSON merge | ✅ |

---

## What Discord.js v14 offers that is not yet covered

### New Trigger Events
| Feature | discord.js event | n8n Feasibility | Milestone |
|---------|-----------------|-----------------|-----------|
| Context Menu Command Invoked (user or message right-click) | `interactionCreate` | ✅ Fully feasible — `interactionCreate` already handled | v1.6.0 |
| Poll Vote Added / Poll Vote Removed | `messagePollVoteAdd/Remove` | ✅ Fully feasible — needs `GuildMessagePolls` intent | v2.0.0 |


### New Operations — Channel & Role Management
| Feature | discord.js API | n8n Feasibility | Milestone |
|---------|---------------|-----------------|-----------|
| Create Channel | `guild.channels.create(options)` | ✅ Standard admin operation | v1.5.0 |
| Edit Channel | `channel.edit(options)` | ✅ Standard admin operation | v1.5.0 |
| Delete Channel | `channel.delete()` | ✅ Standard admin operation | v1.5.0 |
| Create Invite | `channel.createInvite(options)` | ✅ Returns invite URL to workflow | v1.5.0 |
| Create Role | `guild.roles.create(options)` | ✅ Standard admin operation | v1.5.0 |
| Edit Role | `role.edit(options)` | ✅ Standard admin operation | v1.5.0 |
| Delete Role | `role.delete()` | ✅ Standard admin operation | v1.5.0 |

### New Operations — Context Menu Commands
| Feature | discord.js API | n8n Feasibility | Milestone |
|---------|---------------|-----------------|-----------|
| Register User Context Menu Command | REST `ApplicationCommandType.User` | ✅ Same REST path as slash command registration | v1.6.0 |
| Register Message Context Menu Command | REST `ApplicationCommandType.Message` | ✅ Same REST path as slash command registration | v1.6.0 |

### New Operations — Bot Presence & Status
| Feature | discord.js API | n8n Feasibility | Milestone |
|---------|---------------|-----------------|-----------|
| Set Bot Status (online / idle / dnd / invisible) | `client.user.setPresence({ status })` | ✅ Simple single call | v1.7.0 |
| Set Bot Activity (Playing / Watching / Listening / Streaming / Competing) | `client.user.setActivity(options)` | ✅ Simple single call; Streaming requires a URL | v1.7.0 |

### New Message Features — Polls
| Feature | discord.js API | n8n Feasibility | Milestone |
|---------|---------------|-----------------|-----------|
| Send Message with a Poll | `message.poll` option in `channel.send()` | ✅ Fully supported in discord.js v14.19+; needs `GuildMessagePolls` intent | v2.0.0 |

### New Message Components — Discord Components v2
| Feature | discord.js API | n8n Feasibility | Milestone |
|---------|---------------|-----------------|-----------|
| Text Display (rich text block without an embed) | `TextDisplayBuilder` | ✅ Supported in discord.js v14.19.3; incompatible with embeds on the same message (Components v2 flag required) | v2.1.0 |
| Section (side-by-side thumbnail + text accessory) | `SectionBuilder` | ✅ Supported | v2.1.0 |
| Separator (visual divider between content blocks) | `SeparatorBuilder` | ✅ Supported | v2.1.0 |
| Container (grouped content block with optional accent color) | `ContainerBuilder` | ✅ Supported | v2.1.0 |
| Media Gallery (up to 10 images in a grid layout) | `MediaGalleryBuilder` | ✅ Supported | v2.1.0 |
| File (inline attachment display) | `FileBuilder` | ✅ Supported | v2.1.0 |

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
| ~~**v1.1.4**~~ | ~~High-Priority Operations & Triggers~~ | ~~Message management (delete, fetch, history, reactions, pin/unpin, bulk delete); Send Modal; Member management (roles, kick, ban, timeout, nickname); Triggers: member join/leave/update, message edit/delete, ban add/remove~~ **✅ Shipped** |
| ~~**v1.2.0**~~ | ~~Thread Management~~ | ~~Create, edit, delete threads; add/remove thread members; thread event triggers~~ **✅ Shipped** |
| ~~**v1.3.0**~~ | ~~Voice State Trigger~~ | ~~Trigger on users joining, leaving, or moving between voice channels~~ **✅ Shipped** |
| ~~**v1.4.0**~~ | ~~Guild Scheduled Events~~ | ~~Create/edit/delete/list scheduled events; scheduled event triggers~~ **✅ Shipped** |
| ~~**v1.5.0**~~ | ~~Channel & Role Management~~ | ~~Create/edit/delete channels and roles; create invites~~ **✅ Shipped** |
| **v1.6.0** | Context Menu Commands | Register user/message context menu commands; context menu interaction trigger |
| **v1.7.0** | Bot Presence & Status | Set bot online status and activity (Playing/Watching/Listening/Streaming/Competing) |
| **v2.0.0** | Message Polls | Send messages with native Discord polls; poll vote triggers |
| **v2.1.0** | Components v2 Layout Blocks | TextDisplay, Section, Separator, Container, MediaGallery, File components |
