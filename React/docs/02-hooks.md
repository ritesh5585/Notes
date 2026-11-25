# 02 · Hooks

> **Prev ←** [01-basics](./01-basics.md) · **Next →** [03-custom-hooks](./03-custom-hooks.md)

A **Hook** = a function starting with `use` that gives a function component abilities (memory, side effects, shared data). Function components forget everything after each run; Hooks give them memory **stored by React on the component's fiber**.

## 0. Rules of Hooks (and the real reason)
1. Call Hooks only at the **top level** (no `if`, loops, nested functions, after early `return`).
2. Call only from **components or custom Hooks**.

*Why:* React stores Hooks as a list **by call order**, no names. Different order between renders → values map to the wrong Hook. (Toy model in [13-senior-internals](./13-senior-internals.md).)

## 1. Which Hook for which problem

| Problem | Hook |
|---|---|
| Remember a value, update UI when it changes | `useState` |
| Many related state transitions | `useReducer` |
| Sync with something outside React (API, timer, listener, socket) | `useEffect` |
| Keep a value without re-render / grab a DOM node | `useRef` |
| Read shared data without drilling | `useContext` |
| Cache an expensive **value** | `useMemo` |
| Keep a **function** reference stable | `useCallback` |
| Measure DOM before paint | `useLayoutEffect` |
| Stable unique id (a11y, SSR-safe) | `useId` |
| Mark an update non-urgent | `useTransition` |
| Lagging copy of a value for heavy renders | `useDeferredValue` |
| Subscribe to an external store safely | `useSyncExternalStore` |
| React 19: read promise/context, form actions, optimistic UI | `use`, `useActionState`, `useOptimistic` |

---

## 2. `useState`
```jsx
const [count, setCount] = useState(0);
const [user, setUser] = useState(() => readFromStorage());   // lazy init: runs once
setCount(c => c + 1);                                          // functional update
setUser(u => ({ ...u, name: "A" }));                           // new object, never mutate
```
- Setting the **same value** (`Object.is`) → React skips re-render.
- Group related fields in one object only if they change together; otherwise separate states.
- Don't copy props into state (`useState(props.x)`) unless you want "initial value only". Otherwise it goes stale.

## 3. `useEffect`: sync with the outside world

```jsx
useEffect(() => {
  // setup: runs AFTER render/commit
  return () => { /* cleanup: before next setup and on unmount */ };
}, [deps]);
```
```jsx
useEffect(fn);            // after every render
useEffect(fn, []);        // once after mount (uses no reactive values)
useEffect(fn, [userId]);  // mount + whenever userId changes
```
**Deps are a contract, not a speed knob:** if the effect reads it, list it (`react-hooks/exhaustive-deps`).

### 3.1 Four patterns to memorize
```jsx
// A. Event listener
useEffect(() => {
  const onResize = () => setW(window.innerWidth);
  window.addEventListener("resize", onResize);
  return () => window.removeEventListener("resize", onResize);
}, []);

// B. Interval (functional update avoids stale closure + no dep on count)
useEffect(() => {
  const id = setInterval(() => setSeconds(s => s + 1), 1000);
  return () => clearInterval(id);
}, []);

// C. Fetch with cancellation (race-safe)
useEffect(() => {
  const controller = new AbortController();
  setStatus("loading");
  fetch(`/api/products/${id}`, { signal: controller.signal })
    .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(data => { setProduct(data); setStatus("success"); })
    .catch(e => { if (e.name !== "AbortError") setStatus("error"); });
  return () => controller.abort();
}, [id]);

// D. Document title / non-React DOM sync
useEffect(() => { document.title = `Cart (${count})`; }, [count]);
```

### 3.2 You might not need an effect
| You want to… | Do this instead |
|---|---|
| Compute data from props/state | Calculate in render |
| Reset state when a prop changes | `key={prop}` on the component |
| React to a user action | Event handler |
| Expensive derived value | `useMemo` |
| Fetch data (at scale) | TanStack Query ([05](./05-axios-and-data-fetching.md)) |
| Subscribe to external store | `useSyncExternalStore` |

> Ask first: **"What external system am I syncing with?"** If nothing → no effect.

### 3.3 Classic bugs
```jsx
useEffect(() => { setCount(count + 1); }, [count]);        // ❌ infinite loop (writes own trigger)
const options = { roomId };
useEffect(() => connect(options), [options]);              // ❌ new object each render → reruns
useEffect(() => connect({ roomId }), [roomId]);            // ✅ primitive dep
useEffect(() => { fetchUser(userId); }, []);               // ❌ stale: userId missing
```
Double run in dev = StrictMode (setup → cleanup → setup). Fix the cleanup, don't remove StrictMode.

## 4. `useRef`: a box that doesn't trigger renders
```jsx
const inputRef = useRef(null);
<input ref={inputRef} />
<button onClick={() => inputRef.current.focus()}>Focus</button>

const timerId = useRef();                 // mutable value across renders
const prev = useRef(value);               // previous value
useEffect(() => { prev.current = value; });
```
Use for DOM nodes, timer IDs, latest-callback, previous value. **Never** for data the screen must show.

## 5. `useReducer`: state with rules
```jsx
function reducer(state, action) {
  switch (action.type) {
    case "add": {
      const found = state.find(i => i.id === action.item.id);
      return found
        ? state.map(i => i.id === found.id ? { ...i, qty: i.qty + 1 } : i)
        : [...state, { ...action.item, qty: 1 }];
    }
    case "remove": return state.filter(i => i.id !== action.id);
    case "clear":  return [];
    default: throw new Error(`Unknown action ${action.type}`);
  }
}
const [cart, dispatch] = useReducer(reducer, []);
dispatch({ type: "add", item });
```
```
UI → dispatch(action) → reducer(oldState, action) → newState → render
```
Reducer must be **pure**. Use when updates are many and related; boolean/number → `useState`.

## 6. `useMemo` / `useCallback`
```jsx
const visible = useMemo(() => products.filter(match).sort(byPrice), [products, match]);
const onAdd = useCallback((p) => addToCart(p), [addToCart]);   // ≈ useMemo(() => fn, deps)
```
Why they exist: `{} === {}` and `(()=>{}) === (()=>{})` are **false**. New reference each render matters only when something compares references: `memo` children, hook deps, context value.
**Not go-faster buttons.** Memoizing cheap work = overhead. Measure ([10](./10-performance-optimization.md)).

## 7. `useLayoutEffect`, `useId`
```jsx
// useLayoutEffect: after DOM mutation, BEFORE paint (no flicker, but blocks paint)
useLayoutEffect(() => { setTop(ref.current.getBoundingClientRect().bottom); }, []);

// useId: label ↔ input pairing, SSR-safe. Never for list keys.
const id = useId();
<label htmlFor={id}>Email</label><input id={id} />
```
Default to `useEffect`; reach for layout effect only to measure/adjust layout.

## 8. `useTransition` / `useDeferredValue` (React 18+)
```jsx
const [isPending, startTransition] = useTransition();
function onChange(e) {
  setQuery(e.target.value);                           // urgent: input updates now
  startTransition(() => setFilter(e.target.value));   // non-urgent: heavy render can be interrupted
}

const deferred = useDeferredValue(query);             // lagging copy when you don't own setState
const results = useMemo(() => filter(products, deferred), [products, deferred]);
```
They lower **urgency**, not work. Debounce lowers **frequency**. Different tools ([10](./10-performance-optimization.md)).

## 9. `useSyncExternalStore` (library-level)
```jsx
function useOnlineStatus() {
  return useSyncExternalStore(
    (cb) => { window.addEventListener("online", cb); window.addEventListener("offline", cb);
              return () => { window.removeEventListener("online", cb); window.removeEventListener("offline", cb); }; },
    () => navigator.onLine,     // client snapshot
    () => true                  // server snapshot (SSR)
  );
}
```
Zustand uses this. It prevents **tearing** (half UI old data, half new, during concurrent render).

## 10. React 19 additions (verify on react.dev)
```jsx
// use(): read a promise or context during render (can be conditional, unlike Hooks)
const data = use(dataPromise);               // suspends until resolved

// useActionState: form action + pending + result
const [state, formAction, isPending] = useActionState(async (prev, formData) => {
  const res = await save(formData); return res.error ?? null;
}, null);
<form action={formAction}>…</form>

// useOptimistic: show result before server confirms
const [optimisticItems, addOptimistic] = useOptimistic(items, (cur, newItem) => [...cur, newItem]);
```

---

## Official docs
- All hooks: https://react.dev/reference/react/hooks
- Rules of Hooks: https://react.dev/reference/rules/rules-of-hooks
- useState: https://react.dev/reference/react/useState
- useEffect: https://react.dev/reference/react/useEffect
- You Might Not Need an Effect: https://react.dev/learn/you-might-not-need-an-effect
- Synchronizing with Effects: https://react.dev/learn/synchronizing-with-effects
- Lifecycle of reactive effects: https://react.dev/learn/lifecycle-of-reactive-effects
- useRef: https://react.dev/reference/react/useRef
- useReducer: https://react.dev/reference/react/useReducer
- useMemo: https://react.dev/reference/react/useMemo · useCallback: https://react.dev/reference/react/useCallback
- useTransition: https://react.dev/reference/react/useTransition · useDeferredValue: https://react.dev/reference/react/useDeferredValue
- useSyncExternalStore: https://react.dev/reference/react/useSyncExternalStore
- React 19: https://react.dev/blog/2024/12/05/react-19

## Takeaway · Mistake · Ask yourself
- **Takeaway:** state = memory, effect = sync with outside, ref = silent box, memo hooks = reference stability. Nothing more.
- **Mistake:** effects for things that are derived data or event-handler logic.
- **Ask:** *What external system does this effect sync with, and what does its cleanup undo?*
