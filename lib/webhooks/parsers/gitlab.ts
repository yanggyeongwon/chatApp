import type { ParsedEvent } from "./github"

export function parseGitLabPayload(
  event: string,
  payload: Record<string, unknown>
): ParsedEvent | null {
  switch (event) {
    case "Push Hook": {
      const commits = (payload.commits as Array<{ message: string }>) ?? []
      const branch = (payload.ref as string)?.replace("refs/heads/", "") ?? "unknown"
      const userName = payload.user_name as string | undefined

      return {
        title: `${userName ?? "Someone"} pushed ${commits.length} commit(s) to ${branch}`,
        description: commits
          .slice(0, 3)
          .map((c) => `- ${c.message.split("\n")[0]}`)
          .join("\n"),
        author: userName,
        icon: "push",
        color: "#2da44e",
      }
    }

    case "Merge Request Hook": {
      const mr = payload.object_attributes as {
        iid: number
        title: string
        description?: string
        url: string
        action: string
      }
      const user = payload.user as { name?: string } | undefined

      return {
        title: `MR !${mr.iid} ${mr.action}: ${mr.title}`,
        description: mr.description?.substring(0, 200) ?? "",
        url: mr.url,
        author: user?.name,
        icon: "pr",
        color: mr.action === "open" ? "#2da44e" : "#cf222e",
      }
    }

    case "Issue Hook": {
      const issue = payload.object_attributes as {
        iid: number
        title: string
        description?: string
        url: string
        action: string
      }
      const user = payload.user as { name?: string } | undefined

      return {
        title: `Issue #${issue.iid} ${issue.action}: ${issue.title}`,
        description: issue.description?.substring(0, 200) ?? "",
        url: issue.url,
        author: user?.name,
        icon: "issue",
        color: issue.action === "open" ? "#2da44e" : "#cf222e",
      }
    }

    default:
      return null
  }
}
