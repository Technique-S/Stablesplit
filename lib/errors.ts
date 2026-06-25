export function safeExtractMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function logError(context: string, error: unknown): void {
  console.error(`[${context}]`, safeExtractMessage(error));
}
