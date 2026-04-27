import {
  ChannelType,
  Client,
  GatewayIntentBits,
  Partials,
  REST,
  Routes,
  type ApplicationCommandOptionData,
  type ClientEvents,
} from 'discord.js';
import type { INodePropertyOptions } from 'n8n-workflow';
import type { CachedDiscordClient, DiscordBotCredentials } from './types';

const clients = new Map<string, CachedDiscordClient>();

function createDiscordClient(token: string): CachedDiscordClient {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.GuildMessageReactions,
      GatewayIntentBits.DirectMessages,
      GatewayIntentBits.DirectMessageReactions,
      GatewayIntentBits.MessageContent,
    ],
    partials: [Partials.Channel, Partials.Message, Partials.Reaction, Partials.User],
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

  return { token, client, ready };
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
    return cached.client;
  } catch (error) {
    clients.delete(token);
    throw error;
  }
}

export async function getIsolatedClient(credentials: DiscordBotCredentials): Promise<Client> {
  const { token } = credentials;
  if (!token) {
    throw new Error('Missing Discord bot token');
  }

  const isolated = createDiscordClient(token);
  try {
    await isolated.ready;
    return isolated.client;
  } catch (error) {
    isolated.client.destroy();
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

export async function loadChannelOptions(
  credentials: DiscordBotCredentials,
  guildIds: string[],
): Promise<INodePropertyOptions[]> {
  const client = await getClient(credentials);
  const uniqueGuildIds = [...new Set(guildIds)];
  const optionsById = new Map<string, INodePropertyOptions>();

  await Promise.all(
    uniqueGuildIds.map(async (guildId) => {
      try {
        const guild = await client.guilds.fetch(guildId);
        const channels = await guild.channels.fetch();

        channels.forEach((channel) => {
          if (!channel) {
            return;
          }

          if (channel.type === ChannelType.GuildText || channel.type === ChannelType.GuildAnnouncement) {
            optionsById.set(channel.id, {
              name: `${guild.name} / ${channel.name}`,
              value: channel.id,
            });
          }
        });
      } catch (error) {
        console.warn('[DiscordBot] Failed to load channel options for guild', {
          guildId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }),
  );

  return [...optionsById.values()];
}

export async function loadRoleOptions(
  credentials: DiscordBotCredentials,
  guildIds: string[],
): Promise<INodePropertyOptions[]> {
  const client = await getClient(credentials);
  const uniqueGuildIds = [...new Set(guildIds)];
  const optionsById = new Map<string, INodePropertyOptions>();

  await Promise.all(
    uniqueGuildIds.map(async (guildId) => {
      try {
        const guild = await client.guilds.fetch(guildId);
        const roles = await guild.roles.fetch();

        roles.forEach((role) => {
          if (!role || role.name === '@everyone') {
            return;
          }

          optionsById.set(role.id, {
            name: `${guild.name} / ${role.name}`,
            value: role.id,
          });
        });
      } catch (error) {
        console.warn('[DiscordBot] Failed to load role options for guild', {
          guildId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }),
  );

  return [...optionsById.values()];
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
