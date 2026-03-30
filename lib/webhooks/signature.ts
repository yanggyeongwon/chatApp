import { createHmac, timingSafeEqual } from "crypto"

export function verifyGitHubSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expected =
    "sha256=" + createHmac("sha256", secret).update(payload).digest("hex")
  try {
    return timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  } catch {
    return false
  }
}

export function verifyGitLabToken(token: string, secret: string): boolean {
  try {
    return timingSafeEqual(Buffer.from(token), Buffer.from(secret))
  } catch {
    return false
  }
}

export function verifyGenericSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expected =
    "sha256=" + createHmac("sha256", secret).update(payload).digest("hex")
  try {
    return timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  } catch {
    return false
  }
}

export function verifyWebhookSignature(
  sourceType: string,
  payload: string,
  headers: Record<string, string>,
  secret: string
): boolean {
  switch (sourceType) {
    case "github":
      return verifyGitHubSignature(
        payload,
        headers["x-hub-signature-256"] ?? "",
        secret
      )
    case "gitlab":
      return verifyGitLabToken(headers["x-gitlab-token"] ?? "", secret)
    case "generic":
      return verifyGenericSignature(
        payload,
        headers["x-webhook-signature"] ?? "",
        secret
      )
    default:
      return false
  }
}
