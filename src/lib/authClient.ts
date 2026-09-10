/**
 * Client-side Header Helper (Deprecated)
 * Modern authentication uses httpOnly cookies automatically sent by the browser.
 */
export function getAuthHeaders(additionalHeaders: Record<string, string> = {}): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...additionalHeaders,
  }

  if (typeof window !== "undefined") {
    const token = localStorage.getItem("nota_admin_token")
    if (token) {
      headers["Authorization"] = `Bearer ${token}`
    }
  }

  return headers
}

