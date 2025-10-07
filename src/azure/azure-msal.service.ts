import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ConfidentialClientApplication,
  Configuration,
  AuthorizationUrlRequest,
  AuthorizationCodeRequest,
  AuthenticationResult,
  LogLevel,
} from '@azure/msal-node';
import { randomBytes } from 'node:crypto';

type StateData = { createdAt: number };

@Injectable()
export class AzureMsalService implements OnModuleInit {
  private app!: ConfidentialClientApplication;
  private readonly redirectUri: string;
  private readonly stateStore = new Map<string, StateData>();

  constructor(private readonly cfg: ConfigService) {
    this.redirectUri = this.cfg.get<string>('AZURE_REDIRECT_URI')!;
  }

  async onModuleInit() {
    const tenantId = this.cfg.get<string>('AZURE_TENANT_ID')!;
    const clientId = this.cfg.get<string>('AZURE_CLIENT_ID')!;
    const clientSecret = this.cfg.get<string>('AZURE_CLIENT_SECRET')!;

    const msalConfig: Configuration = {
      auth: {
        clientId,
        authority: `https://login.microsoftonline.com/${tenantId}`,
        clientSecret,
      },
      system: {
        loggerOptions: {
          loggerCallback: (_level, message) => {
            if (message.includes('error')) console.error(message);
          },
          logLevel: LogLevel.Warning,
          piiLoggingEnabled: false,
        },
      },
    };

    this.app = new ConfidentialClientApplication(msalConfig);
  }

  async buildAuthUrl(): Promise<string> {
    const state = randomBytes(32).toString('base64url');
    this.stateStore.set(state, { createdAt: Date.now() });
    setTimeout(() => this.stateStore.delete(state), 30 * 60 * 1000);

    const params: AuthorizationUrlRequest = {
      redirectUri: this.redirectUri,
      scopes: ['openid', 'profile', 'email', 'offline_access'],
      state,
      prompt: 'select_account',
    };

    return this.app.getAuthCodeUrl(params);
  }

  async exchangeCode(currentUrl: URL): Promise<AuthenticationResult> {
    const code = currentUrl.searchParams.get('code');
    const state = currentUrl.searchParams.get('state') ?? '';

    if (!code) throw new Error('Missing authorization code');
    if (!this.stateStore.has(state)) throw new Error('Invalid or expired state');

    const req: AuthorizationCodeRequest = {
      code,
      redirectUri: this.redirectUri,
      scopes: ['openid', 'profile', 'email', 'offline_access'],
    };

    const result = await this.app.acquireTokenByCode(req);
    if (!result) throw new Error('MSAL did not return tokens');

    this.stateStore.delete(state);
    return result;
  }
}
