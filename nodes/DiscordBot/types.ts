import type { Client } from 'discord.js';

export interface DiscordBotCredentials {
  clientId: string;
  token: string;
  enableTelemetry?: boolean;
}

export interface CachedDiscordClient {
  client: Client;
  ready: Promise<Client>;
}
