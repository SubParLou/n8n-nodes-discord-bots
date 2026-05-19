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
  buildModalFromUi,
  type AutoSelectMenuUiParams,
  type ButtonUiParams,
  type EmbedUiParams,
  type ModalUiParams,
  type StringSelectMenuUiParams,
} from './messageBuilder';

type Operation =
  | 'send-message'
  | 'update-message'
  | 'register-slash-command'
  | 'respond-to-interaction'
  | 'add-reaction'
  | 'add-role'
  | 'ban-member'
  | 'bulk-delete-messages'
  | 'delete-message'
  | 'fetch-member'
  | 'fetch-message'
  | 'fetch-message-history'
  | 'kick-member'
  | 'pin-message'
  | 'remove-own-reaction'
  | 'remove-role'
  | 'send-modal'
  | 'set-nickname'
  | 'timeout-member'
  | 'unban-member'
  | 'unpin-message'
  | 'add-thread-member'
  | 'create-thread'
  | 'create-thread-from-message'
  | 'edit-thread'
  | 'remove-thread-member'
  | 'create-scheduled-event'
  | 'delete-scheduled-event'
  | 'edit-scheduled-event'
  | 'list-scheduled-events';

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
          { name: 'Add Reaction', value: 'add-reaction' },
          { name: 'Add Role to Member', value: 'add-role' },
          { name: 'Add Thread Member', value: 'add-thread-member' },
          { name: 'Ban Member', value: 'ban-member' },
          { name: 'Bulk Delete Messages', value: 'bulk-delete-messages' },
          { name: 'Create Scheduled Event', value: 'create-scheduled-event' },
          { name: 'Create Thread', value: 'create-thread' },
          { name: 'Create Thread From Message', value: 'create-thread-from-message' },
          { name: 'Delete Message', value: 'delete-message' },
          { name: 'Delete Scheduled Event', value: 'delete-scheduled-event' },
          { name: 'Edit Scheduled Event', value: 'edit-scheduled-event' },
          { name: 'Edit Thread', value: 'edit-thread' },
          { name: 'Fetch Member', value: 'fetch-member' },
          { name: 'Fetch Message', value: 'fetch-message' },
          { name: 'Fetch Message History', value: 'fetch-message-history' },
          { name: 'Kick Member', value: 'kick-member' },
          { name: 'List Scheduled Events', value: 'list-scheduled-events' },
          { name: 'Pin Message', value: 'pin-message' },
          { name: 'Register Slash Command', value: 'register-slash-command' },
          { name: 'Remove Own Reaction', value: 'remove-own-reaction' },
          { name: 'Remove Role From Member', value: 'remove-role' },
          { name: 'Remove Thread Member', value: 'remove-thread-member' },
          { name: 'Respond to Interaction', value: 'respond-to-interaction' },
          { name: 'Send Message', value: 'send-message' },
          { name: 'Send Modal', value: 'send-modal' },
          { name: 'Set Member Nickname', value: 'set-nickname' },
          { name: 'Timeout Member', value: 'timeout-member' },
          { name: 'Unban Member', value: 'unban-member' },
          { name: 'Unpin Message', value: 'unpin-message' },
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

      // ─── Message Operation Shared Fields ───────────────────────────────────
      {
        displayName: 'Guild Names or IDs',
        name: 'msgOpGuildIds',
        type: 'multiOptions',
        typeOptions: { loadOptionsMethod: 'getGuilds' },
        displayOptions: {
          show: {
            operation: ['delete-message', 'fetch-message', 'add-reaction', 'remove-own-reaction', 'pin-message', 'unpin-message'],
          },
        },
        default: [],
        description: 'Used to load channels. Choose from the list, or specify IDs using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
      },
      {
        displayName: 'Channel Name or ID',
        name: 'msgOpChannelId',
        type: 'options',
        description: 'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
        typeOptions: { loadOptionsMethod: 'getMsgOpChannels', loadOptionsDependsOn: ['msgOpGuildIds'] },
        displayOptions: {
          show: {
            operation: ['delete-message', 'fetch-message', 'add-reaction', 'remove-own-reaction', 'pin-message', 'unpin-message'],
          },
        },
        default: '',
        required: true,
      },
      {
        displayName: 'Message ID',
        name: 'msgOpMessageId',
        type: 'string',
        displayOptions: {
          show: {
            operation: ['delete-message', 'fetch-message', 'add-reaction', 'remove-own-reaction', 'pin-message', 'unpin-message'],
          },
        },
        default: '',
        required: true,
        description: 'The ID of the target message',
      },
      {
        displayName: 'Emoji',
        name: 'reactionEmoji',
        type: 'string',
        displayOptions: {
          show: {
            operation: ['add-reaction', 'remove-own-reaction'],
          },
        },
        default: '',
        required: true,
        description: 'Unicode emoji (e.g. 👍) or custom emoji in name:ID format (e.g. wave:123456789012345678).',
      },

      // ─── Fetch History & Bulk Delete Shared Fields ──────────────────────────
      {
        displayName: 'Guild Names or IDs',
        name: 'historyGuildIds',
        type: 'multiOptions',
        typeOptions: { loadOptionsMethod: 'getGuilds' },
        displayOptions: {
          show: {
            operation: ['fetch-message-history', 'bulk-delete-messages'],
          },
        },
        default: [],
        description: 'Used to load channels. Choose from the list, or specify IDs using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
      },
      {
        displayName: 'Channel Name or ID',
        name: 'historyChannelId',
        type: 'options',
        description: 'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
        typeOptions: { loadOptionsMethod: 'getHistoryChannels', loadOptionsDependsOn: ['historyGuildIds'] },
        displayOptions: {
          show: {
            operation: ['fetch-message-history', 'bulk-delete-messages'],
          },
        },
        default: '',
        required: true,
      },
      {
        displayName: 'Limit',
        name: 'historyLimit',
        type: 'number',
        typeOptions: { minValue: 1, maxValue: 100 },
        displayOptions: {
          show: { operation: ['fetch-message-history'] },
        },
        default: 50,
        description: 'Number of messages to retrieve (1–100)',
      },
      {
        displayName: 'Before Message ID',
        name: 'historyBefore',
        type: 'string',
        displayOptions: {
          show: { operation: ['fetch-message-history'] },
        },
        default: '',
        description: 'Return messages posted before this message ID (for pagination)',
      },
      {
        displayName: 'After Message ID',
        name: 'historyAfter',
        type: 'string',
        displayOptions: {
          show: { operation: ['fetch-message-history'] },
        },
        default: '',
        description: 'Return messages posted after this message ID (for pagination)',
      },
      {
        displayName: 'Message IDs',
        name: 'bulkMessageIds',
        type: 'string',
        displayOptions: {
          show: { operation: ['bulk-delete-messages'] },
        },
        default: '',
        required: true,
        description: 'Comma-separated list or JSON array of message IDs to delete (max 100; messages older than 14 days are automatically skipped by Discord)',
      },

      // ─── Send Modal Fields ──────────────────────────────────────────────────
      {
        displayName: 'Use Interaction Data From Input',
        name: 'modalUseInputData',
        type: 'boolean',
        displayOptions: {
          show: { operation: ['send-modal'] },
        },
        default: true,
        description: 'Whether to read interactionId and interactionToken from the incoming item (e.g. from Discord Bot Trigger)',
      },
      {
        displayName: 'Interaction ID',
        name: 'modalInteractionId',
        type: 'string',
        displayOptions: {
          show: { operation: ['send-modal'], modalUseInputData: [false] },
        },
        default: '',
        required: true,
      },
      {
        displayName: 'Interaction Token',
        name: 'modalInteractionToken',
        type: 'string',
        typeOptions: { password: true },
        displayOptions: {
          show: { operation: ['send-modal'], modalUseInputData: [false] },
        },
        default: '',
        required: true,
      },
      {
        displayName: 'Modal Custom ID',
        name: 'modalCustomId',
        type: 'string',
        displayOptions: {
          show: { operation: ['send-modal'] },
        },
        default: '',
        required: true,
        description: 'Unique identifier for this modal; returned in the Modal Submit trigger payload as customId',
      },
      {
        displayName: 'Modal Title',
        name: 'modalTitle',
        type: 'string',
        displayOptions: {
          show: { operation: ['send-modal'] },
        },
        default: '',
        required: true,
        description: 'Title shown at the top of the modal (max 45 characters)',
      },
      {
        displayName: 'Text Inputs',
        name: 'modalInputs',
        type: 'fixedCollection',
        typeOptions: { multipleValues: true },
        displayOptions: {
          show: { operation: ['send-modal'] },
        },
        default: {},
        placeholder: 'Add Text Input',
        description: 'Up to 5 text input fields for the modal form',
        options: [
          {
            displayName: 'Text Input',
            name: 'input',
            values: [
              {
                displayName: 'Custom ID',
                name: 'customId',
                type: 'string',
                required: true,
                default: '',
                description: 'Identifier for this field, included in the modal submit payload',
              },
              {
                displayName: 'Label',
                name: 'label',
                type: 'string',
                required: true,
                default: '',
                description: 'Label shown above the input (max 45 characters)',
              },
              {
                displayName: 'Max Length',
                name: 'maxLength',
                type: 'number',
                typeOptions: { minValue: 0, maxValue: 4000 },
                default: 0,
                description: 'Maximum number of characters allowed (0 = Discord default)',
              },
              {
                displayName: 'Min Length',
                name: 'minLength',
                type: 'number',
                typeOptions: { minValue: 0, maxValue: 4000 },
                default: 0,
                description: 'Minimum number of characters required (0 = no minimum)',
              },
              {
                displayName: 'Placeholder',
                name: 'placeholder',
                type: 'string',
                default: '',
                description: 'Greyed-out text shown inside the input when empty (max 100 characters)',
              },
              {
                displayName: 'Pre-Filled Value',
                name: 'value',
                type: 'string',
                default: '',
                description: 'Text pre-filled in the input when the modal opens',
              },
              {
                displayName: 'Required',
                name: 'required',
                type: 'boolean',
                default: true,
              },
              {
                displayName: 'Style',
                name: 'style',
                type: 'options',
                options: [
                  { name: 'Short (Single Line)', value: 1 },
                  { name: 'Paragraph (Multi-Line)', value: 2 },
                ],
                default: 1,
              },
            ],
          },
        ],
      },

      // ─── Member Management Shared Fields ───────────────────────────────────
      {
        displayName: 'Guild ID',
        name: 'memberGuildId',
        type: 'string',
        displayOptions: {
          show: {
            operation: ['add-role', 'remove-role', 'kick-member', 'ban-member', 'unban-member', 'timeout-member', 'fetch-member', 'set-nickname'],
          },
        },
        default: '',
        required: true,
        description: 'The ID of the guild. Use <code>{{ $JSON.guildId }}</code> to pass from a trigger.',
      },
      {
        displayName: 'User ID',
        name: 'memberUserId',
        type: 'string',
        displayOptions: {
          show: {
            operation: ['add-role', 'remove-role', 'kick-member', 'ban-member', 'unban-member', 'timeout-member', 'fetch-member', 'set-nickname'],
          },
        },
        default: '',
        required: true,
        description: 'The Discord user ID of the target member. Use <code>{{ $JSON.userId }}</code> to pass from a trigger.',
      },
      {
        displayName: 'Role ID',
        name: 'memberRoleId',
        type: 'string',
        displayOptions: {
          show: { operation: ['add-role', 'remove-role'] },
        },
        default: '',
        required: true,
        description: 'The ID of the role to add or remove',
      },
      {
        displayName: 'Reason',
        name: 'memberReason',
        type: 'string',
        displayOptions: {
          show: { operation: ['kick-member', 'ban-member', 'timeout-member'] },
        },
        default: '',
        description: 'Reason for this moderation action (recorded in the guild audit log)',
      },
      {
        displayName: 'Delete Message Days',
        name: 'memberBanDeleteDays',
        type: 'number',
        typeOptions: { minValue: 0, maxValue: 7 },
        displayOptions: {
          show: { operation: ['ban-member'] },
        },
        default: 0,
        description: 'Number of days of the user\'s recent messages to delete (0–7)',
      },
      {
        displayName: 'Timeout Duration (Minutes)',
        name: 'memberTimeoutMinutes',
        type: 'number',
        typeOptions: { minValue: 1, maxValue: 40320 },
        displayOptions: {
          show: { operation: ['timeout-member'] },
        },
        default: 60,
        description: 'Duration to timeout the member in minutes (1 = 1 minute, 40320 = 28 days max)',
      },
      {
        displayName: 'Nickname',
        name: 'memberNickname',
        type: 'string',
        displayOptions: {
          show: { operation: ['set-nickname'] },
        },
        default: '',
        description: 'New server nickname for this member. Leave empty to clear the existing nickname.',
      },

      // ─── Thread Operation Fields ────────────────────────────────────────────
      {
        displayName: 'Guild Names or IDs',
        name: 'threadCreateGuildIds',
        type: 'multiOptions',
        typeOptions: { loadOptionsMethod: 'getGuilds' },
        displayOptions: {
          show: { operation: ['create-thread', 'create-thread-from-message'] },
        },
        default: [],
        description: 'Used to load channels. Choose from the list, or specify IDs using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
      },
      {
        displayName: 'Channel Name or ID',
        name: 'threadCreateChannelId',
        type: 'options',
        description: 'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
        typeOptions: { loadOptionsMethod: 'getThreadChannels', loadOptionsDependsOn: ['threadCreateGuildIds'] },
        displayOptions: {
          show: { operation: ['create-thread', 'create-thread-from-message'] },
        },
        default: '',
        required: true,
      },
      {
        displayName: 'Message ID',
        name: 'threadSourceMessageId',
        type: 'string',
        displayOptions: {
          show: { operation: ['create-thread-from-message'] },
        },
        default: '',
        required: true,
        description: 'ID of the message to attach this thread to',
      },
      {
        displayName: 'Thread Name',
        name: 'threadName',
        type: 'string',
        displayOptions: {
          show: { operation: ['create-thread', 'create-thread-from-message'] },
        },
        default: '',
        required: true,
        description: 'Name for the new thread (max 100 characters)',
      },
      {
        displayName: 'Thread Type',
        name: 'threadType',
        type: 'options',
        displayOptions: {
          show: { operation: ['create-thread'] },
        },
        options: [
          { name: 'Private Thread', value: 12 },
          { name: 'Public Thread', value: 11 },
        ],
        default: 11,
        description: 'Public threads are visible to all server members; private threads are invite-only',
      },
      {
        displayName: 'Auto Archive Duration',
        name: 'threadAutoArchiveDuration',
        type: 'options',
        displayOptions: {
          show: { operation: ['create-thread', 'create-thread-from-message'] },
        },
        options: [
          { name: '1 Day', value: 1440 },
          { name: '1 Hour', value: 60 },
          { name: '1 Week', value: 10080 },
          { name: '3 Days', value: 4320 },
        ],
        default: 1440,
        description: 'Archive the thread after this period of inactivity',
      },
      {
        displayName: 'Invitable',
        name: 'threadInvitable',
        type: 'boolean',
        displayOptions: {
          show: { operation: ['create-thread'], threadType: [12] },
        },
        default: true,
        description: 'Whether non-moderators can invite other members to this private thread',
      },
      {
        displayName: 'Slowmode Seconds',
        name: 'threadSlowmode',
        type: 'number',
        typeOptions: { minValue: 0, maxValue: 21600 },
        displayOptions: {
          show: { operation: ['create-thread', 'create-thread-from-message'] },
        },
        default: 0,
        description: 'Seconds a member must wait between messages in this thread (0 to disable)',
      },
      {
        displayName: 'Reason',
        name: 'threadCreateReason',
        type: 'string',
        displayOptions: {
          show: { operation: ['create-thread', 'create-thread-from-message'] },
        },
        default: '',
        description: 'Reason for creating this thread (recorded in the guild audit log)',
      },
      {
        displayName: 'Thread ID',
        name: 'threadId',
        type: 'string',
        displayOptions: {
          show: { operation: ['edit-thread', 'add-thread-member', 'remove-thread-member'] },
        },
        default: '',
        required: true,
        description: 'The ID of the thread channel. Use <code>{{ $JSON.threadId }}</code> to pass from a trigger.',
      },
      {
        displayName: 'User ID',
        name: 'threadMemberUserId',
        type: 'string',
        displayOptions: {
          show: { operation: ['add-thread-member', 'remove-thread-member'] },
        },
        default: '',
        required: true,
        description: 'The Discord user ID to add or remove from the thread',
      },
      {
        displayName: 'Thread Edits',
        name: 'threadEditFields',
        type: 'collection',
        displayOptions: {
          show: { operation: ['edit-thread'] },
        },
        default: {},
        placeholder: 'Add Field',
        description: 'Fields to update on the thread. At least one must be set.',
        options: [
          {
            displayName: 'Archived',
            name: 'archived',
            type: 'boolean',
            default: false,
            description: 'Whether to archive (true) or unarchive (false) the thread',
          },
          {
            displayName: 'Auto Archive Duration',
            name: 'autoArchiveDuration',
            type: 'options',
            options: [
              { name: '1 Day', value: 1440 },
              { name: '1 Hour', value: 60 },
              { name: '1 Week', value: 10080 },
              { name: '3 Days', value: 4320 },
            ],
            default: 1440,
            description: 'Archive the thread after this period of inactivity',
          },
          {
            displayName: 'Locked',
            name: 'locked',
            type: 'boolean',
            default: false,
            description: 'Whether to lock the thread so only moderators can send messages',
          },
          {
            displayName: 'Name',
            name: 'name',
            type: 'string',
            default: '',
            description: 'New name for the thread (max 100 characters)',
          },
          {
            displayName: 'Reason',
            name: 'reason',
            type: 'string',
            default: '',
            description: 'Reason for editing this thread (recorded in the guild audit log)',
          },
          {
            displayName: 'Slowmode Seconds',
            name: 'rateLimitPerUser',
            type: 'number',
            typeOptions: { minValue: 0, maxValue: 21600 },
            default: 0,
            description: 'Seconds a member must wait between messages (0 to disable)',
          },
        ],
      },

      // ─── Scheduled Event Shared Fields ──────────────────────────────────────
      {
        displayName: 'Guild ID',
        name: 'scheduledEventGuildId',
        type: 'string',
        displayOptions: {
          show: {
            operation: ['create-scheduled-event', 'delete-scheduled-event', 'edit-scheduled-event', 'list-scheduled-events'],
          },
        },
        default: '',
        required: true,
        description: 'The ID of the guild. Use <code>{{ $JSON.guildId }}</code> to pass from a trigger.',
      },
      {
        displayName: 'Event ID',
        name: 'scheduledEventId',
        type: 'string',
        displayOptions: {
          show: {
            operation: ['delete-scheduled-event', 'edit-scheduled-event'],
          },
        },
        default: '',
        required: true,
        description: 'The ID of the scheduled event',
      },

      // ─── Create Scheduled Event Fields ──────────────────────────────────────
      {
        displayName: 'Event Name',
        name: 'scheduledEventName',
        type: 'string',
        displayOptions: {
          show: { operation: ['create-scheduled-event'] },
        },
        default: '',
        required: true,
        description: 'The name of the event (max 100 characters)',
      },
      {
        displayName: 'Start Time',
        name: 'scheduledEventStartTime',
        type: 'string',
        displayOptions: {
          show: { operation: ['create-scheduled-event'] },
        },
        default: '',
        required: true,
        description: 'ISO 8601 datetime string for when the event starts (e.g. <code>2024-12-31T20:00:00Z</code>)',
      },
      {
        displayName: 'Entity Type',
        name: 'scheduledEventEntityType',
        type: 'options',
        displayOptions: {
          show: { operation: ['create-scheduled-event'] },
        },
        default: 2,
        options: [
          { name: 'External Location', value: 3 },
          { name: 'Stage Channel', value: 1 },
          { name: 'Voice Channel', value: 2 },
        ],
        description: 'The type of location for this event',
      },
      {
        displayName: 'Channel ID',
        name: 'scheduledEventChannelId',
        type: 'string',
        displayOptions: {
          show: {
            operation: ['create-scheduled-event'],
            scheduledEventEntityType: [1, 2],
          },
        },
        default: '',
        required: true,
        description: 'ID of the voice or stage channel where the event will take place',
      },
      {
        displayName: 'Location',
        name: 'scheduledEventLocation',
        type: 'string',
        displayOptions: {
          show: {
            operation: ['create-scheduled-event'],
            scheduledEventEntityType: [3],
          },
        },
        default: '',
        required: true,
        description: 'Physical or virtual location description for the external event',
      },
      {
        displayName: 'Additional Fields',
        name: 'scheduledEventCreateFields',
        type: 'collection',
        placeholder: 'Add Field',
        displayOptions: {
          show: { operation: ['create-scheduled-event'] },
        },
        default: {},
        options: [
          {
            displayName: 'Description',
            name: 'description',
            type: 'string',
            default: '',
            description: 'Description of the event (max 1000 characters)',
          },
          {
            displayName: 'End Time',
            name: 'scheduledEndTime',
            type: 'string',
            default: '',
            description: 'ISO 8601 datetime string for when the event ends. Required for External entity type.',
          },
          {
            displayName: 'Image URL',
            name: 'imageUrl',
            type: 'string',
            default: '',
            description: 'URL of a cover image for the event',
          },
          {
            displayName: 'Reason',
            name: 'reason',
            type: 'string',
            default: '',
            description: 'Reason recorded in the guild audit log',
          },
        ],
      },

      // ─── Edit Scheduled Event Fields ────────────────────────────────────────
      {
        displayName: 'Event Edit Fields',
        name: 'scheduledEventEditFields',
        type: 'collection',
        placeholder: 'Add Field',
        displayOptions: {
          show: { operation: ['edit-scheduled-event'] },
        },
        default: {},
        description: 'Fields to update on the scheduled event. At least one must be set.',
        options: [
          {
            displayName: 'Channel ID',
            name: 'channelId',
            type: 'string',
            default: '',
            description: 'Move the event to a different voice or stage channel',
          },
          {
            displayName: 'Description',
            name: 'description',
            type: 'string',
            default: '',
          },
          {
            displayName: 'End Time',
            name: 'scheduledEndTime',
            type: 'string',
            default: '',
            description: 'ISO 8601 datetime string',
          },
          {
            displayName: 'Image URL',
            name: 'imageUrl',
            type: 'string',
            default: '',
            description: 'URL of a new cover image for the event',
          },
          {
            displayName: 'Location',
            name: 'location',
            type: 'string',
            default: '',
            description: 'New location for External entity type events',
          },
          {
            displayName: 'Name',
            name: 'name',
            type: 'string',
            default: '',
            description: 'New name for the event',
          },
          {
            displayName: 'Reason',
            name: 'reason',
            type: 'string',
            default: '',
            description: 'Reason recorded in the guild audit log',
          },
          {
            displayName: 'Start Time',
            name: 'scheduledStartTime',
            type: 'string',
            default: '',
            description: 'ISO 8601 datetime string',
          },
          {
            displayName: 'Status',
            name: 'status',
            type: 'options',
            default: 1,
            options: [
              { name: 'Active', value: 2 },
              { name: 'Canceled', value: 4 },
              { name: 'Completed', value: 3 },
              { name: 'Scheduled', value: 1 },
            ],
            description: 'New status for the event',
          },
        ],
      },

      // ─── Delete Scheduled Event Fields ──────────────────────────────────────
      {
        displayName: 'Reason',
        name: 'scheduledEventDeleteReason',
        type: 'string',
        displayOptions: {
          show: { operation: ['delete-scheduled-event'] },
        },
        default: '',
        description: 'Reason recorded in the guild audit log',
      },

      // ─── List Scheduled Events Fields ───────────────────────────────────────
      {
        displayName: 'Include User Count',
        name: 'scheduledEventWithUserCount',
        type: 'boolean',
        displayOptions: {
          show: { operation: ['list-scheduled-events'] },
        },
        default: true,
        description: 'Whether to include the count of users subscribed to each event',
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
      async getMsgOpChannels(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
        const credentials = (await this.getCredentials('discordBotApi')) as DiscordBotCredentials;
        const guildIds = this.getNodeParameter('msgOpGuildIds', 0) as string[];
        if (!guildIds.length) {
          throw new NodeOperationError(this.getNode(), 'Select at least one guild first');
        }
        return loadChannelOptions(credentials, guildIds);
      },
      async getHistoryChannels(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
        const credentials = (await this.getCredentials('discordBotApi')) as DiscordBotCredentials;
        const guildIds = this.getNodeParameter('historyGuildIds', 0) as string[];
        if (!guildIds.length) {
          throw new NodeOperationError(this.getNode(), 'Select at least one guild first');
        }
        return loadChannelOptions(credentials, guildIds);
      },
      async getThreadChannels(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
        const credentials = (await this.getCredentials('discordBotApi')) as DiscordBotCredentials;
        const guildIds = this.getNodeParameter('threadCreateGuildIds', 0) as string[];
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

      // ─── Message Management Operations ────────────────────────────────────

      if (operation === 'delete-message') {
        const client = await getClient(credentials);
        const channelId = this.getNodeParameter('msgOpChannelId', i) as string;
        const messageId = this.getNodeParameter('msgOpMessageId', i) as string;

        const channel = await client.channels.fetch(channelId);
        if (!channel || !channel.isTextBased() || !('messages' in channel)) {
          throw new NodeOperationError(this.getNode(), `Channel ${channelId} is not a text channel`);
        }
        const message = await (channel as any).messages.fetch(messageId);
        await message.delete();

        returnData.push({ json: { operation, channelId, messageId, deleted: true }, pairedItem: { item: i } });
        continue;
      }

      if (operation === 'fetch-message') {
        const client = await getClient(credentials);
        const channelId = this.getNodeParameter('msgOpChannelId', i) as string;
        const messageId = this.getNodeParameter('msgOpMessageId', i) as string;

        const channel = await client.channels.fetch(channelId);
        if (!channel || !channel.isTextBased() || !('messages' in channel)) {
          throw new NodeOperationError(this.getNode(), `Channel ${channelId} is not a text channel`);
        }
        const message = await (channel as any).messages.fetch(messageId);

        returnData.push({
          json: {
            operation,
            messageId: message.id,
            channelId: message.channelId,
            guildId: message.guildId,
            content: message.content,
            authorId: message.author.id,
            authorUsername: message.author.username,
            authorIsBot: message.author.bot,
            createdTimestamp: message.createdTimestamp,
            editedTimestamp: message.editedTimestamp,
            pinned: message.pinned,
            attachments: [...message.attachments.values()].map((a: any) => ({
              id: a.id,
              name: a.name,
              url: a.url,
              size: a.size,
              contentType: a.contentType,
            })),
          },
          pairedItem: { item: i },
        });
        continue;
      }

      if (operation === 'fetch-message-history') {
        const client = await getClient(credentials);
        const channelId = this.getNodeParameter('historyChannelId', i) as string;
        const limit = this.getNodeParameter('historyLimit', i, 50) as number;
        const before = this.getNodeParameter('historyBefore', i, '') as string;
        const after = this.getNodeParameter('historyAfter', i, '') as string;

        const channel = await client.channels.fetch(channelId);
        if (!channel || !channel.isTextBased() || !('messages' in channel)) {
          throw new NodeOperationError(this.getNode(), `Channel ${channelId} is not a text channel`);
        }

        const fetchOptions: Record<string, unknown> = { limit };
        if (before) fetchOptions.before = before;
        if (after) fetchOptions.after = after;

        const messages = await (channel as any).messages.fetch(fetchOptions);
        for (const msg of (messages as Map<string, any>).values()) {
          returnData.push({
            json: {
              operation,
              messageId: msg.id,
              channelId: msg.channelId,
              guildId: msg.guildId,
              content: msg.content,
              authorId: msg.author.id,
              authorUsername: msg.author.username,
              authorIsBot: msg.author.bot,
              createdTimestamp: msg.createdTimestamp,
              editedTimestamp: msg.editedTimestamp,
              pinned: msg.pinned,
            },
            pairedItem: { item: i },
          });
        }
        continue;
      }

      if (operation === 'add-reaction' || operation === 'remove-own-reaction') {
        const client = await getClient(credentials);
        const channelId = this.getNodeParameter('msgOpChannelId', i) as string;
        const messageId = this.getNodeParameter('msgOpMessageId', i) as string;
        const emoji = this.getNodeParameter('reactionEmoji', i) as string;

        const channel = await client.channels.fetch(channelId);
        if (!channel || !channel.isTextBased() || !('messages' in channel)) {
          throw new NodeOperationError(this.getNode(), `Channel ${channelId} is not a text channel`);
        }
        const message = await (channel as any).messages.fetch(messageId);

        if (operation === 'add-reaction') {
          await message.react(emoji);
        } else {
          // discord.js caches custom-emoji reactions by snowflake ID, not by name:id string.
          const colonIndex = emoji.indexOf(':');
          const emojiId = colonIndex !== -1 ? emoji.slice(colonIndex + 1) : null;
          const reaction = emojiId
            ? message.reactions.cache.find((r: any) => r.emoji.id === emojiId)
            : message.reactions.cache.get(emoji);
          if (!reaction) {
            throw new NodeOperationError(this.getNode(), `Reaction '${emoji}' not found on message ${messageId}`);
          }
          await reaction.users.remove(client.user!.id);
        }

        returnData.push({ json: { operation, channelId, messageId, emoji }, pairedItem: { item: i } });
        continue;
      }

      if (operation === 'pin-message' || operation === 'unpin-message') {
        const client = await getClient(credentials);
        const channelId = this.getNodeParameter('msgOpChannelId', i) as string;
        const messageId = this.getNodeParameter('msgOpMessageId', i) as string;

        const channel = await client.channels.fetch(channelId);
        if (!channel || !channel.isTextBased() || !('messages' in channel)) {
          throw new NodeOperationError(this.getNode(), `Channel ${channelId} is not a text channel`);
        }
        const message = await (channel as any).messages.fetch(messageId);

        if (operation === 'pin-message') {
          await message.pin();
        } else {
          await message.unpin();
        }

        returnData.push({ json: { operation, channelId, messageId, pinned: operation === 'pin-message' }, pairedItem: { item: i } });
        continue;
      }

      if (operation === 'bulk-delete-messages') {
        const client = await getClient(credentials);
        const channelId = this.getNodeParameter('historyChannelId', i) as string;
        const messageIdsRaw = this.getNodeParameter('bulkMessageIds', i) as string;

        let messageIds: string[];
        const trimmed = messageIdsRaw.trim();
        if (trimmed.startsWith('[')) {
          messageIds = parseJsonField<string[]>(trimmed, 'Message IDs', this);
        } else {
          messageIds = trimmed.split(',').map((id) => id.trim()).filter(Boolean);
        }

        if (messageIds.length === 0) {
          throw new NodeOperationError(this.getNode(), 'Provide at least one message ID to delete');
        }
        if (messageIds.length > 100) {
          throw new NodeOperationError(this.getNode(), 'Bulk delete supports a maximum of 100 messages at once');
        }

        const channel = await client.channels.fetch(channelId);
        if (!channel || !channel.isTextBased() || !('bulkDelete' in channel)) {
          throw new NodeOperationError(this.getNode(), `Channel ${channelId} does not support bulk delete`);
        }
        // Pass true to filter out messages older than 14 days (Discord requirement)
        const deleted = await (channel as any).bulkDelete(messageIds, true);

        returnData.push({ json: { operation, channelId, deletedCount: deleted.size }, pairedItem: { item: i } });
        continue;
      }

      // ─── Send Modal ────────────────────────────────────────────────────────

      if (operation === 'send-modal') {
        const modalUseInputData = this.getNodeParameter('modalUseInputData', i, true) as boolean;

        let interactionId: string;
        let interactionToken: string;

        if (modalUseInputData) {
          const itemJson = items[i].json as Record<string, unknown>;
          interactionId = String(itemJson.interactionId ?? '').trim();
          interactionToken = String(itemJson.interactionToken ?? '').trim();
          if (!interactionId || !interactionToken) {
            throw new NodeOperationError(
              this.getNode(),
              'Input item is missing interactionId or interactionToken. Connect Discord Bot Trigger output or disable "Use Interaction Data From Input".',
            );
          }
        } else {
          interactionId = this.getNodeParameter('modalInteractionId', i) as string;
          interactionToken = this.getNodeParameter('modalInteractionToken', i) as string;
        }

        const modalCustomId = this.getNodeParameter('modalCustomId', i) as string;
        const modalTitle = this.getNodeParameter('modalTitle', i) as string;
        const modalInputsParam = this.getNodeParameter('modalInputs', i, {}) as ModalUiParams['inputs'];

        const modal = buildModalFromUi(
          { customId: modalCustomId, title: modalTitle, inputs: modalInputsParam },
          this.getNode(),
        );

        const rest = new REST({ version: '10' });
        await rest.post(Routes.interactionCallback(interactionId, interactionToken), {
          auth: false,
          body: { type: 9, data: modal },
        });

        returnData.push({ json: { operation, interactionId, modalCustomId, modalTitle }, pairedItem: { item: i } });
        continue;
      }

      // ─── Member Management Operations ─────────────────────────────────────

      if (operation === 'add-role' || operation === 'remove-role') {
        const client = await getClient(credentials);
        const guildId = this.getNodeParameter('memberGuildId', i) as string;
        const userId = this.getNodeParameter('memberUserId', i) as string;
        const roleId = this.getNodeParameter('memberRoleId', i) as string;

        const guild = await client.guilds.fetch(guildId);
        const member = await guild.members.fetch(userId);

        if (operation === 'add-role') {
          await member.roles.add(roleId);
        } else {
          await member.roles.remove(roleId);
        }

        returnData.push({ json: { operation, guildId, userId, roleId }, pairedItem: { item: i } });
        continue;
      }

      if (operation === 'kick-member') {
        const client = await getClient(credentials);
        const guildId = this.getNodeParameter('memberGuildId', i) as string;
        const userId = this.getNodeParameter('memberUserId', i) as string;
        const reason = this.getNodeParameter('memberReason', i, '') as string;

        const guild = await client.guilds.fetch(guildId);
        const member = await guild.members.fetch(userId);
        await member.kick(reason || undefined);

        returnData.push({ json: { operation, guildId, userId, reason: reason || null }, pairedItem: { item: i } });
        continue;
      }

      if (operation === 'ban-member') {
        const client = await getClient(credentials);
        const guildId = this.getNodeParameter('memberGuildId', i) as string;
        const userId = this.getNodeParameter('memberUserId', i) as string;
        const reason = this.getNodeParameter('memberReason', i, '') as string;
        const deleteMessageSeconds = (this.getNodeParameter('memberBanDeleteDays', i, 0) as number) * 86400;

        const guild = await client.guilds.fetch(guildId);
        await guild.bans.create(userId, { reason: reason || undefined, deleteMessageSeconds });

        returnData.push({ json: { operation, guildId, userId, reason: reason || null }, pairedItem: { item: i } });
        continue;
      }

      if (operation === 'unban-member') {
        const client = await getClient(credentials);
        const guildId = this.getNodeParameter('memberGuildId', i) as string;
        const userId = this.getNodeParameter('memberUserId', i) as string;

        const guild = await client.guilds.fetch(guildId);
        await guild.bans.remove(userId);

        returnData.push({ json: { operation, guildId, userId }, pairedItem: { item: i } });
        continue;
      }

      if (operation === 'timeout-member') {
        const client = await getClient(credentials);
        const guildId = this.getNodeParameter('memberGuildId', i) as string;
        const userId = this.getNodeParameter('memberUserId', i) as string;
        const minutes = this.getNodeParameter('memberTimeoutMinutes', i, 60) as number;
        const reason = this.getNodeParameter('memberReason', i, '') as string;

        const guild = await client.guilds.fetch(guildId);
        const member = await guild.members.fetch(userId);
        await member.timeout(minutes * 60 * 1000, reason || undefined);

        returnData.push({ json: { operation, guildId, userId, timeoutMinutes: minutes, reason: reason || null }, pairedItem: { item: i } });
        continue;
      }

      if (operation === 'fetch-member') {
        const client = await getClient(credentials);
        const guildId = this.getNodeParameter('memberGuildId', i) as string;
        const userId = this.getNodeParameter('memberUserId', i) as string;

        const guild = await client.guilds.fetch(guildId);
        const member = await guild.members.fetch(userId);

        returnData.push({
          json: {
            operation,
            userId: member.id,
            guildId: guild.id,
            userName: member.user.username,
            displayName: member.displayName,
            nickname: member.nickname,
            joinedAt: member.joinedAt?.toISOString() ?? null,
            // Filter @everyone role (same ID as guild)
            roleIds: [...member.roles.cache.keys()].filter((id) => id !== guild.id),
            isBot: member.user.bot,
            userAvatarUrl: member.user.displayAvatarURL(),
          },
          pairedItem: { item: i },
        });
        continue;
      }

      if (operation === 'set-nickname') {
        const client = await getClient(credentials);
        const guildId = this.getNodeParameter('memberGuildId', i) as string;
        const userId = this.getNodeParameter('memberUserId', i) as string;
        const nickname = this.getNodeParameter('memberNickname', i, '') as string;

        const guild = await client.guilds.fetch(guildId);
        const member = await guild.members.fetch(userId);
        await member.setNickname(nickname || null);

        returnData.push({ json: { operation, guildId, userId, nickname: nickname || null }, pairedItem: { item: i } });
        continue;
      }

      // ─── Thread Operations ───────────────────────────────────────────────────

      if (operation === 'create-thread-from-message') {
        const client = await getClient(credentials);
        const channelId = this.getNodeParameter('threadCreateChannelId', i) as string;
        const messageId = this.getNodeParameter('threadSourceMessageId', i) as string;
        const name = this.getNodeParameter('threadName', i) as string;
        const autoArchiveDuration = this.getNodeParameter('threadAutoArchiveDuration', i, 1440) as number;
        const rateLimitPerUser = this.getNodeParameter('threadSlowmode', i, 0) as number;
        const reason = this.getNodeParameter('threadCreateReason', i, '') as string;

        const channel = await client.channels.fetch(channelId);
        if (!channel || !channel.isTextBased() || !('messages' in channel)) {
          throw new NodeOperationError(this.getNode(), `Channel ${channelId} is not a text channel`);
        }
        const message = await (channel as any).messages.fetch(messageId);
        const thread = await message.startThread({
          name,
          autoArchiveDuration,
          ...(rateLimitPerUser ? { rateLimitPerUser } : {}),
          ...(reason ? { reason } : {}),
        });

        returnData.push({
          json: {
            operation,
            threadId: thread.id,
            threadName: thread.name,
            parentChannelId: thread.parentId,
            guildId: thread.guildId,
            archived: thread.archived,
            autoArchiveDuration: thread.autoArchiveDuration,
            createdTimestamp: thread.createdTimestamp,
          },
          pairedItem: { item: i },
        });
        continue;
      }

      if (operation === 'create-thread') {
        const client = await getClient(credentials);
        const channelId = this.getNodeParameter('threadCreateChannelId', i) as string;
        const name = this.getNodeParameter('threadName', i) as string;
        const threadType = this.getNodeParameter('threadType', i, 11) as number;
        const autoArchiveDuration = this.getNodeParameter('threadAutoArchiveDuration', i, 1440) as number;
        const invitable = this.getNodeParameter('threadInvitable', i, true) as boolean;
        const rateLimitPerUser = this.getNodeParameter('threadSlowmode', i, 0) as number;
        const reason = this.getNodeParameter('threadCreateReason', i, '') as string;

        const channel = await client.channels.fetch(channelId);
        if (!channel || !channel.isTextBased() || !('threads' in channel)) {
          throw new NodeOperationError(this.getNode(), `Channel ${channelId} does not support threads`);
        }
        const createOpts: Record<string, unknown> = { name, type: threadType, autoArchiveDuration };
        if (rateLimitPerUser) createOpts.rateLimitPerUser = rateLimitPerUser;
        if (reason) createOpts.reason = reason;
        if (threadType === 12) createOpts.invitable = invitable; // 12 = PrivateThread

        const thread = await (channel as any).threads.create(createOpts);

        returnData.push({
          json: {
            operation,
            threadId: thread.id,
            threadName: thread.name,
            parentChannelId: thread.parentId,
            guildId: thread.guildId,
            type: thread.type,
            archived: thread.archived,
            autoArchiveDuration: thread.autoArchiveDuration,
            createdTimestamp: thread.createdTimestamp,
          },
          pairedItem: { item: i },
        });
        continue;
      }

      if (operation === 'edit-thread') {
        const client = await getClient(credentials);
        const threadId = this.getNodeParameter('threadId', i) as string;
        const threadEditFields = this.getNodeParameter('threadEditFields', i, {}) as {
          name?: string;
          archived?: boolean;
          locked?: boolean;
          autoArchiveDuration?: number;
          rateLimitPerUser?: number;
          reason?: string;
        };

        const channel = await client.channels.fetch(threadId);
        if (!channel || !channel.isThread()) {
          throw new NodeOperationError(this.getNode(), `Channel ID ${threadId} is not a thread`);
        }

        const editOpts: Record<string, unknown> = {};
        if (threadEditFields.name) editOpts.name = threadEditFields.name;
        if (threadEditFields.archived !== undefined) editOpts.archived = threadEditFields.archived;
        if (threadEditFields.locked !== undefined) editOpts.locked = threadEditFields.locked;
        if (threadEditFields.autoArchiveDuration) editOpts.autoArchiveDuration = threadEditFields.autoArchiveDuration;
        if (threadEditFields.rateLimitPerUser !== undefined) editOpts.rateLimitPerUser = threadEditFields.rateLimitPerUser;
        if (threadEditFields.reason) editOpts.reason = threadEditFields.reason;

        if (Object.keys(editOpts).length === 0) {
          throw new NodeOperationError(this.getNode(), 'Add at least one field to edit (Name, Archived, Locked, etc.)');
        }

        await (channel as any).edit(editOpts);
        returnData.push({ json: { operation, threadId, updated: true }, pairedItem: { item: i } });
        continue;
      }

      if (operation === 'add-thread-member' || operation === 'remove-thread-member') {
        const client = await getClient(credentials);
        const threadId = this.getNodeParameter('threadId', i) as string;
        const userId = this.getNodeParameter('threadMemberUserId', i) as string;

        const channel = await client.channels.fetch(threadId);
        if (!channel || !channel.isThread()) {
          throw new NodeOperationError(this.getNode(), `Channel ID ${threadId} is not a thread`);
        }

        if (operation === 'add-thread-member') {
          await (channel as any).members.add(userId);
        } else {
          await (channel as any).members.remove(userId);
        }

        returnData.push({ json: { operation, threadId, userId }, pairedItem: { item: i } });
        continue;
      }

      if (operation === 'create-scheduled-event') {
        const client = await getClient(credentials);
        const guildId = this.getNodeParameter('scheduledEventGuildId', i) as string;
        const name = this.getNodeParameter('scheduledEventName', i) as string;
        const startTime = this.getNodeParameter('scheduledEventStartTime', i) as string;
        const entityType = this.getNodeParameter('scheduledEventEntityType', i) as number;
        const extraFields = this.getNodeParameter('scheduledEventCreateFields', i, {}) as {
          description?: string;
          scheduledEndTime?: string;
          imageUrl?: string;
          reason?: string;
        };

        const guild = await client.guilds.fetch(guildId);

        const createOptions: Record<string, unknown> = {
          name,
          scheduledStartTime: new Date(startTime),
          privacyLevel: 2, // GuildScheduledEventPrivacyLevel.GuildOnly
          entityType,
        };

        if (entityType === 1 || entityType === 2) {
          // Stage (1) or Voice (2) — channel required
          const channelId = this.getNodeParameter('scheduledEventChannelId', i) as string;
          if (!channelId) throw new NodeOperationError(this.getNode(), 'Channel ID is required for Voice and Stage events');
          createOptions.channel = channelId;
        } else if (entityType === 3) {
          // External — location and end time required
          const location = this.getNodeParameter('scheduledEventLocation', i) as string;
          if (!location) throw new NodeOperationError(this.getNode(), 'Location is required for External events');
          if (!extraFields.scheduledEndTime) throw new NodeOperationError(this.getNode(), 'End Time is required for External events');
          createOptions.entityMetadata = { location };
        }

        if (extraFields.scheduledEndTime) createOptions.scheduledEndTime = new Date(extraFields.scheduledEndTime);
        if (extraFields.description) createOptions.description = extraFields.description;
        if (extraFields.imageUrl) createOptions.image = extraFields.imageUrl;
        if (extraFields.reason) createOptions.reason = extraFields.reason;

        const event = await (guild.scheduledEvents as any).create(createOptions);
        returnData.push({
          json: {
            operation,
            eventId: event.id,
            eventName: event.name,
            guildId: event.guildId,
            channelId: event.channelId,
            entityType: event.entityType,
            status: event.status,
            scheduledStartTime: event.scheduledStartTime,
            scheduledEndTime: event.scheduledEndTime,
            description: event.description,
            url: event.url,
          },
          pairedItem: { item: i },
        });
        continue;
      }

      if (operation === 'edit-scheduled-event') {
        const client = await getClient(credentials);
        const guildId = this.getNodeParameter('scheduledEventGuildId', i) as string;
        const eventId = this.getNodeParameter('scheduledEventId', i) as string;
        const editFields = this.getNodeParameter('scheduledEventEditFields', i, {}) as {
          name?: string;
          scheduledStartTime?: string;
          scheduledEndTime?: string;
          channelId?: string;
          location?: string;
          description?: string;
          imageUrl?: string;
          status?: number;
          reason?: string;
        };

        const guild = await client.guilds.fetch(guildId);
        const event = await (guild.scheduledEvents as any).fetch(eventId);

        const editOptions: Record<string, unknown> = {};
        if (editFields.name) editOptions.name = editFields.name;
        if (editFields.scheduledStartTime) editOptions.scheduledStartTime = new Date(editFields.scheduledStartTime);
        if (editFields.scheduledEndTime) editOptions.scheduledEndTime = new Date(editFields.scheduledEndTime);
        if (editFields.channelId) editOptions.channel = editFields.channelId;
        if (editFields.location) editOptions.entityMetadata = { location: editFields.location };
        if (editFields.description !== undefined) editOptions.description = editFields.description;
        if (editFields.imageUrl) editOptions.image = editFields.imageUrl;
        if (editFields.status !== undefined) editOptions.status = editFields.status;
        if (editFields.reason) editOptions.reason = editFields.reason;

        if (Object.keys(editOptions).length === 0) {
          throw new NodeOperationError(this.getNode(), 'Add at least one field to edit');
        }

        const updated = await event.edit(editOptions);
        returnData.push({
          json: {
            operation,
            eventId: updated.id,
            eventName: updated.name,
            guildId: updated.guildId,
            channelId: updated.channelId,
            entityType: updated.entityType,
            status: updated.status,
            scheduledStartTime: updated.scheduledStartTime,
            scheduledEndTime: updated.scheduledEndTime,
            description: updated.description,
            url: updated.url,
          },
          pairedItem: { item: i },
        });
        continue;
      }

      if (operation === 'delete-scheduled-event') {
        const client = await getClient(credentials);
        const guildId = this.getNodeParameter('scheduledEventGuildId', i) as string;
        const eventId = this.getNodeParameter('scheduledEventId', i) as string;

        const guild = await client.guilds.fetch(guildId);
        await (guild.scheduledEvents as any).delete(eventId);

        returnData.push({
          json: { operation, eventId, guildId, deleted: true },
          pairedItem: { item: i },
        });
        continue;
      }

      if (operation === 'list-scheduled-events') {
        const client = await getClient(credentials);
        const guildId = this.getNodeParameter('scheduledEventGuildId', i) as string;
        const withUserCount = this.getNodeParameter('scheduledEventWithUserCount', i, true) as boolean;

        const guild = await client.guilds.fetch(guildId);
        const events = await (guild.scheduledEvents as any).fetch({ withUserCount });

        const eventList = [...events.values()].map((event: any) => ({
          eventId: event.id,
          eventName: event.name,
          guildId: event.guildId,
          channelId: event.channelId,
          entityType: event.entityType,
          status: event.status,
          scheduledStartTime: event.scheduledStartTime,
          scheduledEndTime: event.scheduledEndTime,
          description: event.description,
          url: event.url,
          userCount: event.memberCount ?? null,
          location: event.entityMetadata?.location ?? null,
          creatorId: event.creatorId,
        }));

        returnData.push({
          json: { operation, guildId, count: eventList.length, events: eventList },
          pairedItem: { item: i },
        });
        continue;
      }

      throw new NodeOperationError(this.getNode(), `Unsupported operation: ${operation}`);
    }

    return [returnData];
  }
}
