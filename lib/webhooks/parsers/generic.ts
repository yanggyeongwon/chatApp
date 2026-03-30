import type { ParsedEvent } from "./github"

export function parseGenericPayload(
  payload: Record<string, unknown>
): ParsedEvent {
  const title =
    (payload.title as string) ??
    (payload.event as string) ??
    (payload.message as string) ??
    "Webhook Event"

  const description =
    (payload.description as string) ??
    (payload.body as string) ??
    (payload.text as string) ??
    ""

  const url = (payload.url as string) ?? (payload.link as string)
  const author = (payload.author as string) ?? (payload.user as string)

  return {
    title: title.substring(0, 200),
    description: description.substring(0, 500),
    url,
    author,
    icon: "generic",
    color: "#6b7280",
  }
}
