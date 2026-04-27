import type { Client } from 'discord.js';

export interface DiscordBotCredentials {
  clientId: string;
  token: string;
}

export interface CachedDiscordClient {
  token: string;
  client: Client;
  ready: Promise<Client>;
}
