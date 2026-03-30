import type { ParsedEvent } from "./github"
import { parseGitHubPayload } from "./github"
import { parseGitLabPayload } from "./gitlab"
import { parseGenericPayload } from "./generic"

export type { ParsedEvent }

export function parseWebhookPayload(
  sourceType: string,
  eventType: string,
  payload: Record<string, unknown>
): ParsedEvent | null {
  switch (sourceType) {
    case "github":
      return parseGitHubPayload(eventType, payload)
    case "gitlab":
      return parseGitLabPayload(eventType, payload)
    case "generic":
      return parseGenericPayload(payload)
    default:
      return parseGenericPayload(payload)
  }
}
