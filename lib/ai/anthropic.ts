import Anthropic from "@anthropic-ai/sdk"

let client: Anthropic | undefined

export function getAnthropicClient() {
  if (client) return client
  client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  })
  return client
}
