import {
  ChannelType,
  type Interaction,
  type Message,
} from 'discord.js';
import type {
  ILoadOptionsFunctions,
  INodePropertyOptions,
  INodeType,
  INodeTypeDescription,
  ITriggerFunctions,
  ITriggerResponse,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import {
  addClientListener,
  getIsolatedClient,
  loadChannelOptions,
  loadGuildOptions,
  loadRoleOptions,
} from './clientManager';
import type { DiscordBotCredentials } from './types';

type TriggerType =
  | 'channel-message'
  | 'direct-message'
  | 'reaction-add'
  | 'reaction-remove'
  | 'slash-command'
  | 'component-interaction'
  | 'modal-submit';

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function logNonCriticalError(context: string, error: unknown, details: Record<string, string | null> = {}): void {
  const message = getErrorMessage(error);
  console.warn(`[DiscordBotTrigger] ${context}: ${message}`, details);
}

function normalizeSlashCommandName(value: string): string {
  return value.trim().replace(/^\//, '').toLowerCase();
}

function isPotentiallyUnsafeRegex(pattern: string): boolean {
  if (pattern.length > 128) {
    return true;
  }

  // Backreferences and nested quantifiers are common sources of catastrophic backtracking.
  if (/\\[1-9]/.test(pattern)) {
    return true;
  }

  if (/\((?:[^()\\]|\\.)*[+*](?:[^()\\]|\\.)*\)\s*(?:[+*]|\{)/.test(pattern)) {
    return true;
  }

  return false;
}

function buildMemberInfo(
  memberLike: unknown,
): { memberDisplayName: string | null; memberNickname: string | null; memberRoleIds: string[] } {
  if (!memberLike || typeof memberLike !== 'object') {
    return {
      memberDisplayName: null,
      memberNickname: null,
      memberRoleIds: [],
    };
  }

  const member = memberLike as {
    displayName?: unknown;
    nickname?: unknown;
    nick?: unknown;
    roles?: unknown;
  };

  const memberDisplayName = typeof member.displayName === 'string' ? member.displayName : null;
  const memberNickname =
    typeof member.nickname === 'string'
      ? member.nickname
      : typeof member.nick === 'string'
        ? member.nick
        : null;

  let memberRoleIds: string[] = [];
  if (Array.isArray(member.roles)) {
    memberRoleIds = member.roles.filter((id): id is string => typeof id === 'string');
  } else if (
    member.roles &&
    typeof member.roles === 'object' &&
    'cache' in member.roles &&
    (member.roles as { cache?: unknown }).cache instanceof Map
  ) {
    memberRoleIds = [...((member.roles as { cache: Map<string, unknown> }).cache.keys())];
  }

  return {
    memberDisplayName,
    memberNickname,
    memberRoleIds,
  };
}

function buildMessagePayload(message: Message) {
  const memberInfo = buildMemberInfo(message.member);
  const userGlobalName = message.author.globalName ?? null;
  const userDisplayName = memberInfo.memberDisplayName ?? userGlobalName ?? message.author.username;

  return {
    type: message.guildId ? 'channel-message' : 'direct-message',
    messageId: message.id,
    content: message.content,
    guildId: message.guildId,
    channelId: message.channelId,
    userId: message.author.id,
    userDisplayName,
    userGlobalName,
    userName: message.author.username,
    userTag: message.author.tag,
    userAvatarUrl: message.author.displayAvatarURL(),
    memberDisplayName: memberInfo.memberDisplayName,
    memberNickname: memberInfo.memberNickname,
    memberRoleIds: memberInfo.memberRoleIds,
    authorIsBot: message.author.bot,
    createdTimestamp: message.createdTimestamp,
    attachments: [...message.attachments.values()].map((a) => ({
      id: a.id,
      name: a.name,
      contentType: a.contentType,
      size: a.size,
      url: a.url,
    })),
  };
}

function matchPattern(content: string, pattern: string, value: string, caseSensitive: boolean): boolean {
  if (pattern === 'every') {
    return true;
  }

  const source = caseSensitive ? content : content.toLowerCase();
  const needle = caseSensitive ? value : value.toLowerCase();

  if (pattern === 'equals') {
    return source === needle;
  }
  if (pattern === 'starts-with') {
    return source.startsWith(needle);
  }
  if (pattern === 'contains') {
    return source.includes(needle);
  }
  if (pattern === 'ends-with') {
    return source.endsWith(needle);
  }
  if (pattern === 'regex') {
    try {
      if (isPotentiallyUnsafeRegex(value)) {
        return false;
      }

      const flags = caseSensitive ? '' : 'i';
      const re = new RegExp(value, flags);
      return re.test(content);
    } catch {
      return false;
    }
  }

  return false;
}

function buildInteractionPayload(interaction: Interaction) {
  const user = interaction.user;
  const memberInfo = buildMemberInfo(interaction.member);
  const userGlobalName = user.globalName ?? null;
  const userDisplayName = memberInfo.memberDisplayName ?? userGlobalName ?? user.username;

  const base = {
    interactionId: interaction.id,
    interactionToken: interaction.token,
    applicationId: interaction.applicationId,
    guildId: interaction.guildId,
    channelId: interaction.channelId,
    userId: user.id,
    userDisplayName,
    userGlobalName,
    userName: user.username,
    userTag: user.tag,
    userAvatarUrl: user.displayAvatarURL(),
    memberDisplayName: memberInfo.memberDisplayName,
    memberNickname: memberInfo.memberNickname,
    memberRoleIds: memberInfo.memberRoleIds,
    createdTimestamp: interaction.createdTimestamp,
  };

  if (interaction.isChatInputCommand()) {
    return {
      ...base,
      type: 'slash-command',
      commandName: interaction.commandName,
      commandId: interaction.commandId,
      options: interaction.options.data,
    };
  }

  if (interaction.isButton() || interaction.isAnySelectMenu()) {
    return {
      ...base,
      type: 'component-interaction',
      customId: interaction.customId,
      componentType: interaction.componentType,
      values: interaction.isAnySelectMenu() ? interaction.values : [],
      messageId: interaction.message.id,
    };
  }

  if (interaction.isModalSubmit()) {
    return {
      ...base,
      type: 'modal-submit',
      customId: interaction.customId,
      fields: interaction.fields.fields.map((f) => ({
        customId: f.customId,
        value: 'value' in f ? f.value : null,
      })),
    };
  }

  return {
    ...base,
    type: 'unknown-interaction',
  };
}

export class DiscordBotTrigger implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Discord Bot Trigger',
    name: 'discordBotTrigger',
    icon: 'file:discord-logo.svg',
    group: ['trigger'],
    version: 1,
    description: 'Trigger n8n workflows from Discord bot events',
    defaults: {
      name: 'Discord Bot Trigger',
    },
    inputs: [],
    outputs: ['main'],
    credentials: [
      {
        name: 'discordBotApi',
        required: true,
      },
    ],
    properties: [
      {
        displayName: 'Event',
        name: 'event',
        type: 'options',
        options: [
          { name: 'Component Interaction', value: 'component-interaction' },
          { name: 'Modal Submit', value: 'modal-submit' },
          { name: 'New Channel Message', value: 'channel-message' },
          { name: 'New Direct Message', value: 'direct-message' },
          { name: 'Reaction Added', value: 'reaction-add' },
          { name: 'Reaction Removed', value: 'reaction-remove' },
          { name: 'Slash Command', value: 'slash-command' },
        ],
        default: 'channel-message',
      },
      {
        displayName: 'Guild Names or IDs (Optional)',
        name: 'guildIds',
        type: 'multiOptions',
        typeOptions: {
          loadOptionsMethod: 'getGuilds',
        },
        displayOptions: {
          show: {
            event: ['channel-message', 'reaction-add', 'reaction-remove', 'slash-command', 'component-interaction', 'modal-submit'],
          },
        },
        default: [],
        description: 'Only trigger for selected guilds (leave empty for all). Choose from the list, or specify IDs using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
      },
      {
        displayName: 'Channel Names or IDs',
        name: 'channelIds',
        type: 'multiOptions',
        typeOptions: {
          loadOptionsMethod: 'getChannels',
          loadOptionsDependsOn: ['guildIds'],
        },
        displayOptions: {
          show: {
            event: ['channel-message', 'reaction-add', 'reaction-remove'],
          },
        },
        default: [],
        description: 'Only trigger for selected channels (leave empty for all). Choose from the list, or specify IDs using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
      },
      {
        displayName: 'From Role Names or IDs',
        name: 'roleIds',
        type: 'multiOptions',
        typeOptions: {
          loadOptionsMethod: 'getRoles',
          loadOptionsDependsOn: ['guildIds'],
        },
        displayOptions: {
          show: {
            event: ['channel-message', 'reaction-add', 'reaction-remove'],
          },
        },
        default: [],
        description: 'Only trigger for members that have at least one selected role. Choose from the list, or specify IDs using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
      },
      {
        displayName: 'Pattern',
        name: 'pattern',
        type: 'options',
        options: [
          { name: 'Contains', value: 'contains' },
          { name: 'Ends With', value: 'ends-with' },
          { name: 'Equals', value: 'equals' },
          { name: 'Every Message', value: 'every' },
          { name: 'Regex', value: 'regex' },
          { name: 'Starts With', value: 'starts-with' },
        ],
        displayOptions: {
          show: {
            event: ['channel-message', 'direct-message'],
          },
        },
        default: 'every',
      },
      {
        displayName: 'Value',
        name: 'patternValue',
        type: 'string',
        displayOptions: {
          show: {
            event: ['channel-message', 'direct-message'],
            pattern: ['equals', 'starts-with', 'contains', 'ends-with', 'regex'],
          },
        },
        default: '',
      },
      {
        displayName: 'Case Sensitive',
        name: 'caseSensitive',
        type: 'boolean',
        displayOptions: {
          show: {
            event: ['channel-message', 'direct-message'],
          },
        },
        default: false,
      },
      {
        displayName: 'Message ID',
        name: 'reactionMessageId',
        type: 'string',
        displayOptions: {
          show: {
            event: ['reaction-add', 'reaction-remove'],
          },
        },
        default: '',
      },
      {
        displayName: 'Emoji Name',
        name: 'emojiName',
        type: 'string',
        displayOptions: {
          show: {
            event: ['reaction-add', 'reaction-remove'],
          },
        },
        default: '',
        description: 'Filter by emoji name, such as thumbs_up or custom emoji name',
      },
      {
        displayName: 'Slash Command Name (No / Needed)',
        name: 'slashCommandName',
        type: 'string',
        displayOptions: {
          show: {
            event: ['slash-command'],
          },
        },
        default: '',
        description: 'Leave empty to trigger for all slash commands. You can enter ping or /ping.',
      },
      {
        displayName: 'Custom ID',
        name: 'customId',
        type: 'string',
        displayOptions: {
          show: {
            event: ['component-interaction', 'modal-submit'],
          },
        },
        default: '',
      },
      {
        displayName: 'Additional Fields',
        name: 'additionalFields',
        type: 'collection',
        default: {},
        placeholder: 'Add Field',
        options: [
          {
            displayName: 'Auto Acknowledge Interactions',
            name: 'autoAcknowledge',
            type: 'boolean',
            default: true,
            description: 'Whether to automatically defer interaction replies so workflows have time to run',
          },
          {
            displayName: 'Acknowledge as Ephemeral',
            name: 'ackEphemeral',
            type: 'boolean',
            default: false,
            description: 'Whether auto-deferred replies should be ephemeral',
          },
          {
            displayName: 'Trigger on Bot Messages',
            name: 'includeBotMessages',
            type: 'boolean',
            default: false,
          },
        ],
      },
    ],
  };

  methods = {
    loadOptions: {
      async getGuilds(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
        const credentials = (await this.getCredentials('discordBotApi')) as DiscordBotCredentials;
        return loadGuildOptions(credentials);
      },
      async getChannels(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
        const credentials = (await this.getCredentials('discordBotApi')) as DiscordBotCredentials;
        const guildIds = this.getNodeParameter('guildIds', 0) as string[];
        if (!guildIds.length) {
          throw new NodeOperationError(this.getNode(), 'Select at least one guild first');
        }
        return loadChannelOptions(credentials, guildIds);
      },
      async getRoles(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
        const credentials = (await this.getCredentials('discordBotApi')) as DiscordBotCredentials;
        const guildIds = this.getNodeParameter('guildIds', 0) as string[];
        if (!guildIds.length) {
          throw new NodeOperationError(this.getNode(), 'Select at least one guild first');
        }
        return loadRoleOptions(credentials, guildIds);
      },
    },
  };

  async trigger(this: ITriggerFunctions): Promise<ITriggerResponse> {
    const credentials = (await this.getCredentials('discordBotApi')) as DiscordBotCredentials;
    const client = await getIsolatedClient(credentials);

    const event = this.getNodeParameter('event') as TriggerType;
    const guildIds = this.getNodeParameter('guildIds', []) as string[];
    const channelIds = this.getNodeParameter('channelIds', []) as string[];
    const roleIds = this.getNodeParameter('roleIds', []) as string[];
    const pattern = this.getNodeParameter('pattern', 'every') as string;
    const patternValue = this.getNodeParameter('patternValue', '') as string;
    const caseSensitive = this.getNodeParameter('caseSensitive', false) as boolean;
    const reactionMessageId = this.getNodeParameter('reactionMessageId', '') as string;
    const emojiName = this.getNodeParameter('emojiName', '') as string;
    const slashCommandName = this.getNodeParameter('slashCommandName', '') as string;
    const normalizedSlashCommandName = normalizeSlashCommandName(slashCommandName);
    const customId = this.getNodeParameter('customId', '') as string;
    const additionalFields = this.getNodeParameter('additionalFields', {}) as {
      includeBotMessages?: boolean;
      autoAcknowledge?: boolean;
      ackEphemeral?: boolean;
    };

    const includeBotMessages = additionalFields.includeBotMessages ?? false;
    const autoAcknowledge = additionalFields.autoAcknowledge ?? true;
    const ackEphemeral = additionalFields.ackEphemeral ?? false;

    const removeListeners: Array<() => void> = [];

    const passGuildFilter = (guildId: string | null): boolean => {
      if (!guildIds.length) {
        return true;
      }
      if (!guildId) {
        return false;
      }
      return guildIds.includes(guildId);
    };

    const passChannelFilter = (id: string): boolean => {
      if (!channelIds.length) {
        return true;
      }
      return channelIds.includes(id);
    };

    const passRoleFilter = (message: Message): boolean => {
      if (!roleIds.length) {
        return true;
      }
      const memberRoles = message.member?.roles?.cache;
      if (!memberRoles) {
        return false;
      }
      return roleIds.some((id) => memberRoles.has(id));
    };

    if (event === 'channel-message' || event === 'direct-message') {
      removeListeners.push(
        addClientListener(client, 'messageCreate', async (message) => {
          if (message.partial) {
            try {
              await message.fetch();
            } catch (error) {
              logNonCriticalError('Failed to fetch partial message for messageCreate event', error, {
                event,
                guildId: message.guildId,
                channelId: message.channelId,
              });
              return;
            }
          }

          if (message.author.bot && !includeBotMessages) {
            return;
          }

          const isDirectMessage = message.guildId === null || message.channel.type === ChannelType.DM;
          if (event === 'channel-message' && isDirectMessage) {
            return;
          }
          if (event === 'direct-message' && !isDirectMessage) {
            return;
          }

          if (event === 'channel-message' && !passGuildFilter(message.guildId)) {
            return;
          }

          if (event === 'channel-message' && !passChannelFilter(message.channelId)) {
            return;
          }

          if (event === 'channel-message' && !passRoleFilter(message)) {
            return;
          }

          const messageContent = typeof message.content === 'string' ? message.content : '';
          if (!matchPattern(messageContent, pattern, patternValue, caseSensitive)) {
            return;
          }

          this.emit([this.helpers.returnJsonArray(buildMessagePayload(message))]);
        }),
      );
    }

    if (event === 'reaction-add' || event === 'reaction-remove') {
      const reactionEvent = event === 'reaction-add' ? 'messageReactionAdd' : 'messageReactionRemove';
      removeListeners.push(
        addClientListener(client, reactionEvent, async (reaction, user, _details?) => {
          if (user.partial) {
            try {
              await user.fetch();
            } catch (error) {
              logNonCriticalError('Failed to fetch partial user for reaction event', error, {
                event,
                userId: user.id,
              });
              return;
            }
          }

          if (!includeBotMessages && user.bot) {
            return;
          }

          try {
            await reaction.fetch();
          } catch (error) {
            logNonCriticalError('Failed to fetch reaction details', error, {
              event,
              userId: user.id,
            });
            return;
          }

          let message: Message;
          try {
            message = reaction.message.partial ? await reaction.message.fetch() : reaction.message;
          } catch (error) {
            logNonCriticalError('Failed to fetch reaction message', error, {
              event,
              userId: user.id,
            });
            return;
          }

          if (!passGuildFilter(message.guildId)) {
            return;
          }
          if (!passChannelFilter(message.channelId)) {
            return;
          }
          if (!passRoleFilter(message)) {
            return;
          }
          if (reactionMessageId && message.id !== reactionMessageId) {
            return;
          }

          const currentEmojiName = reaction.emoji.name ?? '';
          if (emojiName && currentEmojiName !== emojiName) {
            return;
          }

          this.emit([
            this.helpers.returnJsonArray({
              type: event,
              guildId: message.guildId,
              channelId: message.channelId,
              messageId: message.id,
              userId: user.id,
              userDisplayName: user.globalName ?? user.username,
              userGlobalName: user.globalName ?? null,
              userName: user.username,
              userTag: user.tag,
              userAvatarUrl: user.displayAvatarURL(),
              emojiName: currentEmojiName,
              emojiId: reaction.emoji.id,
              count: reaction.count,
              createdTimestamp: message.createdTimestamp,
            }),
          ]);
        }),
      );
    }

    if (event === 'slash-command' || event === 'component-interaction' || event === 'modal-submit') {
      removeListeners.push(
        addClientListener(client, 'interactionCreate', async (interaction) => {
          if (!passGuildFilter(interaction.guildId)) {
            return;
          }

          if (event === 'slash-command') {
            if (!interaction.isChatInputCommand()) {
              return;
            }
            if (
              normalizedSlashCommandName &&
              normalizeSlashCommandName(interaction.commandName) !== normalizedSlashCommandName
            ) {
              return;
            }
            if (autoAcknowledge && !interaction.deferred && !interaction.replied) {
              await interaction.deferReply({ ephemeral: ackEphemeral }).catch((error) => {
                logNonCriticalError('Failed to auto-acknowledge slash command interaction', error, {
                  event,
                  interactionId: interaction.id,
                });
              });
            }
            this.emit([this.helpers.returnJsonArray(buildInteractionPayload(interaction))]);
            return;
          }

          if (event === 'component-interaction') {
            if (!(interaction.isButton() || interaction.isAnySelectMenu())) {
              return;
            }
            if (customId && interaction.customId !== customId) {
              return;
            }
            if (autoAcknowledge && !interaction.deferred && !interaction.replied) {
              await interaction.deferReply({ ephemeral: ackEphemeral }).catch((error) => {
                logNonCriticalError('Failed to auto-acknowledge component interaction', error, {
                  event,
                  interactionId: interaction.id,
                });
              });
            }
            this.emit([this.helpers.returnJsonArray(buildInteractionPayload(interaction))]);
            return;
          }

          if (event === 'modal-submit') {
            if (!interaction.isModalSubmit()) {
              return;
            }
            if (customId && interaction.customId !== customId) {
              return;
            }
            if (autoAcknowledge && !interaction.deferred && !interaction.replied) {
              await interaction.deferReply({ ephemeral: ackEphemeral }).catch((error) => {
                logNonCriticalError('Failed to auto-acknowledge modal submit interaction', error, {
                  event,
                  interactionId: interaction.id,
                });
              });
            }
            this.emit([this.helpers.returnJsonArray(buildInteractionPayload(interaction))]);
          }
        }),
      );
    }

    return {
      closeFunction: async () => {
        for (const remove of removeListeners) {
          remove();
        }
        client.destroy();
      },
    };
  }
}
