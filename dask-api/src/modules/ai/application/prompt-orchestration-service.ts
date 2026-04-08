export class PromptOrchestrationService {
  public buildDescriptionImprovementPrompt(input: { title: string; description: string }): string {
    return [
      'You are an assistant that improves task card descriptions.',
      `Title: ${input.title}`,
      `Description: ${input.description}`,
      'Return an improved and actionable version with concise text.'
    ].join('\n');
  }
}
