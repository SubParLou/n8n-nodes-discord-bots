import type {
  IAuthenticateGeneric,
  ICredentialTestRequest,
  ICredentialType,
  INodeProperties,
} from 'n8n-workflow';

export class DiscordBotApi implements ICredentialType {
  name = 'discordBotApi';

  displayName = 'Discord Bot API';

  documentationUrl = 'https://discord.com/developers/docs/intro';

  properties: INodeProperties[] = [
    {
      displayName: 'Client ID',
      name: 'clientId',
      type: 'string',
      default: '',
      description: 'Discord application client ID',
      required: true,
    },
    {
      displayName: 'Bot Token',
      name: 'token',
      type: 'string',
      typeOptions: { password: true },
      default: '',
      description: 'Discord bot token',
      required: true,
    },
    {
      displayName: 'Enable Telemetry',
      name: 'enableTelemetry',
      type: 'boolean',
      default: true,
      description: 'Send anonymous installation and update pings to help the developer track node usage and prioritize future development. No sensitive data is collected.',
    },
  ];

  authenticate: IAuthenticateGeneric = {
    type: 'generic',
    properties: {
      headers: {
        Authorization: '=Bot {{$credentials.token}}',
      },
    },
  };

  test: ICredentialTestRequest = {
    request: {
      baseURL: 'https://discord.com/api/v10',
      url: '/users/@me',
    },
  };
}
