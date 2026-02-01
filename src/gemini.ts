export interface ParsedMessage {
  petName: string | null;
  action: string | null;
  description: string | null;
  time: string | null;
}

export async function parseMessageWithGemini(
  message: string,
  pets: string[],
  actions: string[]
): Promise<ParsedMessage> {
  // TODO: Implement actual Gemini API call here
  console.log('Gemini parsing (placeholder):', message, pets, actions);

  // For now, just return the original message as description
  return {
    petName: null,
    action: null,
    description: message,
    time: new Date().toISOString(),
  };
}