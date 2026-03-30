export type ParsedEvent = {
  title: string
  description: string
  url?: string
  author?: string
  icon: "push" | "pr" | "issue" | "release" | "generic"
  color: string
}

export function parseGitHubPayload(
  event: string,
  payload: Record<string, unknown>
): ParsedEvent | null {
  switch (event) {
    case "push": {
      const commits = (payload.commits as Array<{ message: string }>) ?? []
      const ref = payload.ref as string | undefined
      const branch = ref?.replace("refs/heads/", "") ?? "unknown"
      const pusher = payload.pusher as { name?: string } | undefined
      const compare = payload.compare as string | undefined

      return {
        title: `${pusher?.name ?? "Someone"} pushed ${commits.length} commit(s) to ${branch}`,
        description: commits
          .slice(0, 3)
          .map((c) => `- ${c.message.split("\n")[0]}`)
          .join("\n"),
        url: compare,
        author: pusher?.name,
        icon: "push",
        color: "#2da44e",
      }
    }

    case "pull_request": {
      const pr = payload.pull_request as {
        number: number
        title: string
        body?: string
        html_url: string
        user?: { login: string }
      }
      const action = payload.action as string

      return {
        title: `PR #${pr.number} ${action}: ${pr.title}`,
        description: pr.body?.substring(0, 200) ?? "",
        url: pr.html_url,
        author: pr.user?.login,
        icon: "pr",
        color:
          action === "opened"
            ? "#2da44e"
            : action === "closed"
              ? "#cf222e"
              : "#8250df",
      }
    }

    case "issues": {
      const issue = payload.issue as {
        number: number
        title: string
        body?: string
        html_url: string
        user?: { login: string }
      }
      const action = payload.action as string

      return {
        title: `Issue #${issue.number} ${action}: ${issue.title}`,
        description: issue.body?.substring(0, 200) ?? "",
        url: issue.html_url,
        author: issue.user?.login,
        icon: "issue",
        color: action === "opened" ? "#2da44e" : "#cf222e",
      }
    }

    case "release": {
      const release = payload.release as {
        tag_name: string
        name?: string
        html_url: string
        author?: { login: string }
      }

      return {
        title: `Release ${release.tag_name}: ${release.name ?? ""}`,
        description: "",
        url: release.html_url,
        author: release.author?.login,
        icon: "release",
        color: "#8250df",
      }
    }

    default:
      return null
  }
}
