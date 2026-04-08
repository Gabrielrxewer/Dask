export type DomainEvent<TPayload extends object = Record<string, unknown>> = {
  id: string;
  name: string;
  aggregateType: string;
  aggregateId: string;
  occurredAt: Date;
  payload: TPayload;
};

export type DomainEventHandler = (event: DomainEvent) => Promise<void>;
