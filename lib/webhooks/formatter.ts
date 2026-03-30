import type { ParsedEvent } from "./parsers"

const ICON_MAP: Record<string, string> = {
  push: "🔀",
  pr: "🔃",
  issue: "📋",
  release: "🏷️",
  generic: "🔔",
}

/**
 * Formats a parsed webhook event into a chat message string.
 */
export function formatEventMessage(event: ParsedEvent): string {
  const icon = ICON_MAP[event.icon] ?? "🔔"
  let message = `${icon} **${event.title}**`

  if (event.author) {
    message += ` (by ${event.author})`
  }

  if (event.description) {
    message += `\n${event.description}`
  }

  if (event.url) {
    message += `\n[View →](${event.url})`
  }

  return message
}
