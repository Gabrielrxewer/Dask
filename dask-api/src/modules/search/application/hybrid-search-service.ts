import type { PrismaClient, SearchDocument } from '@prisma/client';
import type { EmbeddingProvider } from '@/modules/ai/domain/providers';

export type HybridSearchFilters = {
  workspaceId?: string;
  boardId?: string;
  status?: string;
  itemType?: string;
};

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .filter((token) => token.length > 1);
}

function overlapScore(queryTokens: string[], contentTokens: string[]): number {
  if (queryTokens.length === 0 || contentTokens.length === 0) {
    return 0;
  }

  const contentSet = new Set(contentTokens);
  const matches = queryTokens.reduce((sum, token) => (contentSet.has(token) ? sum + 1 : sum), 0);
  return matches / queryTokens.length;
}

export class HybridSearchService {
  public constructor(
    private readonly prisma: PrismaClient,
    private readonly embeddingProvider: EmbeddingProvider
  ) {}

  private cosineSimilarity(a: number[], b: number[]): number {
    const size = Math.min(a.length, b.length);
    if (size === 0) {
      return 0;
    }

    let dot = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < size; i += 1) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  public async search(input: {
    query: string;
    filters?: HybridSearchFilters;
    limit?: number;
  }): Promise<Array<SearchDocument & { score: number; semanticScore: number; lexicalScore: number }>> {
    const { query, filters, limit = 20 } = input;
    const normalizedQuery = query.trim();
    const queryTokens = tokenize(normalizedQuery);

    const [lexicalDocs, semanticCandidates, queryEmbedding] = await Promise.all([
      this.prisma.searchDocument.findMany({
        where: {
          content: {
            contains: normalizedQuery,
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
        take: Math.max(limit * 3, 60),
        orderBy: { updatedAt: 'desc' }
      }),
      this.prisma.searchDocument.findMany({
        where: {
          workspaceId: filters?.workspaceId,
          boardId: filters?.boardId,
          embedding: { isEmpty: false },
          item:
            filters?.status || filters?.itemType
              ? {
                  status: filters.status,
                  type: filters.itemType
                }
              : undefined
        },
        take: 200,
        orderBy: { updatedAt: 'desc' }
      }),
      this.embeddingProvider.embed({ content: normalizedQuery })
    ]);

    const lexicalById = new Set(lexicalDocs.map((doc) => doc.id));
    const rankedChunks = semanticCandidates.map((doc) => {
      const semanticScore = Array.isArray(doc.embedding)
        ? this.cosineSimilarity(queryEmbedding, doc.embedding)
        : 0;
      const lexicalScore = lexicalById.has(doc.id)
        ? 1
        : overlapScore(queryTokens, tokenize(doc.content));
      const score = semanticScore * 0.65 + lexicalScore * 0.35;
      return {
        ...doc,
        score,
        semanticScore,
        lexicalScore
      };
    });

    // Dedicated reranking pass at item level based on top chunk evidence.
    const byItem = new Map<
      string,
      SearchDocument & { score: number; semanticScore: number; lexicalScore: number }
    >();

    for (const chunk of rankedChunks.sort((a, b) => b.score - a.score)) {
      const existing = byItem.get(chunk.itemId);
      if (!existing) {
        byItem.set(chunk.itemId, { ...chunk });
        continue;
      }

      // Reciprocal rank fusion style update with chunk evidence.
      const fused = Math.max(existing.score, chunk.score) + chunk.score * 0.08;
      if (fused > existing.score) {
        byItem.set(chunk.itemId, {
          ...chunk,
          score: fused,
          semanticScore: Math.max(existing.semanticScore, chunk.semanticScore),
          lexicalScore: Math.max(existing.lexicalScore, chunk.lexicalScore)
        });
      }
    }

    return Array.from(byItem.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }
}

