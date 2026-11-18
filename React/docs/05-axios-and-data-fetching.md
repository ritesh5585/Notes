# 05 · Axios & Data Fetching

> **Prev ←** [04-architecture-4-layer](./04-architecture-4-layer.md) · **Next →** [06-forms-react-hook-form](./06-forms-react-hook-form.md)

## 1. Basics
- **API** = URL where backend gives/accepts data (usually JSON).
- **HTTP methods:** `GET` read · `POST` create · `PUT/PATCH` update · `DELETE` remove.
- **Status:** 2xx ok · 401 not authenticated · 403 forbidden · 404 not found · 422 validation · 5xx server.
- Every request has **3 states** (+1): `loading → error → success`, and **empty** (success with no data).

## 2. `fetch` vs Axios

| Need | `fetch` | Axios |
|---|---|---|
| Simple GET, small app | ✅ enough | overkill |
| Parse JSON | manual `res.json()` | automatic |
| Throws on 404/500 | **No** (check `res.ok`) | Yes |
| Interceptors (token, refresh, global errors) | write a wrapper | built in |
| Timeout | `AbortSignal.timeout(ms)` | `timeout` option |
| Upload progress | limited | `onUploadProgress` |
| Instances with shared config | write a wrapper | `axios.create` |

Not "better", just convenient when you need **interceptors + shared config**.

```js
// fetch gotcha
const res = await fetch("/api/products");
if (!res.ok) throw new Error(`HTTP ${res.status}`);   // fetch does NOT throw on 4xx/5xx
const data = await res.json();
```

## 3. Axios setup (Layer 4)

```bash
npm i axios
```
`.env` → `VITE_API_URL=https://api.example.com` (only `VITE_`-prefixed vars reach the browser; **never put secrets here**, anything in the bundle is public).

```js
// lib/apiClient.js
import axios from "axios";
import { useAuthStore } from "@/store/authStore";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  timeout: 10_000,
  withCredentials: true,                 // send httpOnly cookies
  headers: { "Content-Type": "application/json" },
});

// ---- REQUEST interceptor: runs before every request ----
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;     // Zustand works outside React (08)
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ---- RESPONSE interceptor: success passthrough, errors normalized + 401 refresh ----
let refreshPromise = null;        // single-flight: ONE refresh for many simultaneous 401s

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    const status = error.response?.status;

    const isAuthCall = original?.url?.includes("/auth/");
    if (status === 401 && !original._retry && !isAuthCall) {
      original._retry = true;
      try {
        refreshPromise ??= api.post("/auth/refresh")
          .then((r) => useAuthStore.getState().setAccessToken(r.data.accessToken))
          .finally(() => { refreshPromise = null; });
        await refreshPromise;
        return api(original);                              // retry original request once
      } catch (refreshErr) {
        useAuthStore.getState().logout();                  // refresh failed → clear + redirect
        return Promise.reject(normalizeError(refreshErr));
      }
    }
    return Promise.reject(normalizeError(error));
  }
);

// one error shape for the whole app
export function normalizeError(error) {
  if (axios.isCancel(error)) return error;                 // let cancellation pass through
  return {
    status: error.response?.status ?? 0,
    message: error.response?.data?.message ?? error.message ?? "Something went wrong",
    fieldErrors: error.response?.data?.errors,             // for react-hook-form setError (06)
    original: error,
  };
}
```
**What this teaches**
- Interceptor = middleware around every request/response.
- **Single-flight refresh:** 5 parallel 401s → refresh once, queue the rest on the same promise.
- `_retry` flag prevents infinite retry loops.
- Normalizing errors once means components just read `error.message`.

## 4. Service layer (Layer 3)
```js
// services/productService.js
import { api } from "@/lib/apiClient";

export const productService = {
  list: (params, signal) => api.get("/products", { params, signal }).then(r => r.data),
  get:  (id, signal)     => api.get(`/products/${id}`, { signal }).then(r => r.data),
  create: (body)         => api.post("/products", body).then(r => r.data),
  upload: (file, onProgress) => {
    const fd = new FormData(); fd.append("file", file);
    return api.post("/upload", fd, {
      onUploadProgress: (e) => onProgress?.(Math.round((e.loaded * 100) / (e.total ?? 1))),
    });
  },
};
```

## 5. Cancel requests (race conditions)
```
type "ip"  → request A (slow)
type "iph" → request B (fast) → shows B
A returns last → overwrites B with stale data ❌
```
```jsx
useEffect(() => {
  const controller = new AbortController();
  productService.list({ q }, controller.signal)
    .then(setResults)
    .catch((e) => { if (!axios.isCancel(e)) setError(e); });
  return () => controller.abort();         // cleanup cancels the previous request
}, [q]);
```
Axios accepts `signal` (AbortController). Libraries like TanStack Query pass a `signal` to your `queryFn` for you.

## 6. Hand-rolled fetching in a component (know it, then outgrow it)
```jsx
function useProducts(q) {
  const [state, setState] = useState({ data: [], error: null, loading: true });
  useEffect(() => {
    const c = new AbortController();
    setState(s => ({ ...s, loading: true, error: null }));
    productService.list({ q }, c.signal)
      .then(data => setState({ data, error: null, loading: false }))
      .catch(e => { if (!axios.isCancel(e)) setState({ data: [], error: e, loading: false }); });
    return () => c.abort();
  }, [q]);
  return state;
}
```
You now own: caching, dedupe, retries, refetch-on-focus, invalidation, pagination, optimistic updates. Nobody wants that → TanStack Query.

## 7. TanStack Query (server state)

```bash
npm i @tanstack/react-query
```
```jsx
// main.jsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 60_000, retry: 1 } },
});
<QueryClientProvider client={queryClient}><App /></QueryClientProvider>
```
```jsx
// READ
const { data, isPending, isError, error, isFetching } = useQuery({
  queryKey: ["products", { q, page }],              // key = cache identity; include every input
  queryFn: ({ signal }) => productService.list({ q, page }, signal),
  placeholderData: keepPreviousData,                // keep old page while loading new
  enabled: !!q,                                     // conditional fetch
});

// WRITE
const qc = useQueryClient();
const addToCart = useMutation({
  mutationFn: (item) => cartService.add(item),
  onSuccess: () => qc.invalidateQueries({ queryKey: ["cart"] }),   // refetch stale data
});
<button disabled={addToCart.isPending} onClick={() => addToCart.mutate({ productId, qty: 1 })}>Add</button>
```
**Optimistic update (rollback on error)**
```jsx
useMutation({
  mutationFn: cartService.add,
  onMutate: async (item) => {
    await qc.cancelQueries({ queryKey: ["cart"] });
    const previous = qc.getQueryData(["cart"]);
    qc.setQueryData(["cart"], (old) => [...old, item]);        // update UI immediately
    return { previous };
  },
  onError: (_e, _item, ctx) => qc.setQueryData(["cart"], ctx.previous),   // rollback
  onSettled: () => qc.invalidateQueries({ queryKey: ["cart"] }),          // reconcile with server
});
```
Concepts: **staleTime** (how long data counts as fresh) · **gcTime** (how long unused cache is kept) · **invalidate** (mark stale + refetch) · **dedupe** (same key, one request) · **isPending vs isFetching** (no data yet vs background refresh).

## 8. Security & gotchas
- **Token storage trade-off:** `localStorage` survives refresh but any XSS can read it; `httpOnly` cookie is invisible to JS but needs **CSRF** protection (`SameSite`, CSRF token). Choose from your threat model.
- Protected routes are **UX**; the **server enforces** authorization.
- After logout: clear store, `queryClient.clear()`, abort in-flight requests (else old data flashes for the next user).
- Never trust client-sent prices/totals; the server recomputes.
- Double-submit: disable button while `isPending`; idempotency keys for payments.
- CORS errors are a **server** config problem, not fixable in React.

## Official docs
- Axios: https://axios-http.com/docs/intro · Instance: https://axios-http.com/docs/instance · Interceptors: https://axios-http.com/docs/interceptors · Cancellation: https://axios-http.com/docs/cancellation
- MDN fetch: https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch
- MDN AbortController: https://developer.mozilla.org/en-US/docs/Web/API/AbortController
- TanStack Query: https://tanstack.com/query/latest · Optimistic updates: https://tanstack.com/query/latest/docs/framework/react/guides/optimistic-updates
- Vite env vars: https://vite.dev/guide/env-and-mode

## Takeaway · Mistake · Ask yourself
- **Takeaway:** components ask for data; services know endpoints; the client knows transport; a server-state library owns caching.
- **Mistake:** storing fetched data in `useState`/Zustand and hand-syncing it with the server.
- **Ask:** *What happens if this request is slow, fails, returns empty, or returns after a newer request?*
