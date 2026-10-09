interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
  body?: unknown
  query?: Record<string, unknown>
}

// $fetch without Nuxt's typed-route inference, which hits TypeScript's
// recursion limit once the app has many API routes.
const raw = $fetch as unknown as <T>(url: string, options?: RequestOptions) => Promise<T>

export function request<T = unknown>(url: string, options?: RequestOptions) {
  return raw<T>(url, options)
}
