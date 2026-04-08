export type SemanticSearchScope = {
  workspaceId?: string;
  boardId?: string;
  teamId?: string;
  status?: string;
  itemType?: string;
};

export interface SemanticSearchService {
  searchByEmbedding(input: {
    query: string;
    scope: SemanticSearchScope;
    limit?: number;
  }): Promise<Array<{ itemId: string; score: number }>>;
}
