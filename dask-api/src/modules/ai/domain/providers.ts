export interface AIProvider {
  improveDescription(input: { title: string; description: string }): Promise<string>;
  summarize(input: { content: string }): Promise<string>;
  classify(input: { content: string; labels: string[] }): Promise<string>;
}

export interface EmbeddingProvider {
  embed(input: { content: string }): Promise<number[]>;
}
