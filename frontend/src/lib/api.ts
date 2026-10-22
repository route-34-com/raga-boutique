export class ApiError extends Error {
  status: number
  details: string[]
  constructor(status: number, message: string, details: string[] = []) {
    super(message)
    this.status = status
    this.details = details
  }
}

function messageFrom(body: unknown, status: number): { message: string; details: string[] } {
  const detail = (body as { detail?: unknown })?.detail
  if (detail && typeof detail === "object" && "message" in detail) {
    const d = detail as { message: string; details?: string[] }
    return { message: d.message, details: d.details ?? [] }
  }
  if (Array.isArray(detail)) {
    // FastAPI validation errors
    return { message: "Please check the highlighted details and try again.", details: detail.map((e) => String(e.msg)) }
  }
  return { message: status >= 500 ? "Something went wrong on our side. Please try again." : "Request failed.", details: [] }
}

export async function api<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, ...rest } = init
  const res = await fetch(path, {
    credentials: "include",
    ...rest,
    headers: json !== undefined ? { "content-type": "application/json", ...rest.headers } : rest.headers,
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  })
  if (res.status === 204) return undefined as T
  const body = await res.json().catch(() => null)
  if (!res.ok) {
    const { message, details } = messageFrom(body, res.status)
    throw new ApiError(res.status, message, details)
  }
  return body as T
}

export const post = <T>(path: string, json?: unknown) => api<T>(path, { method: "POST", json: json ?? {} })
export const put = <T>(path: string, json: unknown) => api<T>(path, { method: "PUT", json })
export const patch = <T>(path: string, json: unknown) => api<T>(path, { method: "PATCH", json })
export const del = (path: string) => api<void>(path, { method: "DELETE" })
