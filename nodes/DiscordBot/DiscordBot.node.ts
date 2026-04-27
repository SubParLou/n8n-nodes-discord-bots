import {
  REST,
  Routes,
  type ApplicationCommandOptionData,
  type APIEmbed,
  type APIActionRowComponent,
} from 'discord.js';
import type {
  IExecuteFunctions,
  ILoadOptionsFunctions,
  INodeExecutionData,
  INodePropertyOptions,
  INodeType,
  INodeTypeDescription,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import {
  getClient,
  loadChannelOptions,
  loadGuildOptions,
  registerSlashCommand,
} from './clientManager';
import type { DiscordBotCredentials } from './types';

type Operation = 'send-message' | 'register-slash-command' | 'respond-to-interaction';

function parseJsonField<T>(value: string, fieldName: string, context: IExecuteFunctions): T {
  if (!value) {
    return [] as unknown as T;
  }

  try {
    return JSON.parse(value) as T;
  } catch (error) {
    throw new NodeOperationError(context.getNode(), `Invalid JSON in ${fieldName}: ${(error as Error).message}`);
  }
}

export class DiscordBot implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Discord Bot',
    name: 'discordBot',
    icon: 'file:discord-logo.svg',
    group: ['transform'],
    version: 1,
    description: 'Send messages and manage slash commands for Discord bots',
    defaults: {
      name: 'Discord Bot',
    },
    inputs: ['main'],
    outputs: ['main'],
    credentials: [
      {
        name: 'discordBotApi',
        required: true,
      },
    ],
    properties: [
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        default: 'send-message',
        options: [
          { name: 'Send Message', value: 'send-message' },
          { name: 'Register Slash Command', value: 'register-slash-command' },
          { name: 'Respond to Interaction', value: 'respond-to-interaction' },
        ],
      },
      {
        displayName: 'Target Type',
        name: 'targetType',
        type: 'options',
        displayOptions: {
          show: {
            operation: ['send-message'],
          },
        },
        default: 'channel',
        options: [
          { name: 'Channel', value: 'channel' },
          { name: 'User DM', value: 'user-dm' },
        ],
      },
      {
        displayName: 'Guild Names or IDs',
        name: 'guildIds',
        type: 'multiOptions',
        typeOptions: {
          loadOptionsMethod: 'getGuilds',
        },
        displayOptions: {
          show: {
            operation: ['send-message'],
            targetType: ['channel'],
          },
        },
        default: [],
        description: 'Used to load channels from selected guilds. Choose from the list, or specify IDs using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
      },
      {
        displayName: 'Channel Name or ID',
        name: 'channelId',
        type: 'options',
        description: 'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
        typeOptions: {
          loadOptionsMethod: 'getChannels',
          loadOptionsDependsOn: ['guildIds'],
        },
        displayOptions: {
          show: {
            operation: ['send-message'],
            targetType: ['channel'],
          },
        },
        default: '',
        required: true,
      },
      {
        displayName: 'User ID',
        name: 'userId',
        type: 'string',
        displayOptions: {
          show: {
            operation: ['send-message'],
            targetType: ['user-dm'],
          },
        },
        default: '',
        required: true,
      },
      {
        displayName: 'Content',
        name: 'content',
        type: 'string',
        typeOptions: {
          rows: 4,
        },
        displayOptions: {
          show: {
            operation: ['send-message', 'respond-to-interaction'],
          },
        },
        default: '',
      },
      {
        displayName: 'Embeds JSON',
        name: 'embedsJson',
        type: 'json',
        displayOptions: {
          show: {
            operation: ['send-message', 'respond-to-interaction'],
          },
        },
        default: '[]',
        description: 'JSON array of Discord embeds',
      },
      {
        displayName: 'Components JSON',
        name: 'componentsJson',
        type: 'json',
        displayOptions: {
          show: {
            operation: ['send-message', 'respond-to-interaction'],
          },
        },
        default: '[]',
        description: 'JSON array for buttons, selects, or modal components',
      },
      {
        displayName: 'Ephemeral',
        name: 'ephemeral',
        type: 'boolean',
        displayOptions: {
          show: {
            operation: ['respond-to-interaction'],
          },
        },
        default: false,
      },
      {
        displayName: 'Interaction ID',
        name: 'interactionId',
        type: 'string',
        displayOptions: {
          show: {
            operation: ['respond-to-interaction'],
          },
        },
        default: '',
        required: true,
      },
      {
        displayName: 'Interaction Token',
        name: 'interactionToken',
        type: 'string',
        typeOptions: { password: true },
        displayOptions: {
          show: {
            operation: ['respond-to-interaction'],
          },
        },
        default: '',
        required: true,
      },
      {
        displayName: 'Guild ID',
        name: 'commandGuildId',
        type: 'string',
        displayOptions: {
          show: {
            operation: ['register-slash-command'],
          },
        },
        default: '',
        description: 'Set to register as guild command. Leave empty for global command.',
      },
      {
        displayName: 'Command Name',
        name: 'commandName',
        type: 'string',
        displayOptions: {
          show: {
            operation: ['register-slash-command'],
          },
        },
        default: '',
        required: true,
      },
      {
        displayName: 'Command Description',
        name: 'commandDescription',
        type: 'string',
        displayOptions: {
          show: {
            operation: ['register-slash-command'],
          },
        },
        default: '',
        required: true,
      },
      {
        displayName: 'Command Options',
        name: 'commandOptions',
        type: 'collection',
        displayOptions: {
          show: {
            operation: ['register-slash-command'],
          },
        },
        default: {},
        placeholder: 'Add Option',
        options: [
          {
            displayName: 'Options',
            name: 'options',
            type: 'fixedCollection',
            typeOptions: {
              multipleValues: true,
            },
            default: [],
            options: [
              {
                displayName: 'Option',
                name: 'option',
                values: [
                  {
                    displayName: 'Option Name',
                    name: 'name',
                    type: 'string',
                    description: 'Lowercase, no spaces (e.g. "username")',
                    required: true,
                    default: '',
                  },
                  {
                    displayName: 'Option Description',
                    name: 'description',
                    type: 'string',
                    required: true,
                    default: '',
                  },
                  {
                    displayName: 'Option Type',
                    name: 'type',
                    type: 'options',
                    options: [
                      { name: 'String', value: 3 },
                      { name: 'Integer', value: 4 },
                      { name: 'Boolean', value: 5 },
                      { name: 'User', value: 7 },
                      { name: 'Channel', value: 8 },
                      { name: 'Role', value: 9 },
                    ],
                    default: 3,
                  },
                  {
                    displayName: 'Required',
                    name: 'required',
                    type: 'boolean',
                    default: false,
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        displayName: 'Or Provide Raw JSON Instead',
        name: 'commandOptionsJson',
        type: 'json',
        displayOptions: {
          show: {
            operation: ['register-slash-command'],
          },
        },
        default: '[]',
        description: 'Advanced: JSON array for slash command options (use if the builder above does not meet your needs)',
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
    },
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const credentials = (await this.getCredentials('discordBotApi')) as DiscordBotCredentials;
    const returnData: INodeExecutionData[] = [];

    for (let i = 0; i < items.length; i += 1) {
      const operation = this.getNodeParameter('operation', i) as Operation;

      if (operation === 'send-message') {
        const client = await getClient(credentials);
        const targetType = this.getNodeParameter('targetType', i) as 'channel' | 'user-dm';
        const content = this.getNodeParameter('content', i, '') as string;
        const embedsJson = this.getNodeParameter('embedsJson', i, '[]') as string;
        const componentsJson = this.getNodeParameter('componentsJson', i, '[]') as string;

        const embeds = parseJsonField<APIEmbed[]>(embedsJson, 'Embeds JSON', this);
        const components = parseJsonField<APIActionRowComponent<any>[]>(componentsJson, 'Components JSON', this);

        if (!content && !embeds.length && !components.length) {
          throw new NodeOperationError(this.getNode(), 'Provide content, embeds, or components');
        }

        let channelId: string;
        let messageId: string;

        if (targetType === 'channel') {
          channelId = this.getNodeParameter('channelId', i) as string;
          const channel = await client.channels.fetch(channelId);
          if (!channel || !channel.isTextBased() || !('send' in channel)) {
            throw new NodeOperationError(this.getNode(), `Channel ${channelId} is not text sendable`);
          }
          const message = await channel.send({
            content: content || undefined,
            embeds,
            components: components as any,
          });
          messageId = message.id;
        } else {
          const userId = this.getNodeParameter('userId', i) as string;
          const user = await client.users.fetch(userId);
          const dm = await user.createDM();
          const message = await dm.send({
            content: content || undefined,
            embeds,
            components: components as any,
          });
          channelId = dm.id;
          messageId = message.id;
        }

        returnData.push({
          json: {
            operation,
            channelId,
            messageId,
            content,
          },
          pairedItem: { item: i },
        });

        continue;
      }

      if (operation === 'register-slash-command') {
        const commandName = this.getNodeParameter('commandName', i) as string;
        const commandDescription = this.getNodeParameter('commandDescription', i) as string;
        const commandGuildId = this.getNodeParameter('commandGuildId', i, '') as string;

        let commandOptions: ApplicationCommandOptionData[] = [];

        // Try to use the friendly builder first
        const commandOptionsCollection = this.getNodeParameter('commandOptions', i, {}) as {
          options?: { option?: Array<{ name: string; description: string; type: number; required: boolean }> };
        };

        if (
          commandOptionsCollection.options?.option &&
          Array.isArray(commandOptionsCollection.options.option) &&
          commandOptionsCollection.options.option.length > 0
        ) {
          commandOptions = commandOptionsCollection.options.option.map((opt) => ({
            name: opt.name,
            description: opt.description,
            type: opt.type,
            required: opt.required,
          }));
        } else {
          // Fall back to JSON if no options were added via the builder
          const commandOptionsJson = this.getNodeParameter('commandOptionsJson', i, '[]') as string;
          commandOptions = parseJsonField<ApplicationCommandOptionData[]>(
            commandOptionsJson,
            'Command Options JSON',
            this,
          );
        }

        const command = await registerSlashCommand({
          token: credentials.token,
          clientId: credentials.clientId,
          guildId: commandGuildId || undefined,
          name: commandName,
          description: commandDescription,
          options: commandOptions,
        });

        returnData.push({
          json: {
            operation,
            commandId: command.id,
            commandName: command.name,
            scope: commandGuildId ? 'guild' : 'global',
            guildId: commandGuildId || null,
          },
          pairedItem: { item: i },
        });

        continue;
      }

      if (operation === 'respond-to-interaction') {
        const interactionId = this.getNodeParameter('interactionId', i) as string;
        const interactionToken = this.getNodeParameter('interactionToken', i) as string;
        const content = this.getNodeParameter('content', i, '') as string;
        const embedsJson = this.getNodeParameter('embedsJson', i, '[]') as string;
        const componentsJson = this.getNodeParameter('componentsJson', i, '[]') as string;
        const ephemeral = this.getNodeParameter('ephemeral', i, false) as boolean;

        const embeds = parseJsonField<APIEmbed[]>(embedsJson, 'Embeds JSON', this);
        const components = parseJsonField<APIActionRowComponent<any>[]>(componentsJson, 'Components JSON', this);

        const rest = new REST({ version: '10' });
        await rest.post(Routes.interactionCallback(interactionId, interactionToken), {
          body: {
            type: 4,
            data: {
              content: content || undefined,
              embeds,
              components,
              flags: ephemeral ? 64 : 0,
            },
          },
        });

        returnData.push({
          json: {
            operation,
            interactionId,
            responded: true,
          },
          pairedItem: { item: i },
        });

        continue;
      }

      throw new NodeOperationError(this.getNode(), `Unsupported operation: ${operation}`);
    }

    return [returnData];
  }
}
