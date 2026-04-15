import { v4 as uuid } from 'uuid';
import type { DomainEvent } from '@/core/events/domain-event';
import type { EventPublisher } from '@/core/events/event-publisher';
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
    const organization = await this.eventPublisher.runInTransaction(async (db, publisher) => {
      const created = await this.identityRepository.createOrganization(input, db);

      const event: DomainEvent = {
        id: uuid(),
        name: 'organization.created',
        aggregateType: 'organization',
        aggregateId: created.id,
        occurredAt: new Date(),
        payload: {
          organizationId: created.id,
          ownerUserId: input.ownerUserId
        }
      };

      await publisher.publishInTransaction(event, db);
      return created;
    });

    return organization;
  }
}
