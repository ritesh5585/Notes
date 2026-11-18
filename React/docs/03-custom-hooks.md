# 03 · Custom Hooks

> **Prev ←** [02-hooks](./02-hooks.md) · **Next →** [04-architecture-4-layer](./04-architecture-4-layer.md)

## 1. What and why
A custom Hook = a function named `use…` that **calls other Hooks** to package reusable **logic** (state + effects), not UI.

```
Components share UI   → component + props / children
Components share LOGIC → custom hook
```
Without it you copy-paste the same `useState + useEffect` into 10 components; fix a bug in one, forget nine.

**Key facts**
- Each call gets its **own isolated state**. You share the *logic*, not the data (shared data → Context / Zustand).
- Same Rules of Hooks apply (top level, only in components/hooks).
- Name must start with `use` so lint can enforce the rules.
- Don't make a hook that wraps a single `useState` with no extra logic. Extract when there's a **named concept** (`useDebounce`, `useAuth`) or **repeated multi-hook logic**.

**Design checklist**
1. Return shape: tuple `[value, setter]` for 2 items, object `{ data, error, isLoading }` for 3+.
2. Accept options object for flexibility.
3. Clean up everything you start (timers, listeners, requests).
4. Keep returned functions stable (`useCallback`) if consumers will put them in deps.
5. Avoid hidden global state. If it's global, say so (store).

---

## 2. Snippets (type each until it's muscle memory)

### useToggle
```jsx
import { useState, useCallback } from "react";

export function useToggle(initial = false) {
  const [on, setOn] = useState(initial);
  const toggle = useCallback(() => setOn(v => !v), []);
  return [on, toggle, setOn];
}
// const [open, toggleOpen] = useToggle();
```

### useLocalStorage
```jsx
import { useState, useEffect } from "react";

export function useLocalStorage(key, initial) {
  const [value, setValue] = useState(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw !== null ? JSON.parse(raw) : initial;
    } catch { return initial; }
  });
  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
  }, [key, value]);
  return [value, setValue];
}
```

### useDebounce (debounce a **value**)
```jsx
export function useDebounce(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);          // restart timer on every change
  }, [value, delay]);
  return debounced;
}
```

### useDebouncedCallback / useThrottledCallback (debounce a **function**)
```jsx
import { useRef, useEffect, useCallback } from "react";

export function useDebouncedCallback(fn, delay = 300) {
  const fnRef = useRef(fn);
  const timer = useRef();
  useEffect(() => { fnRef.current = fn; });                      // always latest fn → no stale closure
  useEffect(() => () => clearTimeout(timer.current), []);        // cleanup on unmount
  return useCallback((...args) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => fnRef.current(...args), delay);
  }, [delay]);
}

export function useThrottledCallback(fn, interval = 300) {
  const fnRef = useRef(fn);
  const last = useRef(0);
  useEffect(() => { fnRef.current = fn; });
  return useCallback((...args) => {
    const now = Date.now();
    if (now - last.current >= interval) { last.current = now; fnRef.current(...args); }
  }, [interval]);
}
```

### useFetch (race-safe)
```jsx
export function useFetch(url) {
  const [state, setState] = useState({ data: null, error: null, status: "idle" });
  useEffect(() => {
    if (!url) return;
    const controller = new AbortController();
    setState(s => ({ ...s, status: "loading", error: null }));
    fetch(url, { signal: controller.signal })
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(data => setState({ data, error: null, status: "success" }))
      .catch(e => { if (e.name !== "AbortError") setState({ data: null, error: e, status: "error" }); });
    return () => controller.abort();
  }, [url]);
  return { ...state, isLoading: state.status === "loading" };
}
```
> Good for learning/small apps. At scale use TanStack Query (cache, dedupe, retries). See [05](./05-axios-and-data-fetching.md).

### useClickOutside
```jsx
export function useClickOutside(ref, handler) {
  const handlerRef = useRef(handler);
  useEffect(() => { handlerRef.current = handler; });
  useEffect(() => {
    const listener = (e) => { if (ref.current && !ref.current.contains(e.target)) handlerRef.current(e); };
    document.addEventListener("mousedown", listener);
    return () => document.removeEventListener("mousedown", listener);
  }, [ref]);
}
// const ref = useRef(); useClickOutside(ref, () => setOpen(false)); <div ref={ref}>…</div>
```

### usePrevious
```jsx
export function usePrevious(value) {
  const ref = useRef();
  useEffect(() => { ref.current = value; });   // runs after render → ref holds previous during render
  return ref.current;
}
```

### useMediaQuery (external store)
```jsx
import { useSyncExternalStore } from "react";
export function useMediaQuery(query) {
  return useSyncExternalStore(
    (cb) => { const m = window.matchMedia(query); m.addEventListener("change", cb); return () => m.removeEventListener("change", cb); },
    () => window.matchMedia(query).matches,
    () => false
  );
}
// const isMobile = useMediaQuery("(max-width: 768px)");
```

### useInterval (declarative setInterval)
```jsx
export function useInterval(callback, delay) {
  const saved = useRef(callback);
  useEffect(() => { saved.current = callback; });
  useEffect(() => {
    if (delay == null) return;                 // null pauses
    const id = setInterval(() => saved.current(), delay);
    return () => clearInterval(id);
  }, [delay]);
}
```

### useOnScreen / infinite scroll trigger (IntersectionObserver)
```jsx
export function useOnScreen(options) {
  const [node, setNode] = useState(null);       // callback-ref → works when node mounts later
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!node) return;
    const obs = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), options);
    obs.observe(node);
    return () => obs.disconnect();
  }, [node, options]);
  return [setNode, visible];
}
// const [sentinelRef, visible] = useOnScreen({ rootMargin: "200px" });  <div ref={sentinelRef} />
```
(Pass a stable/hoisted `options` object, or the effect re-runs each render.)

---

## 3. Domain hooks (app-level, they use services/stores)
```jsx
// hooks/useAuth.js  → thin hook over a store (08) or context (07)
export const useAuth = () => useAuthStore(useShallow(s => ({ user: s.user, isAuth: !!s.user })));

// features/products/useProducts.js → wraps a query + service (04, 05)
export function useProducts(filters) {
  return useQuery({ queryKey: ["products", filters], queryFn: () => productService.list(filters) });
}
```
Domain hooks give components a *vocabulary* ("I need products") without knowing HTTP. This is **layer 2** of the architecture ([04](./04-architecture-4-layer.md)).

## 4. Anti-patterns
- Hook that returns JSX → that's a component.
- Hook calling `setState` for derived data → compute inline.
- Returning a new object/array every render and consumers put it in deps → infinite loops; `useMemo` it or return stable pieces.
- "Hook per file for everything" → extract when reused or when it names a concept.
- Testing: render with `renderHook` from Testing Library.

## Official docs
- Reusing logic with custom Hooks: https://react.dev/learn/reusing-logic-with-custom-hooks
- Rules of Hooks: https://react.dev/reference/rules/rules-of-hooks
- Removing effect dependencies: https://react.dev/learn/removing-effect-dependencies
- Library of ready hooks (for reference, not for copying blindly): https://usehooks.com · https://github.com/streamich/react-use
- `renderHook`: https://testing-library.com/docs/react-testing-library/api/#renderhook

## Takeaway · Mistake · Ask yourself
- **Takeaway:** share logic with hooks, share UI with components, share *data* with context/store.
- **Mistake:** assuming two components calling the same hook share state. They don't.
- **Ask:** *Is this repeated logic with a name, or am I just hiding one useState?*
