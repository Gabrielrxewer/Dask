import type { PrismaClient, SearchDocument } from '@prisma/client';

export type HybridSearchFilters = {
  workspaceId?: string;
  boardId?: string;
  status?: string;
  itemType?: string;
};

export class HybridSearchService {
  public constructor(private readonly prisma: PrismaClient) {}

  public async search(input: {
    query: string;
    filters?: HybridSearchFilters;
    limit?: number;
  }): Promise<SearchDocument[]> {
    const { query, filters, limit = 20 } = input;

    return this.prisma.searchDocument.findMany({
      where: {
        content: {
          contains: query,
          mode: 'insensitive'
        },
        workspaceId: filters?.workspaceId,
        boardId: filters?.boardId,
        item:
          filters?.status || filters?.itemType
            ? {
                status: filters.status,
                type: filters.itemType
              }
            : undefined
      },
      take: limit,
      orderBy: { updatedAt: 'desc' }
    });
  }
}
