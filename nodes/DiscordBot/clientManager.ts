import {
  ChannelType,
  Client,
  GatewayIntentBits,
  Partials,
  REST,
  Routes,
  type ApplicationCommandOptionData,
  type ClientEvents,
  type Guild,
} from 'discord.js';
import type { INodePropertyOptions } from 'n8n-workflow';
import type { CachedDiscordClient, DiscordBotCredentials } from './types';

const clients = new Map<string, CachedDiscordClient>();

function createDiscordClient(token: string): CachedDiscordClient {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildModeration,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.GuildMessageReactions,
      GatewayIntentBits.GuildPresences,
      GatewayIntentBits.GuildScheduledEvents,
      GatewayIntentBits.GuildVoiceStates,
      GatewayIntentBits.GuildMessagePolls,
      GatewayIntentBits.DirectMessages,
      GatewayIntentBits.DirectMessageReactions,
      GatewayIntentBits.DirectMessagePolls,
      GatewayIntentBits.MessageContent,
    ],
    partials: [Partials.Channel, Partials.GuildMember, Partials.Message, Partials.Reaction, Partials.User],
  });

  const ready = new Promise<Client>((resolve, reject) => {
    const onReady = () => {
      client.off('error', onError);
      resolve(client);
    };

    const onError = (error: Error) => {
      client.off('ready', onReady);
      reject(error);
    };

    client.once('ready', onReady);
    client.once('error', onError);

    client.login(token).catch(reject);
  });

  return { client, ready };
}

export async function getClient(credentials: DiscordBotCredentials): Promise<Client> {
  const { token } = credentials;
  if (!token) {
    throw new Error('Missing Discord bot token');
  }

  let cached = clients.get(token);
  if (!cached) {
    cached = createDiscordClient(token);
    clients.set(token, cached);
  }

  try {
    await cached.ready;
    if (!cached.client.isReady()) {
      // Client lost its connection after the initial ready — discard and reconnect.
      clients.delete(token);
      return getClient(credentials);
    }
    return cached.client;
  } catch (error) {
    clients.delete(token);
    throw error;
  }
}

export function addClientListener<T extends keyof ClientEvents>(
  client: Client,
  event: T,
  listener: (...args: ClientEvents[T]) => void,
): () => void {
  client.on(event, listener);
  return () => {
    client.off(event, listener);
  };
}

export async function loadGuildOptions(credentials: DiscordBotCredentials): Promise<INodePropertyOptions[]> {
  const client = await getClient(credentials);
  const guilds = await client.guilds.fetch();
  return guilds.map((guild) => ({
    name: guild.name,
    value: guild.id,
  }));
}

/**
 * Fetch options across the given guilds, deduped by ID. The `collect` callback
 * fetches the relevant resource (channels, roles, …) for one guild and adds
 * `{ name, value }` entries to the shared map. Per-guild failures are logged
 * and skipped so one bad guild does not blank the whole list.
 */
async function loadGuildResourceOptions(
  credentials: DiscordBotCredentials,
  guildIds: string[],
  collect: (guild: Guild, optionsById: Map<string, INodePropertyOptions>) => Promise<void>,
): Promise<INodePropertyOptions[]> {
  const client = await getClient(credentials);
  const uniqueGuildIds = [...new Set(guildIds)];
  const optionsById = new Map<string, INodePropertyOptions>();

  await Promise.all(
    uniqueGuildIds.map(async (guildId) => {
      try {
        const guild = await client.guilds.fetch(guildId);
        await collect(guild, optionsById);
      } catch (error) {
        console.warn('[DiscordBot] Failed to load options for guild', {
          guildId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }),
  );

  return [...optionsById.values()];
}

const FORUM_CHANNEL_TYPES = [ChannelType.GuildForum, ChannelType.GuildMedia];

export function loadChannelOptions(
  credentials: DiscordBotCredentials,
  guildIds: string[],
  extraTypes: ChannelType[] = [],
): Promise<INodePropertyOptions[]> {
  const types = new Set<ChannelType>([ChannelType.GuildText, ChannelType.GuildAnnouncement, ...extraTypes]);
  return loadGuildResourceOptions(credentials, guildIds, async (guild, optionsById) => {
    const channels = await guild.channels.fetch();
    channels.forEach((channel) => {
      if (channel && types.has(channel.type)) {
        optionsById.set(channel.id, { name: `${guild.name} / ${channel.name}`, value: channel.id });
      }
    });
  });
}

export function loadForumChannelOptions(
  credentials: DiscordBotCredentials,
  guildIds: string[],
): Promise<INodePropertyOptions[]> {
  return loadGuildResourceOptions(credentials, guildIds, async (guild, optionsById) => {
    const channels = await guild.channels.fetch();
    channels.forEach((channel) => {
      if (channel && FORUM_CHANNEL_TYPES.includes(channel.type)) {
        optionsById.set(channel.id, { name: `${guild.name} / ${channel.name}`, value: channel.id });
      }
    });
  });
}

export async function loadForumTagOptions(
  credentials: DiscordBotCredentials,
  channelId: string,
): Promise<INodePropertyOptions[]> {
  if (!channelId) {
    return [];
  }
  const client = await getClient(credentials);
  const channel = await client.channels.fetch(channelId);
  if (!channel || !FORUM_CHANNEL_TYPES.includes(channel.type) || !('availableTags' in channel)) {
    return [];
  }
  return channel.availableTags.map((tag) => ({ name: tag.name, value: tag.id }));
}

export function loadVoiceChannelOptions(
  credentials: DiscordBotCredentials,
  guildIds: string[],
): Promise<INodePropertyOptions[]> {
  return loadGuildResourceOptions(credentials, guildIds, async (guild, optionsById) => {
    const channels = await guild.channels.fetch();
    channels.forEach((channel) => {
      if (channel?.type === ChannelType.GuildVoice || channel?.type === ChannelType.GuildStageVoice) {
        optionsById.set(channel.id, { name: `${guild.name} / ${channel.name}`, value: channel.id });
      }
    });
  });
}

export function loadRoleOptions(
  credentials: DiscordBotCredentials,
  guildIds: string[],
): Promise<INodePropertyOptions[]> {
  return loadGuildResourceOptions(credentials, guildIds, async (guild, optionsById) => {
    const roles = await guild.roles.fetch();
    roles.forEach((role) => {
      if (role && role.name !== '@everyone') {
        optionsById.set(role.id, { name: `${guild.name} / ${role.name}`, value: role.id });
      }
    });
  });
}

export async function registerSlashCommand(parameters: {
  token: string;
  clientId: string;
  guildId?: string;
  name: string;
  description: string;
  options?: ApplicationCommandOptionData[];
}): Promise<{ id: string; name: string }> {
  const { token, clientId, guildId, name, description, options } = parameters;

  const rest = new REST({ version: '10' }).setToken(token);
  const route = guildId
    ? Routes.applicationGuildCommands(clientId, guildId)
    : Routes.applicationCommands(clientId);

  const response = (await rest.post(route, {
    body: {
      name,
      description,
      options: options ?? [],
    },
  })) as { id: string; name: string };

  return response;
}

export async function deleteSlashCommand(parameters: {
  token: string;
  clientId: string;
  commandId: string;
  guildId?: string;
}): Promise<void> {
  const { token, clientId, commandId, guildId } = parameters;

  const rest = new REST({ version: '10' }).setToken(token);
  const route = guildId
    ? Routes.applicationGuildCommand(clientId, guildId, commandId)
    : Routes.applicationCommand(clientId, commandId);

  await rest.delete(route);
}

export async function listSlashCommands(parameters: {
  token: string;
  clientId: string;
  guildId?: string;
}): Promise<Array<{ id: string; name: string; description: string; type: number; guild_id?: string }>> {
  const { token, clientId, guildId } = parameters;

  const rest = new REST({ version: '10' }).setToken(token);
  const route = guildId
    ? Routes.applicationGuildCommands(clientId, guildId)
    : Routes.applicationCommands(clientId);

  return rest.get(route) as Promise<Array<{ id: string; name: string; description: string; type: number; guild_id?: string }>>;
}

// ApplicationCommandType: 2 = User context menu, 3 = Message context menu
export async function registerContextMenuCommand(parameters: {
  token: string;
  clientId: string;
  guildId?: string;
  name: string;
  type: 2 | 3;
}): Promise<{ id: string; name: string; type: number }> {
  const { token, clientId, guildId, name, type } = parameters;

  const rest = new REST({ version: '10' }).setToken(token);
  const route = guildId
    ? Routes.applicationGuildCommands(clientId, guildId)
    : Routes.applicationCommands(clientId);

  const response = (await rest.post(route, {
    body: { name, type },
  })) as { id: string; name: string; type: number };

  return response;
}
