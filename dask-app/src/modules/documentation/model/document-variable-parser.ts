export interface ParsedDocumentVariable {
  raw: string;
  key: string;
  start: number;
  end: number;
}

const variablePattern = /\{\{\s*([A-Za-z][A-Za-z0-9_.]{0,119})\s*\}\}/g;

export function parseDocumentVariables(content: string): ParsedDocumentVariable[] {
  return Array.from(content.matchAll(variablePattern)).map((match) => ({
    raw: match[0],
    key: match[1],
    start: match.index ?? 0,
    end: (match.index ?? 0) + match[0].length
  }));
}
