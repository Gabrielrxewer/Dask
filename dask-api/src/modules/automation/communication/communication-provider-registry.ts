import { AppError } from '@/core/errors/app-error';
import type {
  CommunicationChannel,
  CommunicationProvider
} from '@/modules/automation/communication/communication-provider';

export class CommunicationProviderRegistry {
  private readonly providers = new Map<string, CommunicationProvider>();

  public register(provider: CommunicationProvider): void {
    const channel = provider.channel.trim();
    const providerName = provider.provider.trim();
    if (!channel || !providerName) {
      throw new AppError('Communication provider channel and name are required.', 422);
    }

    this.providers.set(this.key(channel as CommunicationChannel, providerName), provider);
  }

  public resolve(input: {
    channel: string;
    provider: string;
  }): CommunicationProvider {
    const channel = input.channel.trim() as CommunicationChannel;
    const provider = input.provider.trim();
    const resolved = this.providers.get(this.key(channel, provider));

    if (!resolved) {
      throw new AppError(`Communication provider "${provider}" is not registered for channel "${channel}".`, 422, {
        channel,
        provider
      });
    }

    return resolved;
  }

  public has(input: { channel: string; provider: string }): boolean {
    return this.providers.has(this.key(input.channel as CommunicationChannel, input.provider));
  }

  public list(): Array<{ channel: CommunicationChannel; provider: string }> {
    return Array.from(this.providers.values())
      .map((provider) => ({
        channel: provider.channel,
        provider: provider.provider
      }))
      .sort((a, b) => `${a.channel}:${a.provider}`.localeCompare(`${b.channel}:${b.provider}`));
  }

  private key(channel: CommunicationChannel, provider: string): string {
    return `${channel.trim().toLowerCase()}:${provider.trim().toLowerCase()}`;
  }
}
