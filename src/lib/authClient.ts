/**
 * Client-side Header Helper (Deprecated)
 * Modern authentication uses httpOnly cookies automatically sent by the browser.
 */
export function getAuthHeaders(additionalHeaders: Record<string, string> = {}): Record<string, string> {
  return {
    "Content-Type": "application/json",
    ...additionalHeaders,
  }
}

