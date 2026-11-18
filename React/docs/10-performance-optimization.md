# 10 · Performance & Optimization (memo, debounce, throttle, lazy, virtualization)

> **Prev ←** [09-routing](./09-routing.md) · **Next →** [11-bugs-and-debugging](./11-bugs-and-debugging.md)

## 1. The method (never skip)
```
1. Is it actually slow? (feel it or measure)
2. MEASURE  → React DevTools Profiler ("Record why each component rendered"), "Highlight updates"
3. FIND     → which components, how often, how long, WHY
4. FIX      → smallest change that addresses THAT cause
5. MEASURE AGAIN → no improvement? undo it
```
Measure in a **production build** (`npm run build && npm run preview`). Dev mode is slower and StrictMode doubles renders.

## 2. What actually makes React apps slow
| Cause | Symptom |
|---|---|
| State too high / unstable props → too many renders | typing/hover lags |
| One render is expensive (heavy calc in render) | single interaction freezes |
| Huge DOM (thousands of nodes) | slow paint & scroll |
| Big JS bundle | slow first load |
| Duplicate / waterfall API calls | flicker, delays |
| Long main-thread task (>50 ms) | janky input |
| Big images | slow load, layout shift |

## 3. Toolbox, cheapest first

### ① State colocation (free)
```jsx
// ❌ query state in <Page> → whole page + grid re-render each keystroke
// ✅ <SearchBox> owns the text, passes up only a debounced/committed value
```

### ② `children` pattern (free)
A component that holds fast-changing state but renders `{children}` doesn't re-render them: those elements were created by the parent, which didn't re-render, so they're the **same references**.
```jsx
function MouseTracker({ children }) {
  const [pos, setPos] = useState({ x: 0, y: 0 });
  return <div onMouseMove={e => setPos({ x: e.clientX, y: e.clientY })}>{children}</div>;
}
<MouseTracker><ExpensiveTree /></MouseTracker>    // ExpensiveTree skipped
```

### ③ `React.memo` + stable props
Skips a child when all props are `Object.is`-equal (shallow compare).
```jsx
const ProductCard = memo(function ProductCard({ product, onAdd }) { /* … */ });

// Parent: keep props stable
const onAdd = useCallback((id) => addToCart(id), [addToCart]);
<ProductCard product={p} onAdd={onAdd} />
```
**Why a memoized child still re-renders:** inline `{}` / `[]` / `() => {}` props are new each render.
```jsx
<MemoCard style={{ margin: 8 }} onAdd={() => add(p)} />   // ❌ always "changed"
const CARD_STYLE = { margin: 8 };                         // ✅ hoist constants
<MemoCard style={CARD_STYLE} onAdd={onAdd} id={p.id} />   // ✅ pass id; child calls onAdd(id)
```
`memo` does **not** block re-renders from the component's own state or from Context.

### ④ `useMemo` / ⑤ `useCallback`
```jsx
const visible = useMemo(() => products.filter(match).sort(byPrice), [products, match]);   // expensive calc
const onAdd = useCallback((id) => { … }, [deps]);          // only useful if a memo child / dep array compares it
```
Use for **expensive calculations** or **stable references** that something downstream compares. Memoizing `a + b` = overhead.

### ⑥ Context & store precision
- Split Contexts by update frequency; memoize the Provider value ([07](./07-context-api.md)).
- Zustand: select primitives / `useShallow` ([08](./08-zustand.md)).

### ⑦ Big lists
**10,000 rows? Bottleneck = DOM size, not calculation.** Order of attack:
1. **Server-side pagination / infinite scroll**
2. **Virtualization**: render only visible rows
3. memoized rows + stable keys, `loading="lazy"` images
```jsx
import { useVirtualizer } from "@tanstack/react-virtual";

function VirtualList({ items }) {
  const parentRef = useRef(null);
  const rowVirtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 56,
    overscan: 8,
  });
  return (
    <div ref={parentRef} style={{ height: 600, overflow: "auto" }}>
      <div style={{ height: rowVirtualizer.getTotalSize(), position: "relative" }}>
        {rowVirtualizer.getVirtualItems().map(v => (
          <div key={v.key} style={{ position: "absolute", top: 0, left: 0, width: "100%",
                                    height: v.size, transform: `translateY(${v.start}px)` }}>
            <Row item={items[v.index]} />
          </div>
        ))}
      </div>
    </div>
  );
}
```

### ⑧ Loading cost: code splitting, lazy, images
```jsx
import { lazy, Suspense } from "react";
const Checkout = lazy(() => import("./Checkout"));       // separate chunk, fetched on demand
<Suspense fallback={<Spinner />}><Checkout /></Suspense>
```
- Split **per route**, then per heavy widget (charts, editors, maps).
- Analyze bundle (`rollup-plugin-visualizer` for Vite); replace heavy libs (moment → date-fns/dayjs).
- Images: correct sizes, modern formats (webp/avif), `loading="lazy"`, set `width/height` (prevents layout shift).
- Prefetch the next route on hover/idle: `import("./Checkout")` inside `onMouseEnter`.

### ⑨ Request efficiency
Cache, dedupe, cancel, prefetch → TanStack Query ([05](./05-axios-and-data-fetching.md)). Avoid fetch **waterfalls** (parent fetches, then child fetches): hoist or parallelize.

---

## 4. Debounce vs Throttle (taming rapid events)

Typing, scroll, mousemove, resize fire *a lot*. Doing expensive work (API call, heavy render) per event chokes the app or spams the server.

**Debounce = "wait until they stop."** Elevator door: every person entering restarts the timer; closes only after quiet.
**Throttle = "at most once per interval."** Guard checks the building every 10 min regardless of traffic.

```
events:   | | | |  | | | | | |        | |
DEBOUNCE(300):                                  ▲ once, 300ms after the last event
THROTTLE(300):  ▲     ▲     ▲     ▲     ▲       at most once per 300ms during the burst
```
| | Debounce | Throttle |
|---|---|---|
| Runs | after events **stop** for N ms | at most **once per** N ms |
| During continuous events | never (keeps resetting) | regularly |
| Use for | search-as-you-type, autosave, validation, "resize ended" | scroll, drag, mousemove, live resize, analytics |

### Plain JS (understand the closure)
```js
function debounce(fn, delay) {
  let timer;                                   // closure variable shared across calls
  return function (...args) {
    clearTimeout(timer);                       // restart countdown
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

function throttle(fn, interval) {
  let last = 0;
  return function (...args) {
    const now = Date.now();
    if (now - last >= interval) { last = now; fn.apply(this, args); }
  };
}
```
Options in libraries (`lodash`, `use-debounce`): **leading** (fire at start), **trailing** (fire at end, default), `.cancel()`, `.flush()`. A good throttle also fires a final trailing call so the last value isn't lost.

### React gotchas
1. **Creating the debounced fn in the component body.** Every re-render makes a *new* debounced function with a *new* timer, so earlier pending timers aren't cleared. With a controlled input (re-renders per key) nothing is truly debounced.
   ```jsx
   const onChange = debounce(fetchResults, 300);   // ❌ new each render
   ```
   Fix: debounce the **value** (below) or hold the function in `useRef`/`useMemo`/`useCallback` with stable identity.
2. **Stale closures:** a debounced callback captured old props/state → keep latest fn in a ref (see `useDebouncedCallback` in [03](./03-custom-hooks.md)).
3. **No cleanup:** a pending timer can fire **after unmount**. Clear it.
4. **Never debounce what the user sees.** The input updates **immediately**; debounce only the derived work (the API call).

### The default pattern: debounce the value
```jsx
function ProductSearch() {
  const [text, setText] = useState("");                 // instant → input stays responsive
  const debounced = useDebounce(text, 300);             // updates 300ms after typing stops
  const { data, isPending } = useQuery({
    queryKey: ["search", debounced],
    queryFn: ({ signal }) => productService.list({ q: debounced }, signal),   // aborts stale requests
    enabled: debounced.length > 1,
  });
  return (
    <>
      <input value={text} onChange={e => setText(e.target.value)} />
      {isPending ? <Skeleton /> : <Results items={data?.items ?? []} />}
    </>
  );
}
```
Three tools, three jobs: **state** keeps typing instant · **debounce** limits request *frequency* · **abort/cancel** kills requests already outdated.

### Better than hand-throttling scroll
| Need | Use |
|---|---|
| Animation/position tied to scroll | `requestAnimationFrame` (once per frame) |
| "Load more near bottom", lazy images | **`IntersectionObserver`** (no scroll handler) |
| Element size changes | **`ResizeObserver`** |
| Scroll listener you must keep | `{ passive: true }` |

### Pitfalls
- 250-400 ms typical for search; too long feels broken.
- **Enter/submit should skip the wait** (`flush()` or call directly).
- Double-submit protection = disable button / throttle, not debounce.
- Test with fake timers (`vi.useFakeTimers()`), not real waits.

---

## 5. Transitions & deferred values (urgency, not frequency)
```jsx
function Search({ items }) {
  const [query, setQuery] = useState("");
  const [isPending, startTransition] = useTransition();
  const [filter, setFilter] = useState("");

  const onChange = (e) => {
    setQuery(e.target.value);                              // urgent: input
    startTransition(() => setFilter(e.target.value));      // non-urgent: heavy list render, interruptible
  };
  const results = useMemo(() => heavyFilter(items, filter), [items, filter]);
  return (<><input value={query} onChange={onChange} />{isPending && <Spinner />}<List data={results} /></>);
}

// when you don't own the setState (prop):
const deferredQuery = useDeferredValue(query);
const stale = query !== deferredQuery;
```
They **don't make slow code fast**; the heavy render still happens, but urgent input isn't blocked. If the render is truly too heavy → reduce work (virtualize/paginate).

## 6. Which tool when?
| Tool | Reduces | Doesn't help with | Typical use |
|---|---|---|---|
| Debounce | how **often** work runs (CPU + network) | slow render once it runs | search API, autosave |
| Throttle | rate during a stream | exact final value (unless trailing) | scroll, drag, resize |
| `useDeferredValue` | **urgency** of a heavy render | number of API calls | filtering big list as you type |
| `useTransition` | urgency of a state update's render | network spam | tab switch, big filter |
| `AbortController` | stale responses, wasted bandwidth | event frequency | cancel previous request |
| `memo` / colocation | needless re-renders | calculations that must run | stable lists |
| Virtualization | DOM size | event frequency | long lists |
| Code splitting | initial bundle | runtime renders | route/widget loading |

**Great search box = controlled input + debounce + abort + transition/deferred + memo rows (+ virtualization if huge).**

## 7. Web Vitals (the user-facing scoreboard)
| Metric | User feels | React levers |
|---|---|---|
| **LCP** | when main content appears | smaller bundle, code splitting, image optimization, SSR/streaming, avoid waterfalls |
| **INP** | how fast the screen reacts to click/type | fewer/cheaper renders, colocation, transitions, debounce, break long tasks |
| **CLS** | do things jump around? | reserve image/skeleton sizes, don't insert above existing content |

**Long task** = JS > 50 ms blocking the main thread. Fix by *doing less*, *splitting* (pagination/virtualization), or *lowering priority* (transitions).

## 8. Every optimization has a price
| Technique | You pay |
|---|---|
| `memo` | comparison cost; silently breaks when props unstable |
| `useMemo`/`useCallback` | memory, dep bugs, noisier code |
| Virtualization | scroll/height/a11y complexity |
| Code splitting | loading states, possible waterfalls |
| Debounce | intentional delay |
| Global store | indirection |

**React Compiler** (build-time) can auto-memoize, reducing manual `useMemo`/`useCallback`. It can't fix state placed too high, giant DOM, or network waterfalls. Check https://react.dev/learn/react-compiler for current status.

## 9. Worked cases
**A. Search box laggy**
```
Symptom: each keystroke freezes ~200ms
Measure: Profiler → <ProductGrid> (2000 cards) re-renders every keystroke
Cause:   `query` state lives in <Page>, which renders the grid
Fix:     move query into <SearchBox>; debounce committed term; memo(ProductCard) with stable props
Verify:  grid renders once per pause, not per keystroke
```
**B. 10,000 cards slow to open**
```
Symptom: 3s blank, scroll stutters
Measure: ~10,000 DOM nodes; commit dominates
Cause:   everything rendered at once
Fix:     server pagination/infinite scroll → virtualization → lazy images
NOT the fix: useMemo on the list (calculation wasn't the problem)
```

## Official docs
- Profiler (React DevTools): https://react.dev/learn/react-developer-tools · API: https://react.dev/reference/react/Profiler
- memo: https://react.dev/reference/react/memo · useMemo: https://react.dev/reference/react/useMemo · useCallback: https://react.dev/reference/react/useCallback
- lazy / Suspense: https://react.dev/reference/react/lazy · https://react.dev/reference/react/Suspense
- useTransition / useDeferredValue: https://react.dev/reference/react/useTransition · https://react.dev/reference/react/useDeferredValue
- React Compiler: https://react.dev/learn/react-compiler
- TanStack Virtual: https://tanstack.com/virtual/latest · react-window: https://github.com/bvaughn/react-window
- Web Vitals: https://web.dev/articles/vitals
- IntersectionObserver (MDN): https://developer.mozilla.org/en-US/docs/Web/API/Intersection_Observer_API
- lodash debounce: https://lodash.com/docs/#debounce

## Takeaway · Mistake · Ask yourself
- **Takeaway:** measure → find the cause (renders / DOM size / network / bundle / long task) → smallest fix → measure again.
- **Mistake:** sprinkling `useMemo`/`useCallback`/`memo` everywhere, or debouncing the input the user is typing in.
- **Ask:** *Is the problem the number of renders, the cost of one render, the DOM size, or the network?*
