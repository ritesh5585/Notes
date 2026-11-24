# 04 · 4-Layer Architecture (UI → Hooks → Services → HTTP Client)

> **Prev ←** [03-custom-hooks](./03-custom-hooks.md) · **Next →** [05-axios-and-data-fetching](./05-axios-and-data-fetching.md)

## 1. The problem
"Just `fetch` inside every component" means: URLs and headers copy-pasted, token change = edit 40 files, no shared cache, components impossible to test. Change one thing → break five places.

**Fix = layers.** Each layer has **one job** and only talks to the layer directly below it.

```
┌───────────────────────────────────────────────────────────┐
│ 1. UI LAYER        components / pages                      │  "show this, call that"
│    knows: JSX, user events         NOT: URLs, HTTP, tokens │
├───────────────────────────────────────────────────────────┤
│ 2. LOGIC LAYER     custom hooks / query hooks / store      │  "give me products, handle loading/cache"
│    knows: state, loading, error   NOT: how HTTP works      │
├───────────────────────────────────────────────────────────┤
│ 3. SERVICE LAYER   productService, authService, cartService│  "GET /products?page=2"
│    knows: endpoints, params, payload shapes  NOT: React    │
├───────────────────────────────────────────────────────────┤
│ 4. HTTP CLIENT     axios instance + interceptors + config  │  "base URL, auth header, refresh, errors"
│    knows: transport, tokens, retries  NOT: business rules  │
└───────────────────────────────────────────────────────────┘
                              ↓
                           SERVER
```
**Dependency rule:** arrows only point down. A service never imports a component. A component never imports axios.

> Some teams call these "presentation / application / domain / infrastructure". Same idea, different labels. What matters is the **one-way dependency and single responsibility**, not the number 4.

## 2. One click through all 4 layers (search products)
```
User types "phone"                                  ← Layer 1 (SearchBox, local state)
  → debounced value → useProducts({ q: "phone" })   ← Layer 2 (hook + cache)
    → productService.list({ q: "phone" })           ← Layer 3 (knows GET /products)
      → api.get("/products", { params })            ← Layer 4 (adds baseURL, token, timeout)
        → server → JSON
      ← interceptor normalizes errors / handles 401
    ← service returns data
  ← hook exposes { data, isLoading, error }
← component renders list / skeleton / error / empty
```

## 3. Folder structure

**Small/medium (by type)**
```
src/
├── components/     reusable UI (Button, Modal, ProductCard)
├── pages/          one per route
├── hooks/          shared hooks (useDebounce, useAuth)
├── services/       productService.js, authService.js
├── lib/            apiClient.js (axios instance), queryClient.js
├── store/          zustand stores
├── context/        providers
└── utils/          pure helpers
```
**Large (by feature): things that change together live together**
```
src/
├── app/            providers, router, store setup
├── shared/         ui/, hooks/, lib/apiClient.js, utils/
└── features/
    ├── products/
    │   ├── components/   ProductCard.jsx, ProductGrid.jsx
    │   ├── hooks/        useProducts.js
    │   ├── services/     productService.js
    │   ├── pages/        ProductsPage.jsx
    │   └── index.js      ← public API of the feature
    ├── cart/
    └── auth/
```
Rule: a feature imports from `shared/`, never from another feature's internals (use its `index.js`).

## 4. Full code: Products feature, all layers

**Layer 4: `lib/apiClient.js`** (details in [05](./05-axios-and-data-fetching.md))
```js
import axios from "axios";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  timeout: 10_000,
  withCredentials: true,
});
// + interceptors for auth/refresh/error normalization
```

**Layer 3: `features/products/services/productService.js`** (plain JS, no React)
```js
import { api } from "@/lib/apiClient";

export const productService = {
  list:   (params, signal) => api.get("/products", { params, signal }).then(r => r.data),
  get:    (id, signal)     => api.get(`/products/${id}`, { signal }).then(r => r.data),
  create: (payload)        => api.post("/products", payload).then(r => r.data),
  update: (id, payload)    => api.patch(`/products/${id}`, payload).then(r => r.data),
  remove: (id)             => api.delete(`/products/${id}`),
};
```
Services **return data, not axios responses**, so the rest of the app never sees `response.data`.

**Layer 2: `features/products/hooks/useProducts.js`**
```js
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { productService } from "../services/productService";

export const productKeys = {
  all: ["products"],
  list: (filters) => ["products", "list", filters],
  detail: (id) => ["products", "detail", id],
};

export function useProducts(filters) {
  return useQuery({
    queryKey: productKeys.list(filters),
    queryFn: ({ signal }) => productService.list(filters, signal),
    placeholderData: keepPreviousData,       // no flicker while paginating
  });
}

export function useCreateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: productService.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: productKeys.all }),
  });
}
```

**Layer 1: `features/products/pages/ProductsPage.jsx`**
```jsx
import { useSearchParams } from "react-router-dom";
import { useProducts } from "../hooks/useProducts";

export default function ProductsPage() {
  const [params, setParams] = useSearchParams();
  const filters = { q: params.get("q") ?? "", page: Number(params.get("page") ?? 1) };
  const { data, isPending, isError, error } = useProducts(filters);

  if (isPending) return <Skeleton />;
  if (isError)   return <ErrorState message={error.message} />;
  if (data.items.length === 0) return <EmptyState />;          // the state people forget

  return (
    <>
      <ProductGrid products={data.items} />
      <Pagination page={filters.page} total={data.totalPages}
                  onChange={(page) => setParams({ ...filters, page })} />
    </>
  );
}
```
Four UI states always: **loading → error → empty → success**.

## 5. Where does each thing go?
| Thing | Layer / place |
|---|---|
| JSX, CSS, local UI state (modal open) | 1 · component |
| Loading/error/caching/derived data, form orchestration | 2 · hook |
| Auth user, cart, theme (client-global) | 2 · store/context ([07](./07-context-api.md), [08](./08-zustand.md)) |
| Endpoint paths, query params, payload mapping | 3 · service |
| Base URL, headers, tokens, refresh, timeouts, global error shape | 4 · apiClient |
| Pure helpers (`formatPrice`) | `utils/` (no layer, no dependencies) |
| Validation schemas (zod) | next to the feature/form |

## 6. Who owns this data? (the question that decides everything)
| Kind | Example | Home |
|---|---|---|
| UI state | dropdown open | `useState` in component |
| Form state | checkout fields | react-hook-form ([06](./06-forms-react-hook-form.md)) |
| Shared client state | cart, theme, auth user | Context / Zustand |
| **Server state** | product list, orders | TanStack Query (cache + refetch + dedupe) |
| URL state | search, filters, page | router search params |
| Derived | totals, counts, filtered list | compute in render |

**Server state ≠ client state.** The server owns it; you hold a cached copy that can go stale. Don't copy server data into a global store by default.

## 7. Why layers pay off
| Benefit | How |
|---|---|
| Change blast radius | API URL changes → edit 1 service. Auth header changes → edit apiClient |
| Testability | Mock a service, test a hook; mock a hook, test a component |
| Swap tech | `axios` → `fetch` only touches layer 4 |
| Readability | Component says *what*, lower layers say *how* |
| Team work | Frontend can build against service contracts / mocks (MSW) |

## 8. Anti-patterns
- Component imports `axios` or builds URLs (layer skipping).
- Service imports React or uses hooks (layer 3 leaking up).
- Service returns raw axios response (`res.data` repeated everywhere).
- Copying query data into Zustand "so components can read it" (two sources of truth).
- Over-layering a 3-page app. **Start simple; add layers when pain appears.**

## 9. Interview answers
- *"How do you structure a React app?"* → Feature folders; 4 layers (UI, hooks/state, services, http client) with one-way dependencies; TanStack Query for server state, Zustand for client-global, URL for navigation state, local state otherwise.
- *"Why a service layer?"* → One place for endpoints and payload shapes; components stay ignorant of HTTP; easy to mock and test.
- *"Where do you put auth tokens?"* → apiClient layer reads them (interceptor); auth state lives in a store; server enforces authorization. Route guards are UX only.

## Official docs / reading
- Thinking in React: https://react.dev/learn/thinking-in-react
- Choosing the state structure: https://react.dev/learn/choosing-the-state-structure
- Sharing state between components: https://react.dev/learn/sharing-state-between-components
- TanStack Query overview: https://tanstack.com/query/latest/docs/framework/react/overview
- Bulletproof React (feature-based structure reference): https://github.com/alan2207/bulletproof-react
- Mock Service Worker: https://mswjs.io

## Takeaway · Mistake · Ask yourself
- **Takeaway:** every layer has one job and knows only the layer below.
- **Mistake:** `axios.get` inside a component "just this once".
- **Ask:** *If the API URL, the auth scheme, or the UI library changed tomorrow, how many files would I touch?*
