// A signed-in account's instructions live on the server and this key only mirrors them; a signed-out visitor's live
// here alone. Unlike the other LlamaAI preferences they are private text, so logout clears them with the account.
export const LLAMA_AI_CUSTOM_INSTRUCTIONS_KEY = 'llamaai-custom-instructions'
