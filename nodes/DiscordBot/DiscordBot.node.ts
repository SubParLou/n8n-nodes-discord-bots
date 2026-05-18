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
import {
  buildAllComponentsFromUi,
  buildEmbedsFromUi,
  type AutoSelectMenuUiParams,
  type ButtonUiParams,
  type EmbedUiParams,
  type StringSelectMenuUiParams,
} from './messageBuilder';

type Operation = 'send-message' | 'update-message' | 'register-slash-command' | 'respond-to-interaction';

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

function isAlreadyAcknowledgedInteractionError(error: unknown): boolean {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = (error as { code?: unknown }).code;
    if (code === 40060) {
      return true;
    }
  }

  const message = error instanceof Error ? error.message : String(error);
  return /already been acknowledged/i.test(message);
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
          { name: 'Register Slash Command', value: 'register-slash-command' },
          { name: 'Respond to Interaction', value: 'respond-to-interaction' },
          { name: 'Send Message', value: 'send-message' },
          { name: 'Update Message', value: 'update-message' },
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
            operation: ['send-message', 'respond-to-interaction', 'update-message'],
          },
        },
        default: '',
      },
      // ─── Update Message targeting fields ───────────────────────────────────
      {
        displayName: 'Guild Names or IDs',
        name: 'updateGuildIds',
        type: 'multiOptions',
        typeOptions: {
          loadOptionsMethod: 'getGuilds',
        },
        displayOptions: {
          show: {
            operation: ['update-message'],
          },
        },
        default: [],
        description: 'Used to load channels. Choose from the list, or specify IDs using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
      },
      {
        displayName: 'Channel Name or ID',
        name: 'updateChannelId',
        type: 'options',
        description: 'The channel containing the message to edit. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
        typeOptions: {
          loadOptionsMethod: 'getUpdateChannels',
          loadOptionsDependsOn: ['updateGuildIds'],
        },
        displayOptions: {
          show: {
            operation: ['update-message'],
          },
        },
        default: '',
        required: true,
      },
      {
        displayName: 'Message ID',
        name: 'updateMessageId',
        type: 'string',
        displayOptions: {
          show: {
            operation: ['update-message'],
          },
        },
        default: '',
        required: true,
        description: 'The ID of the message to edit',
      },
      // ─── Send Message Payload Mode ─────────────────────────────────────────
      {
        displayName: 'Message Payload Mode',
        name: 'payloadMode',
        type: 'options',
        noDataExpression: true,
        displayOptions: {
          show: {
            operation: ['send-message', 'update-message'],
          },
        },
        default: 'builder',
        options: [
          {
            name: 'Raw JSON',
            value: 'raw-json',
            description: 'Provide Embeds JSON and Components JSON directly as raw Discord API arrays',
          },
          {
            name: 'Builder',
            value: 'builder',
            description: 'Use the visual embed and button builders below',
          },
          {
            name: 'Builder + Advanced JSON Merge',
            value: 'builder-merge',
            description: 'Build from UI fields and also merge additional raw JSON embeds/components',
          },
        ],
      },
      // ─── Embed Builder (send-message builder modes) ────────────────────────
      {
        displayName: 'Embeds',
        name: 'embedBuilder',
        type: 'fixedCollection',
        typeOptions: {
          multipleValues: true,
        },
        displayOptions: {
          show: {
            operation: ['send-message', 'update-message'],
            payloadMode: ['builder', 'builder-merge'],
          },
        },
        default: {},
        placeholder: 'Add Embed',
        description: 'Up to 10 embeds per message. Empty fields are omitted.',
        options: [
          {
            displayName: 'Embed',
            name: 'embed',
            values: [
											{
												displayName: 'Author Icon URL',
												name: 'authorIconUrl',
												type: 'string',
												default: '',
												description: 'Small icon shown to the left of the author name',
											},
											{
												displayName: 'Author Name',
												name: 'authorName',
												type: 'string',
												default: '',
												description: 'Author name shown above the embed title (max 256 characters)',
											},
											{
												displayName: 'Author URL',
												name: 'authorUrl',
												type: 'string',
												default: '',
												description: 'URL the author name links to',
											},
											{
												displayName: 'Color',
												name: 'color',
												type: 'color',
												default: '',
												description: 'Embed sidebar color, for example	#5865F2',
											},
											{
												displayName: 'Description',
												name: 'description',
												type: 'string',
												default: '',
												description: 'Embed description (max 4096 characters)',
											},
											{
												displayName: 'Embed Fields',
												name: 'embedFields',
												type: 'fixedCollection',
												default: {},
												placeholder: 'Add Field',
												description: 'Up to 25 key-value fields inside the embed',
												options: [
													{
														displayName: 'Field',
														name: 'field',
															values:	[
																	{
																		displayName: 'Name',
																		name: 'name',
																		type: 'string',
																		default: '',
																			required:	true,
																		description: 'Field title (max 256 characters)',
																	},
																	{
																		displayName: 'Value',
																		name: 'value',
																		type: 'string',
																		default: '',
																			required:	true,
																		description: 'Field content (max 1024 characters)',
																	},
																	{
																		displayName: 'Inline',
																		name: 'inline',
																		type: 'boolean',
																		default: false,
																		description: 'Whether to display this field inline alongside adjacent inline fields',
																	},
																]
													},
													]
											},
											{
												displayName: 'Footer Icon URL',
												name: 'footerIconUrl',
												type: 'string',
												default: '',
												description: 'Small icon shown to the left of the footer text',
											},
											{
												displayName: 'Footer Text',
												name: 'footerText',
												type: 'string',
												default: '',
												description: 'Text shown in the embed footer (max 2048 characters)',
											},
											{
												displayName: 'Image URL',
												name: 'imageUrl',
												type: 'string',
												default: '',
												description: 'Large image displayed at the bottom of the embed',
											},
											{
												displayName: 'Thumbnail Image URL',
												name: 'thumbnailUrl',
												type: 'string',
												default: '',
												description: 'Small image displayed in the upper-right corner of the embed',
											},
											{
												displayName: 'Timestamp',
												name: 'timestamp',
												type: 'string',
												default: '',
												description: 'ISO 8601 timestamp shown in the footer, for example 2024-01-15T12:00:00.000Z. Leave empty to omit.',
											},
											{
												displayName: 'Title',
												name: 'title',
												type: 'string',
												default: '',
												description: 'Embed title (max 256 characters)',
											},
											{
												displayName: 'URL',
												name: 'url',
												type: 'string',
												default: '',
												description: 'URL the title links to',
											},
									],
          },
        ],
      },
      // ─── Button Builder (send-message + update-message builder modes) ───────
      {
        displayName: 'Buttons',
        name: 'buttonBuilder',
        type: 'fixedCollection',
        typeOptions: {
          multipleValues: true,
        },
        displayOptions: {
          show: {
            operation: ['send-message', 'update-message'],
            payloadMode: ['builder', 'builder-merge'],
          },
        },
        default: {},
        placeholder: 'Add Button',
        description: 'Up to 25 buttons per message, auto-grouped into rows of 5. Link buttons require a URL; all others require a Custom ID.',
        options: [
          {
            displayName: 'Button',
            name: 'button',
            values: [
											{
												displayName: 'Custom ID',
												name: 'customId',
												type: 'string',
												default: '',
												description: 'Required for non-link buttons. Unique identifier sent to your bot on click.',
											},
											{
												displayName: 'Disabled',
												name: 'disabled',
												type: 'boolean',
												default: false,
											},
											{
												displayName: 'Emoji Animated',
												name: 'emojiAnimated',
												type: 'boolean',
												default: false,
												description: 'Whether the custom emoji is animated',
											},
											{
												displayName: 'Emoji ID',
												name: 'emojiId',
												type: 'string',
												default: '',
												description: 'Discord snowflake ID for a custom server emoji',
											},
											{
												displayName: 'Emoji Name',
												name: 'emojiName',
												type: 'string',
												default: '',
												description: 'Unicode emoji or custom emoji name to show on the button, for example	🎉	or wave',
											},
											{
												displayName: 'Label',
												name: 'label',
												type: 'string',
													required:	true,
												default: '',
											},
											{
												displayName: 'Style',
												name: 'style',
												type: 'options',
												options: [
													{
														name: 'Primary (Blue)',
														value: 1
													},
													{
														name: 'Secondary (Grey)',
														value: 2
													},
													{
														name: 'Success (Green)',
														value: 3
													},
													{
														name: 'Danger (Red)',
														value: 4
													},
													{
														name: 'Link',
														value: 5
													},
												],
												default: 1
											},
											{
												displayName: 'URL',
												name: 'url',
												type: 'string',
												default: '',
												description: 'Required for Link style buttons. Must be a valid URL.',
											},
									],
          },
        ],
      },
      // ─── String Select Menus (send-message + update-message builder modes) ──
      {
        displayName: 'String Select Menus',
        name: 'stringSelectBuilder',
        type: 'fixedCollection',
        typeOptions: {
          multipleValues: true,
        },
        displayOptions: {
          show: {
            operation: ['send-message', 'update-message'],
            payloadMode: ['builder', 'builder-merge'],
          },
        },
        default: {},
        placeholder: 'Add Select Menu',
        description: 'Dropdown menus with your own custom options. Each select menu occupies one action row (max 5 action rows total across buttons and selects).',
        options: [
          {
            displayName: 'Select Menu',
            name: 'select',
            values: [
              {
                displayName: 'Custom ID',
                name: 'customId',
                type: 'string',
                required: true,
                default: '',
                description: 'Unique identifier for this menu, sent to your bot when a user makes a selection',
              },
              {
                displayName: 'Disabled',
                name: 'disabled',
                type: 'boolean',
                default: false,
              },
              {
                displayName: 'Max Values',
                name: 'maxValues',
                type: 'number',
                typeOptions: { minValue: 1, maxValue: 25 },
                default: 1,
                description: 'Maximum number of options the user can select (1–25)',
              },
              {
                displayName: 'Min Values',
                name: 'minValues',
                type: 'number',
                typeOptions: { minValue: 0, maxValue: 25 },
                default: 1,
                description: 'Minimum number of options the user must select (0–25)',
              },
              {
                displayName: 'Placeholder',
                name: 'placeholder',
                type: 'string',
                default: '',
                description: 'Greyed-out text shown when nothing is selected yet (max 150 characters)',
              },
              {
                displayName: 'Select Options',
                name: 'selectOptions',
                type: 'fixedCollection',
                typeOptions: { multipleValues: true },
                required: true,
                default: {},
                placeholder: 'Add Option',
                description: 'Up to 25 options shown in the dropdown',
                options: [
                  {
                    displayName: 'Option',
                    name: 'option',
                    values: [
                      {
                        displayName: 'Default',
                        name: 'default',
                        type: 'boolean',
                        default: false,
                        description: 'Whether this option is pre-selected when the menu opens',
                      },
                      {
                        displayName: 'Description',
                        name: 'description',
                        type: 'string',
                        default: '',
                        description: 'Short description shown below the label (max 100 characters)',
                      },
                      {
                        displayName: 'Emoji Animated',
                        name: 'emojiAnimated',
                        type: 'boolean',
                        default: false,
                      },
                      {
                        displayName: 'Emoji ID',
                        name: 'emojiId',
                        type: 'string',
                        default: '',
                        description: 'Discord snowflake ID for a custom server emoji',
                      },
                      {
                        displayName: 'Emoji Name',
                        name: 'emojiName',
                        type: 'string',
                        default: '',
                        description: 'Unicode emoji or custom emoji name, for example 🎉',
                      },
                      {
                        displayName: 'Label',
                        name: 'label',
                        type: 'string',
                        required: true,
                        default: '',
                        description: 'Text shown in the dropdown for this option',
                      },
                      {
                        displayName: 'Value',
                        name: 'value',
                        type: 'string',
                        required: true,
                        default: '',
                        description: 'The value your bot receives when this option is selected',
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
      // ─── Auto-Populated Select Menus (send-message + update-message) ─────────
      {
        displayName: 'Auto-Populated Select Menus',
        name: 'autoSelectBuilder',
        type: 'fixedCollection',
        typeOptions: {
          multipleValues: true,
        },
        displayOptions: {
          show: {
            operation: ['send-message', 'update-message'],
            payloadMode: ['builder', 'builder-merge'],
          },
        },
        default: {},
        placeholder: 'Add Auto Select Menu',
        description: 'Dropdowns auto-populated by Discord with server members, roles, or channels. Each select menu occupies one action row.',
        options: [
          {
            displayName: 'Select Menu',
            name: 'select',
            values: [
              {
                displayName: 'Channel Types',
                name: 'channelTypes',
                type: 'multiOptions',
                default: [],
                options: [
                  { name: 'Announcement', value: 5 },
                  { name: 'Category', value: 4 },
                  { name: 'Forum', value: 15 },
                  { name: 'Media', value: 16 },
                  { name: 'Stage Voice', value: 13 },
                  { name: 'Text', value: 0 },
                  { name: 'Voice', value: 2 },
                ],
                description: 'Filter which channel types appear. Leave empty to show all. Only applies when Type is Channel Select.',
              },
              {
                displayName: 'Custom ID',
                name: 'customId',
                type: 'string',
                required: true,
                default: '',
                description: 'Unique identifier for this menu, sent to your bot when a user makes a selection',
              },
              {
                displayName: 'Disabled',
                name: 'disabled',
                type: 'boolean',
                default: false,
              },
              {
                displayName: 'Max Values',
                name: 'maxValues',
                type: 'number',
                typeOptions: { minValue: 1, maxValue: 25 },
                default: 1,
                description: 'Maximum number of items the user can select',
              },
              {
                displayName: 'Min Values',
                name: 'minValues',
                type: 'number',
                typeOptions: { minValue: 0, maxValue: 25 },
                default: 1,
                description: 'Minimum number of items the user must select',
              },
              {
                displayName: 'Placeholder',
                name: 'placeholder',
                type: 'string',
                default: '',
                description: 'Greyed-out text shown when nothing is selected yet',
              },
              {
                displayName: 'Type',
                name: 'selectType',
                type: 'options',
                options: [
                  { name: 'Channel Select', value: 8, description: 'Auto-populated with server channels' },
                  { name: 'Mentionable Select', value: 7, description: 'Auto-populated with users and roles' },
                  { name: 'Role Select', value: 6, description: 'Auto-populated with server roles' },
                  { name: 'User Select', value: 5, description: 'Auto-populated with server members' },
                ],
                default: 5,
                description: 'The type of Discord auto-populated select menu',
              },
            ],
          },
        ],
      },
      // ─── Respond to Interaction Payload Mode ───────────────────────────────
      {
        displayName: 'Message Payload Mode',
        name: 'replyPayloadMode',
        type: 'options',
        noDataExpression: true,
        displayOptions: {
          show: {
            operation: ['respond-to-interaction'],
          },
        },
        default: 'builder',
        options: [
          {
            name: 'Raw JSON',
            value: 'raw-json',
            description: 'Provide Embeds JSON and Components JSON directly as raw Discord API arrays',
          },
          {
            name: 'Builder',
            value: 'builder',
            description: 'Use the visual embed and button builders below',
          },
          {
            name: 'Builder + Advanced JSON Merge',
            value: 'builder-merge',
            description: 'Build from UI fields and also merge additional raw JSON embeds/components',
          },
        ],
      },
      {
        displayName: 'Embeds JSON',
        name: 'embedsJson',
        type: 'json',
        displayOptions: {
          show: {
            operation: ['send-message', 'update-message'],
            payloadMode: ['raw-json', 'builder-merge'],
          },
        },
        default: '[]',
        description: 'JSON array of Discord embeds. Used in Raw JSON mode and appended in Builder + Advanced JSON Merge mode.',
      },
      {
        displayName: 'Reply Embeds',
        name: 'replyEmbeds',
        type: 'collection',
        displayOptions: {
          show: {
            operation: ['respond-to-interaction'],
            replyPayloadMode: ['builder', 'builder-merge'],
          },
        },
        default: {},
        placeholder: 'Add Embed',
        options: [
          {
            displayName: 'Embeds',
            name: 'embeds',
            type: 'fixedCollection',
            typeOptions: {
              multipleValues: true,
            },
            default: [],
            options: [
              {
                displayName: 'Embed',
                name: 'embed',
                values: [
													{
														displayName: 'Author Icon URL',
														name: 'authorIconUrl',
														type: 'string',
														default: '',
														description: 'Small icon shown to the left of the author name',
													},
													{
														displayName: 'Author Name',
														name: 'authorName',
														type: 'string',
														default: '',
														description: 'Author name shown above the embed title (max 256 characters)',
													},
													{
														displayName: 'Author URL',
														name: 'authorUrl',
														type: 'string',
														default: '',
														description: 'URL the author name links to',
													},
													{
														displayName: 'Color',
														name: 'color',
														type: 'color',
														default: '',
														description: 'Embed sidebar color, for example	#5865F2',
													},
													{
														displayName: 'Description',
														name: 'description',
														type: 'string',
														default: '',
														description: 'Embed description (max 4096 characters)',
													},
													{
														displayName: 'Embed Fields',
														name: 'embedFields',
														type: 'fixedCollection',
														default: {},
														placeholder: 'Add Field',
														description: 'Up to 25 key-value fields inside the embed',
														options: [
																	{
																		displayName: 'Field',
																		name: 'field',
																			values:	[
																			{
																				displayName: 'Name',
																				name: 'name',
																				type: 'string',
																				default: '',
																					required:	true,
																				description: 'Field title (max 256 characters)',
																			},
																			{
																				displayName: 'Value',
																				name: 'value',
																				type: 'string',
																				default: '',
																					required:	true,
																				description: 'Field content (max 1024 characters)',
																			},
																			{
																				displayName: 'Inline',
																				name: 'inline',
																				type: 'boolean',
																				default: false,
																			},
																		]
																	},
															]
													},
													{
														displayName: 'Footer Icon URL',
														name: 'footerIconUrl',
														type: 'string',
														default: '',
														description: 'Small icon shown to the left of the footer text',
													},
													{
														displayName: 'Footer Text',
														name: 'footerText',
														type: 'string',
														default: '',
														description: 'Text shown in the embed footer (max 2048 characters)',
													},
													{
														displayName: 'Image URL',
														name: 'imageUrl',
														type: 'string',
														default: '',
														description: 'Large image displayed at the bottom of the embed',
													},
													{
														displayName: 'Thumbnail Image URL',
														name: 'thumbnailUrl',
														type: 'string',
														default: '',
														description: 'Small image displayed in the upper-right corner of the embed',
													},
													{
														displayName: 'Timestamp',
														name: 'timestamp',
														type: 'string',
														default: '',
														description: 'ISO 8601 timestamp shown in the footer. Leave empty to omit.',
													},
													{
														displayName: 'Title',
														name: 'title',
														type: 'string',
														default: '',
														description: 'Embed title (max 256 characters)',
													},
													{
														displayName: 'URL',
														name: 'url',
														type: 'string',
														default: '',
														description: 'URL the title links to',
													},
													],
              },
            ],
          },
        ],
        description: 'Optional embed builder. When fields are added here they take precedence over Embeds JSON.',
      },
      {
        displayName: 'Embeds JSON',
        name: 'replyEmbedsJson',
        type: 'json',
        displayOptions: {
          show: {
            operation: ['respond-to-interaction'],
            replyPayloadMode: ['raw-json', 'builder-merge'],
          },
        },
        default: '[]',
        description: 'JSON array of Discord embeds. Used in Raw JSON mode and appended in Builder + Advanced JSON Merge mode.',
      },
      {
        displayName: 'Components JSON',
        name: 'componentsJson',
        type: 'json',
        displayOptions: {
          show: {
            operation: ['send-message', 'update-message'],
            payloadMode: ['raw-json', 'builder-merge'],
          },
        },
        default: '[]',
        description: 'JSON array for buttons, selects, or modal components. Used in Raw JSON mode and appended in Builder + Advanced JSON Merge mode.',
      },
      {
        displayName: 'Reply Components',
        name: 'replyComponents',
        type: 'collection',
        displayOptions: {
          show: {
            operation: ['respond-to-interaction'],
            replyPayloadMode: ['builder', 'builder-merge'],
          },
        },
        default: {},
        placeholder: 'Add Button',
        options: [
          {
            displayName: 'Buttons',
            name: 'buttons',
            type: 'fixedCollection',
            typeOptions: {
              multipleValues: true,
            },
            default: [],
            options: [
              {
                displayName: 'Button',
                name: 'button',
                values: [
													{
														displayName: 'Custom ID',
														name: 'customId',
														type: 'string',
														default: '',
														description: 'Required for non-link buttons. Unique identifier sent to your bot on click.',
													},
													{
														displayName: 'Disabled',
														name: 'disabled',
														type: 'boolean',
														default: false,
													},
													{
														displayName: 'Emoji Animated',
														name: 'emojiAnimated',
														type: 'boolean',
														default: false,
														description: 'Whether the custom emoji is animated',
													},
													{
														displayName: 'Emoji ID',
														name: 'emojiId',
														type: 'string',
														default: '',
														description: 'Discord snowflake ID for a custom server emoji',
													},
													{
														displayName: 'Emoji Name',
														name: 'emojiName',
														type: 'string',
														default: '',
														description: 'Unicode emoji or custom emoji name to show on the button, for example	🎉	or wave',
													},
													{
														displayName: 'Label',
														name: 'label',
														type: 'string',
															required:	true,
														default: '',
													},
													{
														displayName: 'Style',
														name: 'style',
														type: 'options',
														options: [
																	{
																		name: 'Primary (Blue)',
																		value: 1
																	},
																	{
																		name: 'Secondary (Grey)',
																		value: 2
																	},
																	{
																		name: 'Success (Green)',
																		value: 3
																	},
																	{
																		name: 'Danger (Red)',
																		value: 4
																	},
																	{
																		name: 'Link',
																		value: 5
																	},
																],
														default: 1
													},
													{
														displayName: 'URL',
														name: 'url',
														type: 'string',
														default: '',
														description: 'Required for Link style buttons',
													},
													],
              },
            ],
          },
        ],
        description: 'Optional button builder. Buttons are grouped into rows of up to 5. When buttons are added here they take precedence over Components JSON.',
      },
      // ─── String Select Menus (respond-to-interaction builder modes) ─────────
      {
        displayName: 'String Select Menus',
        name: 'replyStringSelectBuilder',
        type: 'fixedCollection',
        typeOptions: {
          multipleValues: true,
        },
        displayOptions: {
          show: {
            operation: ['respond-to-interaction'],
            replyPayloadMode: ['builder', 'builder-merge'],
          },
        },
        default: {},
        placeholder: 'Add Select Menu',
        description: 'Dropdown menus with your own custom options. Each select menu occupies one action row (max 5 action rows total).',
        options: [
          {
            displayName: 'Select Menu',
            name: 'select',
            values: [
              {
                displayName: 'Custom ID',
                name: 'customId',
                type: 'string',
                required: true,
                default: '',
                description: 'Unique identifier for this menu, sent to your bot when a user makes a selection',
              },
              {
                displayName: 'Disabled',
                name: 'disabled',
                type: 'boolean',
                default: false,
              },
              {
                displayName: 'Max Values',
                name: 'maxValues',
                type: 'number',
                typeOptions: { minValue: 1, maxValue: 25 },
                default: 1,
                description: 'Maximum number of options the user can select (1–25)',
              },
              {
                displayName: 'Min Values',
                name: 'minValues',
                type: 'number',
                typeOptions: { minValue: 0, maxValue: 25 },
                default: 1,
                description: 'Minimum number of options the user must select (0–25)',
              },
              {
                displayName: 'Placeholder',
                name: 'placeholder',
                type: 'string',
                default: '',
                description: 'Greyed-out text shown when nothing is selected yet (max 150 characters)',
              },
              {
                displayName: 'Select Options',
                name: 'selectOptions',
                type: 'fixedCollection',
                typeOptions: { multipleValues: true },
                required: true,
                default: {},
                placeholder: 'Add Option',
                description: 'Up to 25 options shown in the dropdown',
                options: [
                  {
                    displayName: 'Option',
                    name: 'option',
                    values: [
                      {
                        displayName: 'Default',
                        name: 'default',
                        type: 'boolean',
                        default: false,
                        description: 'Whether this option is pre-selected when the menu opens',
                      },
                      {
                        displayName: 'Description',
                        name: 'description',
                        type: 'string',
                        default: '',
                        description: 'Short description shown below the label (max 100 characters)',
                      },
                      {
                        displayName: 'Emoji Animated',
                        name: 'emojiAnimated',
                        type: 'boolean',
                        default: false,
                      },
                      {
                        displayName: 'Emoji ID',
                        name: 'emojiId',
                        type: 'string',
                        default: '',
                        description: 'Discord snowflake ID for a custom server emoji',
                      },
                      {
                        displayName: 'Emoji Name',
                        name: 'emojiName',
                        type: 'string',
                        default: '',
                        description: 'Unicode emoji or custom emoji name, for example 🎉',
                      },
                      {
                        displayName: 'Label',
                        name: 'label',
                        type: 'string',
                        required: true,
                        default: '',
                        description: 'Text shown in the dropdown for this option',
                      },
                      {
                        displayName: 'Value',
                        name: 'value',
                        type: 'string',
                        required: true,
                        default: '',
                        description: 'The value your bot receives when this option is selected',
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
      // ─── Auto-Populated Select Menus (respond-to-interaction builder modes) ─
      {
        displayName: 'Auto-Populated Select Menus',
        name: 'replyAutoSelectBuilder',
        type: 'fixedCollection',
        typeOptions: {
          multipleValues: true,
        },
        displayOptions: {
          show: {
            operation: ['respond-to-interaction'],
            replyPayloadMode: ['builder', 'builder-merge'],
          },
        },
        default: {},
        placeholder: 'Add Auto Select Menu',
        description: 'Dropdowns auto-populated by Discord with server members, roles, or channels. Each select menu occupies one action row.',
        options: [
          {
            displayName: 'Select Menu',
            name: 'select',
            values: [
              {
                displayName: 'Channel Types',
                name: 'channelTypes',
                type: 'multiOptions',
                default: [],
                options: [
                  { name: 'Announcement', value: 5 },
                  { name: 'Category', value: 4 },
                  { name: 'Forum', value: 15 },
                  { name: 'Media', value: 16 },
                  { name: 'Stage Voice', value: 13 },
                  { name: 'Text', value: 0 },
                  { name: 'Voice', value: 2 },
                ],
                description: 'Filter which channel types appear. Leave empty to show all. Only applies when Type is Channel Select.',
              },
              {
                displayName: 'Custom ID',
                name: 'customId',
                type: 'string',
                required: true,
                default: '',
                description: 'Unique identifier for this menu, sent to your bot when a user makes a selection',
              },
              {
                displayName: 'Disabled',
                name: 'disabled',
                type: 'boolean',
                default: false,
              },
              {
                displayName: 'Max Values',
                name: 'maxValues',
                type: 'number',
                typeOptions: { minValue: 1, maxValue: 25 },
                default: 1,
                description: 'Maximum number of items the user can select',
              },
              {
                displayName: 'Min Values',
                name: 'minValues',
                type: 'number',
                typeOptions: { minValue: 0, maxValue: 25 },
                default: 1,
                description: 'Minimum number of items the user must select',
              },
              {
                displayName: 'Placeholder',
                name: 'placeholder',
                type: 'string',
                default: '',
                description: 'Greyed-out text shown when nothing is selected yet',
              },
              {
                displayName: 'Type',
                name: 'selectType',
                type: 'options',
                options: [
                  { name: 'Channel Select', value: 8, description: 'Auto-populated with server channels' },
                  { name: 'Mentionable Select', value: 7, description: 'Auto-populated with users and roles' },
                  { name: 'Role Select', value: 6, description: 'Auto-populated with server roles' },
                  { name: 'User Select', value: 5, description: 'Auto-populated with server members' },
                ],
                default: 5,
                description: 'The type of Discord auto-populated select menu',
              },
            ],
          },
        ],
      },
      {
        displayName: 'Components JSON',
        name: 'replyComponentsJson',
        type: 'json',
        displayOptions: {
          show: {
            operation: ['respond-to-interaction'],
            replyPayloadMode: ['raw-json', 'builder-merge'],
          },
        },
        default: '[]',
        description: 'JSON array for buttons, selects, or modal components. Used in Raw JSON mode and appended in Builder + Advanced JSON Merge mode.',
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
        displayName: 'Use Interaction Data From Input',
        name: 'useInputInteractionData',
        type: 'boolean',
        displayOptions: {
          show: {
            operation: ['respond-to-interaction'],
          },
        },
        default: true,
        description: 'Whether to read interactionId and interactionToken from the incoming item (for example from Discord Bot Trigger)',
      },
      {
        displayName: 'Interaction ID',
        name: 'interactionId',
        type: 'string',
        displayOptions: {
          show: {
            operation: ['respond-to-interaction'],
            useInputInteractionData: [false],
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
            useInputInteractionData: [false],
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
      async getUpdateChannels(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
        const credentials = (await this.getCredentials('discordBotApi')) as DiscordBotCredentials;
        const guildIds = this.getNodeParameter('updateGuildIds', 0) as string[];
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
        const payloadMode = this.getNodeParameter('payloadMode', i, 'builder') as
          | 'builder'
          | 'raw-json'
          | 'builder-merge';

        let embeds: APIEmbed[] = [];
        let components: APIActionRowComponent<any>[] = [];

        if (payloadMode === 'raw-json') {
          const embedsJson = this.getNodeParameter('embedsJson', i, '[]') as string;
          const componentsJson = this.getNodeParameter('componentsJson', i, '[]') as string;
          embeds = parseJsonField<APIEmbed[]>(embedsJson, 'Embeds JSON', this);
          components = parseJsonField<APIActionRowComponent<any>[]>(componentsJson, 'Components JSON', this);
        } else {
          const embedBuilderParam = this.getNodeParameter('embedBuilder', i, {}) as {
            embed?: EmbedUiParams[];
          };
          const buttonBuilderParam = this.getNodeParameter('buttonBuilder', i, {}) as {
            button?: ButtonUiParams[];
          };
          const stringSelectParam = this.getNodeParameter('stringSelectBuilder', i, {}) as {
            select?: StringSelectMenuUiParams[];
          };
          const autoSelectParam = this.getNodeParameter('autoSelectBuilder', i, {}) as {
            select?: AutoSelectMenuUiParams[];
          };
          embeds = buildEmbedsFromUi(embedBuilderParam.embed ?? [], this.getNode());
          components = buildAllComponentsFromUi(
            buttonBuilderParam.button ?? [],
            stringSelectParam.select ?? [],
            autoSelectParam.select ?? [],
            this.getNode(),
          ) as APIActionRowComponent<any>[];

          if (payloadMode === 'builder-merge') {
            const embedsJson = this.getNodeParameter('embedsJson', i, '[]') as string;
            const componentsJson = this.getNodeParameter('componentsJson', i, '[]') as string;
            const extraEmbeds = parseJsonField<APIEmbed[]>(embedsJson, 'Embeds JSON', this);
            const extraComponents = parseJsonField<APIActionRowComponent<any>[]>(
              componentsJson,
              'Components JSON',
              this,
            );
            embeds = [...embeds, ...extraEmbeds];
            components = [...components, ...extraComponents];
          }
        }
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

      if (operation === 'update-message') {
        const client = await getClient(credentials);
        const channelId = this.getNodeParameter('updateChannelId', i) as string;
        const messageId = this.getNodeParameter('updateMessageId', i) as string;
        const content = this.getNodeParameter('content', i, '') as string;
        const payloadMode = this.getNodeParameter('payloadMode', i, 'builder') as
          | 'builder'
          | 'raw-json'
          | 'builder-merge';

        let embeds: APIEmbed[] = [];
        let components: APIActionRowComponent<any>[] = [];

        if (payloadMode === 'raw-json') {
          const embedsJson = this.getNodeParameter('embedsJson', i, '[]') as string;
          const componentsJson = this.getNodeParameter('componentsJson', i, '[]') as string;
          embeds = parseJsonField<APIEmbed[]>(embedsJson, 'Embeds JSON', this);
          components = parseJsonField<APIActionRowComponent<any>[]>(componentsJson, 'Components JSON', this);
        } else {
          const embedBuilderParam = this.getNodeParameter('embedBuilder', i, {}) as {
            embed?: EmbedUiParams[];
          };
          const buttonBuilderParam = this.getNodeParameter('buttonBuilder', i, {}) as {
            button?: ButtonUiParams[];
          };
          const stringSelectParam = this.getNodeParameter('stringSelectBuilder', i, {}) as {
            select?: StringSelectMenuUiParams[];
          };
          const autoSelectParam = this.getNodeParameter('autoSelectBuilder', i, {}) as {
            select?: AutoSelectMenuUiParams[];
          };
          embeds = buildEmbedsFromUi(embedBuilderParam.embed ?? [], this.getNode());
          components = buildAllComponentsFromUi(
            buttonBuilderParam.button ?? [],
            stringSelectParam.select ?? [],
            autoSelectParam.select ?? [],
            this.getNode(),
          ) as APIActionRowComponent<any>[];

          if (payloadMode === 'builder-merge') {
            const embedsJson = this.getNodeParameter('embedsJson', i, '[]') as string;
            const componentsJson = this.getNodeParameter('componentsJson', i, '[]') as string;
            const extraEmbeds = parseJsonField<APIEmbed[]>(embedsJson, 'Embeds JSON', this);
            const extraComponents = parseJsonField<APIActionRowComponent<any>[]>(
              componentsJson,
              'Components JSON',
              this,
            );
            embeds = [...embeds, ...extraEmbeds];
            components = [...components, ...extraComponents];
          }
        }

        if (!content && !embeds.length && !components.length) {
          throw new NodeOperationError(this.getNode(), 'Provide content, embeds, or components to update the message');
        }

        const channel = await client.channels.fetch(channelId);
        if (!channel || !channel.isTextBased() || !('messages' in channel)) {
          throw new NodeOperationError(this.getNode(), `Channel ${channelId} is not a text channel`);
        }
        const message = await (channel as any).messages.fetch(messageId);
        await message.edit({
          content: content || null,
          embeds,
          components: components as any,
        });

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

        if (!commandName.trim()) {
          throw new NodeOperationError(this.getNode(), 'Command Name is required');
        }
        if (!/^[\w-]{1,32}$/.test(commandName)) {
          throw new NodeOperationError(
            this.getNode(),
            'Command Name must be 1–32 characters and contain only lowercase letters, numbers, hyphens, or underscores',
          );
        }
        if (commandName !== commandName.toLowerCase()) {
          throw new NodeOperationError(
            this.getNode(),
            'Command Name must be lowercase (Discord requirement)',
          );
        }

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
        const useInputInteractionData = this.getNodeParameter('useInputInteractionData', i, true) as boolean;
        const content = this.getNodeParameter('content', i, '') as string;
        const ephemeral = this.getNodeParameter('ephemeral', i, false) as boolean;
        const replyPayloadMode = this.getNodeParameter('replyPayloadMode', i, 'builder') as
          | 'builder'
          | 'raw-json'
          | 'builder-merge';

        let interactionId: string;
        let interactionToken: string;

        if (useInputInteractionData) {
          const itemJson = items[i].json as Record<string, unknown>;
          interactionId = String(itemJson.interactionId ?? '').trim();
          interactionToken = String(itemJson.interactionToken ?? '').trim();

          if (!interactionId || !interactionToken) {
            throw new NodeOperationError(
              this.getNode(),
              'Input item is missing interactionId or interactionToken. Connect Discord Bot Trigger output or disable "Use Interaction Data From Input" and enter values manually.',
            );
          }
        } else {
          interactionId = this.getNodeParameter('interactionId', i) as string;
          interactionToken = this.getNodeParameter('interactionToken', i) as string;
        }

        let embeds: APIEmbed[];
        let components: APIActionRowComponent<any>[];

        if (replyPayloadMode === 'raw-json') {
          const replyEmbedsJson = this.getNodeParameter('replyEmbedsJson', i, '[]') as string;
          const replyComponentsJson = this.getNodeParameter('replyComponentsJson', i, '[]') as string;
          // Backward compat: if new fields are still at default, fall back to embedsJson / componentsJson
          const embedsJsonFallback = this.getNodeParameter('embedsJson', i, '[]') as string;
          const componentsJsonFallback = this.getNodeParameter('componentsJson', i, '[]') as string;
          embeds = parseJsonField<APIEmbed[]>(
            replyEmbedsJson !== '[]' ? replyEmbedsJson : embedsJsonFallback,
            'Embeds JSON',
            this,
          );
          components = parseJsonField<APIActionRowComponent<any>[]>(
            replyComponentsJson !== '[]' ? replyComponentsJson : componentsJsonFallback,
            'Components JSON',
            this,
          );
        } else {
          const replyEmbedsCollection = this.getNodeParameter('replyEmbeds', i, {}) as {
            embeds?: { embed?: EmbedUiParams[] };
          };
          const replyButtonsCollection = this.getNodeParameter('replyComponents', i, {}) as {
            buttons?: { button?: ButtonUiParams[] };
          };
          const replyStringSelectCollection = this.getNodeParameter('replyStringSelectBuilder', i, {}) as {
            select?: StringSelectMenuUiParams[];
          };
          const replyAutoSelectCollection = this.getNodeParameter('replyAutoSelectBuilder', i, {}) as {
            select?: AutoSelectMenuUiParams[];
          };
          embeds = buildEmbedsFromUi(replyEmbedsCollection.embeds?.embed ?? [], this.getNode());
          components = buildAllComponentsFromUi(
            replyButtonsCollection.buttons?.button ?? [],
            replyStringSelectCollection.select ?? [],
            replyAutoSelectCollection.select ?? [],
            this.getNode(),
          ) as APIActionRowComponent<any>[];

          if (replyPayloadMode === 'builder-merge') {
            const replyEmbedsJson = this.getNodeParameter('replyEmbedsJson', i, '[]') as string;
            const replyComponentsJson = this.getNodeParameter('replyComponentsJson', i, '[]') as string;
            const extraEmbeds = parseJsonField<APIEmbed[]>(replyEmbedsJson, 'Embeds JSON', this);
            const extraComponents = parseJsonField<APIActionRowComponent<any>[]>(
              replyComponentsJson,
              'Components JSON',
              this,
            );
            embeds = [...embeds, ...extraEmbeds];
            components = [...components, ...extraComponents];
          }
        }


        const responseBody = {
          content: content || undefined,
          embeds,
          components,
          ...(ephemeral ? { flags: 64 } : {}),
        };

        const rest = new REST({ version: '10' });
        let responseType: 'initial' | 'follow-up' = 'initial';

        try {
          await rest.post(Routes.interactionCallback(interactionId, interactionToken), {
            auth: false,
            body: {
              type: 4,
              data: responseBody,
            },
          });
        } catch (error) {
          if (!isAlreadyAcknowledgedInteractionError(error)) {
            throw error;
          }

          await rest.post(Routes.webhook(credentials.clientId, interactionToken), {
            auth: false,
            body: responseBody,
          });
          responseType = 'follow-up';
        }

        returnData.push({
          json: {
            operation,
            interactionId,
            responded: true,
            responseType,
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
