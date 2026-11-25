# 08 · Zustand (global client state)

> **Prev ←** [07-context-api](./07-context-api.md) · **Next →** [09-routing](./09-routing.md)

## 1. Why
Context re-renders all consumers and has no selectors. Redux needs ceremony. **Zustand** = a tiny store: a plain object + `set` function + hook with **selectors**. No Provider.

```bash
npm i zustand
```
```
component ──useStore(selector)──▶ subscribes to a slice
action ──set(partial)──▶ new state ──▶ only components whose selected slice changed re-render
```
> Redux is intentionally not covered in these notes (you have it separately).

## 2. First store
```jsx
import { create } from "zustand";

export const useCounter = create((set, get) => ({
  count: 0,
  inc: () => set((s) => ({ count: s.count + 1 })),   // merge: returns partial, other keys kept
  add: (n) => set({ count: get().count + n }),        // get() reads current state
  reset: () => set({ count: 0 }),
}));

function Counter() {
  const count = useCounter((s) => s.count);           // ✅ selector: re-render only when count changes
  const inc = useCounter((s) => s.inc);               // actions never change → never cause renders
  return <button onClick={inc}>{count}</button>;
}
```
- `set` **shallow-merges** the top level (unlike React `setState` for objects you don't need `...state`). Nested objects → spread them yourself or use `immer`.
- Actions live **inside** the store next to the data.

## 3. Selectors: the performance rule
```jsx
const count = useCounter(s => s.count);              // ✅ primitive, precise
const { count, inc } = useCounter();                 // ❌ subscribes to EVERYTHING → renders on any change
```
Selecting an **object/array built in the selector** returns a new reference every time:
```jsx
const pair = useStore(s => ({ a: s.a, b: s.b }));   // ❌ v5: can cause infinite re-render loop / extra renders
```
Fix with `useShallow` (shallow-compares result):
```jsx
import { useShallow } from "zustand/react/shallow";
const { a, b } = useStore(useShallow(s => ({ a: s.a, b: s.b })));
const [x, y]     = useStore(useShallow(s => [s.x, s.y]));
```
**Derived data = selector, not stored state:**
```jsx
const total = useCart(s => s.items.reduce((sum, i) => sum + i.price * i.qty, 0));
const count = useCart(s => s.items.length);
```

## 4. Real store: Cart
```jsx
// store/cartStore.js
import { create } from "zustand";
import { persist, devtools } from "zustand/middleware";

export const useCartStore = create(
  devtools(
    persist(
      (set) => ({
        items: [],                                                // [{ id, name, price, qty }]
        add: (product) => set((s) => {
          const found = s.items.find(i => i.id === product.id);
          return {
            items: found
              ? s.items.map(i => i.id === product.id ? { ...i, qty: i.qty + 1 } : i)
              : [...s.items, { ...product, qty: 1 }],
          };
        }, false, "cart/add"),                                    // 3rd arg = action name for devtools
        setQty: (id, qty) => set((s) => ({
          items: qty <= 0 ? s.items.filter(i => i.id !== id)
                          : s.items.map(i => i.id === id ? { ...i, qty } : i),
        })),
        remove: (id) => set((s) => ({ items: s.items.filter(i => i.id !== id) })),
        clear: () => set({ items: [] }),
      }),
      { name: "cart", partialize: (s) => ({ items: s.items }) }    // persist to localStorage, only `items`
    ),
    { name: "CartStore" }
  )
);

// selectors (colocate, reuse)
export const selectCount = (s) => s.items.reduce((n, i) => n + i.qty, 0);
export const selectTotal = (s) => s.items.reduce((t, i) => t + i.price * i.qty, 0);
```
```jsx
function CartBadge() { const count = useCartStore(selectCount); return <span>{count}</span>; }   // re-renders only when count changes
function AddButton({ product }) { const add = useCartStore(s => s.add); return <button onClick={() => add(product)}>Add</button>; }
```

## 5. Async actions
```jsx
export const useProductsStore = create((set) => ({
  items: [], status: "idle", error: null,
  fetch: async () => {
    set({ status: "loading", error: null });
    try { set({ items: await productService.list(), status: "success" }); }
    catch (e) { set({ error: e.message, status: "error" }); }
  },
}));
```
> For **server data**, prefer TanStack Query ([05](./05-axios-and-data-fetching.md)). Zustand is for **client** state (cart, auth user, UI preferences, multi-step wizard state).

## 6. Auth store + Axios (use outside React)
`useStore.getState()`, `.setState()`, `.subscribe()` work **anywhere**: interceptors, utils, tests.
```jsx
// store/authStore.js
export const useAuthStore = create((set) => ({
  user: null, accessToken: null,
  setAccessToken: (accessToken) => set({ accessToken }),
  setUser: (user) => set({ user }),
  logout: () => {
    set({ user: null, accessToken: null });
    queryClient.clear();                       // wipe cached server data (no data leak to next user)
  },
}));

// lib/apiClient.js (non-React code)
const token = useAuthStore.getState().accessToken;
```
Subscribe outside React: `const unsub = useAuthStore.subscribe((s) => console.log(s.user));`.

## 7. Middleware you should know
| Middleware | Purpose |
|---|---|
| `persist` | localStorage/sessionStorage; `name`, `partialize`, `version` + `migrate`, `storage` |
| `devtools` | Redux DevTools extension: inspect/time-travel |
| `immer` | write `state.items.push(x)` safely (`npm i immer`) |
| `subscribeWithSelector` | `subscribe(selector, listener)` for slice-level listeners |

```jsx
import { immer } from "zustand/middleware/immer";
const useTodos = create(immer((set) => ({
  todos: [],
  toggle: (id) => set((s) => { const t = s.todos.find(t => t.id === id); if (t) t.done = !t.done; }),
})));
```
**Order when stacking:** `devtools(persist(immer(...)))`. Verify typing/order in docs.
**persist hydration:** with SSR use `skipHydration`/`onRehydrateStorage` to avoid hydration mismatch.

## 8. Slices pattern (big stores)
```jsx
const createUiSlice = (set) => ({ sidebarOpen: false, toggleSidebar: () => set(s => ({ sidebarOpen: !s.sidebarOpen })) });
const createUserSlice = (set) => ({ user: null, setUser: (user) => set({ user }) });

export const useAppStore = create((...a) => ({ ...createUiSlice(...a), ...createUserSlice(...a) }));
```
Alternative: several small stores (one per domain). Both fine. Avoid one god store with everything.

## 9. TypeScript shape
```ts
interface CartState { items: Item[]; add: (p: Product) => void; }
export const useCartStore = create<CartState>()((set) => ({ /* … */ }));   // note the extra ()
```

## 10. Under the hood: Zustand in ~20 lines (senior content)
```jsx
import { useSyncExternalStore } from "react";

function createStore(init) {
  let state;
  const listeners = new Set();
  const getState = () => state;
  const setState = (partial) => {
    const next = typeof partial === "function" ? partial(state) : partial;
    if (!Object.is(next, state)) {
      state = Object.assign({}, state, next);        // shallow merge
      listeners.forEach((l) => l());                  // notify subscribers
    }
  };
  const subscribe = (l) => (listeners.add(l), () => listeners.delete(l));
  state = init(setState, getState);
  return { getState, setState, subscribe };
}

function useStore(store, selector = (s) => s) {
  return useSyncExternalStore(store.subscribe, () => selector(store.getState()));
}
```
- State lives **outside React** (a closure), so no Provider is needed and non-React code can use it.
- `useSyncExternalStore` subscribes the component and re-renders when its **selected snapshot** changes (`Object.is`). That's why a selector returning a new object each call is trouble.
- It also prevents **tearing** during concurrent rendering.

## 11. Context vs Zustand
| | Context | Zustand |
|---|---|---|
| Subscription | Whole value | Selector (slice) |
| Provider needed | Yes | No |
| Use outside React | No | Yes (`getState`) |
| Devtools/persist | DIY | Middleware |
| Best for | Theme, locale, DI, scoped subtree | Cart, auth, UI prefs, frequently-updating shared state |

## 12. Pitfalls
- `useStore()` with no selector → re-renders on every change.
- Selector returns new object/array → use `useShallow` or select primitives.
- Mutating state (`state.items.push`) without immer → no re-render.
- Putting server data in the store → stale copy you must hand-sync.
- Forgetting to reset stores between tests (`useStore.setState(initial, true)`).
- Not clearing persisted/cached data at logout.

## Official docs
- Zustand docs: https://zustand.docs.pmnd.rs · GitHub: https://github.com/pmndrs/zustand
- Persist: https://zustand.docs.pmnd.rs/integrations/persisting-store-data
- Slices pattern: https://zustand.docs.pmnd.rs/guides/slices-pattern
- TypeScript guide: https://zustand.docs.pmnd.rs/guides/typescript
- useSyncExternalStore: https://react.dev/reference/react/useSyncExternalStore

## Takeaway · Mistake · Ask yourself
- **Takeaway:** a store is state outside React + subscriptions; selectors decide who re-renders.
- **Mistake:** `const { a, b, c } = useStore()`.
- **Ask:** *Is this client state shared widely, or should it be local / URL / server state instead?*
