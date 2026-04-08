import { v4 as uuid } from 'uuid';
import type { DomainEvent } from '@/core/events/domain-event';
import { EventPublisher } from '@/core/events/event-publisher';
import type { IdentityRepository } from '@/modules/identity/repositories/identity-repository';

export class OrganizationService {
  public constructor(
    private readonly identityRepository: IdentityRepository,
    private readonly eventPublisher: EventPublisher
  ) {}

  public async createOrganization(input: {
    name: string;
    slug: string;
    ownerUserId: string;
    settings?: Record<string, unknown>;
  }) {
    const organization = await this.identityRepository.createOrganization(input);

    const event: DomainEvent = {
      id: uuid(),
      name: 'organization.created',
      aggregateType: 'organization',
      aggregateId: organization.id,
      occurredAt: new Date(),
      payload: {
        organizationId: organization.id,
        ownerUserId: input.ownerUserId
      }
    };

    await this.eventPublisher.publish(event);
    return organization;
  }
}
