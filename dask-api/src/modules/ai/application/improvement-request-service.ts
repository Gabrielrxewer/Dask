import { v4 as uuid } from 'uuid';
import { AppError } from '@/core/errors/app-error';
import { DomainEventNames } from '@/core/events/event-names';
import { EventPublisher } from '@/core/events/event-publisher';
import type { JobQueue } from '@/core/jobs/job-queue';
import type { ItemsRepository } from '@/modules/items/repositories/items-repository';

export class ImprovementRequestService {
  public constructor(
    private readonly itemsRepository: ItemsRepository,
    private readonly eventPublisher: EventPublisher,
    private readonly jobQueue: JobQueue
  ) {}

  public async requestDescriptionImprovement(input: { itemId: string; requestedBy: string }): Promise<void> {
    const item = await this.itemsRepository.findItemById(input.itemId);
    if (!item) {
      throw new AppError('Item not found', 404);
    }

    await this.eventPublisher.publish({
      id: uuid(),
      name: DomainEventNames.ItemDescriptionImprovementRequested,
      aggregateType: 'item',
      aggregateId: item.id,
      occurredAt: new Date(),
      payload: {
        itemId: item.id,
        workspaceId: item.workspaceId,
        requestedBy: input.requestedBy
      }
    });

    await this.jobQueue.enqueue('ai.improve-description', {
      itemId: item.id,
      workspaceId: item.workspaceId,
      boardId: item.boardId
    });
  }
}
