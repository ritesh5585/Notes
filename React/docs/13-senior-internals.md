# 13 · Senior Level: React Internals

> **Prev ←** [12-patterns-and-components](./12-patterns-and-components.md) · **Next →** [14-interview-bank](./14-interview-bank.md)

You don't need this to build apps. You need it to **predict** React's behavior, debug weird cases, and answer senior interviews.

**Analogy: restaurant kitchen.** Elements = order tickets · Fibers = work cards tracking each dish · Scheduler = head chef choosing what to cook first · Commit = serving all plates at once so diners never see half a table.

---

## 1. The machine: four parts
```
JSX → ELEMENTS (plain objects)
          │
   ┌──────▼───────┐       ┌───────────┐
   │  RECONCILER  │◀─────▶│ SCHEDULER │  "when, in what priority?"
   │ (Fiber loop) │       └───────────┘
   └──────┬───────┘
          │ finished list of changes (flags on fibers)
   ┌──────▼───────┐
   │   RENDERER   │  react-dom: createElement, appendChild, setAttribute…
   └──────┬───────┘
        real DOM → browser paints
```
| Part | Job |
|---|---|
| `react` | Components, Hooks, `createElement`. No DOM knowledge |
| Reconciler | Render components, diff, decide what changed. Platform-independent |
| Renderer (`react-dom`, `react-native`, …) | Applies changes on its platform |
| `scheduler` | Decides when work runs, yields to the browser |

Why split: one hard algorithm, many platforms. **History:** created at Facebook (internal use ~2011), open-sourced **2013**. **Fiber** rewrite shipped in **React 16 (2017)**. Concurrent features (transitions, `useDeferredValue`) arrived in **React 18**.

## 2. Elements and Fibers

### Element = the order ticket
```js
{ $$typeof: Symbol(react.element), type: "h1", key: null, ref: null, props: { className: "title", children: "Hi" } }
```
Immutable plain object, cheap to create. `$$typeof` is a Symbol so JSON from a server can't masquerade as an element (XSS defense). *(The exact symbol name differs in React 19 (`react.transitional.element`); the idea is identical.)*

### Fiber = the work card (one per component instance / DOM node)
```js
FiberNode = {
  type, key, stateNode,            // component fn / "div"; real DOM node
  return, child, sibling,          // linked-list tree: parent, first child, next sibling
  pendingProps, memoizedProps,
  memoizedState,                   // function components: the LINKED LIST OF HOOKS
  updateQueue,
  flags, subtreeFlags,             // "what must happen at commit" (Placement, Update, Deletion, Passive, Ref…)
  lanes, childLanes,               // priority of pending work here / below
  alternate                        // twin in the other tree (double buffering)
}
```

### Why a linked list instead of recursion?
The old reconciler (≤15) recursed. Recursion state lives on the **JS call stack, which you can't pause**. Fiber turned the walk into a **loop with one pointer** (`nextUnitOfWork`): stop after any fiber, let the browser handle input/paint, resume, or discard.

### Double buffering
| Tree | Meaning |
|---|---|
| `current` | what's on screen |
| `workInProgress` | draft for the next screen |

React builds the draft **without touching** the DOM; at commit it flips `root.current = workInProgress`. Abandoning a draft has zero visible effect → makes interruptible rendering safe.

## 3. Render phase
```js
function workLoop() {
  while (nextUnitOfWork && !shouldYield()) nextUnitOfWork = performUnitOfWork(nextUnitOfWork);
  if (!nextUnitOfWork) commitRoot();          // draft finished
  else scheduleCallback(workLoop);            // out of time → continue next slice
}
```
- **beginWork** (going down): run the component (Hooks wired to this fiber), `reconcileChildren`, set flags.
- **completeWork** (going up): prepare DOM node off-screen, bubble flags.

### Bail-outs (when React skips work)
Skip a component when: props are `===` last time, no pending state update on it, no context it reads changed. Parent re-render creates **new props objects** for every child, so by default nothing bails out. That's the real reason children re-render. `React.memo` adds a shallow compare **before** rendering.
`children` pattern works because those elements are created by a component that **didn't** re-render → same references → bail out.

### Diffing heuristics (O(n) instead of O(n³))
1. **Different `type` at same position** → destroy subtree, build new (state lost).
2. **Same type** → reuse fiber/DOM, update changed props, recurse.
3. **Lists: `key` is identity**; matching by key means moves not rebuilds. Algorithm: walk by position while keys match; at first mismatch map remaining old fibers by key; track `lastPlacedIndex` to decide which nodes actually move.

### Why render must be pure
Render may be **paused, restarted, discarded, or run twice** (StrictMode, concurrent). Side effects in render would run an unpredictable number of times. **Purity is what frees React to schedule.**

## 4. Commit phase
```
RENDER (pure, interruptible for transitions)
   ↓ draft done
COMMIT (synchronous, uninterruptible)
  ① before-mutation (getSnapshotBeforeUpdate)
  ② mutation: DOM insert/update/delete; layout-effect CLEANUPS; detach refs
       ── root.current = workInProgress ──
  ③ layout: useLayoutEffect SETUPS; attach refs; componentDidMount/Update
   ↓
BROWSER PAINT
   ↓
PASSIVE EFFECTS (useEffect): ALL cleanups first, then ALL setups
```
```
render → [useInsertionEffect] → DOM mutations → [useLayoutEffect] → paint → [useEffect]
```
| Fact | Consequence |
|---|---|
| `useLayoutEffect` runs after DOM change, **before paint** | Measure/adjust with no flicker (blocks paint) |
| `setState` in `useLayoutEffect` → sync re-render before paint | No flicker, but blocks |
| `setState` in `useEffect` → second render after user saw first | Possible flicker |
| Effects run **children before parents** | Parent's setup after all children |
| All cleanups before any new setups | Old world torn down first |
| Refs attach in layout step | `ref.current` null during first render |

**Nuance:** if an update came from a **discrete event** (click, keypress), React 18 flushes passive effects **synchronously before paint**. "Effects after paint" is the usual case, not a guarantee.
**Why commit can't be interrupted:** half-applied DOM could paint an inconsistent screen. *Interruptible draft, atomic delivery.*

## 5. How Hooks work
Hooks live on the fiber in `fiber.memoizedState` as a **linked list in call order**:
```
memoizedState → [useState: 0] → [useEffect: {create, deps}] → [useRef: {current}] → null
```
### Toy model (feel why order matters)
```js
let hooks = []; let i = 0;
function useState(initial) {
  const idx = i;
  if (hooks[idx] === undefined) hooks[idx] = initial;
  const setState = (v) => { hooks[idx] = typeof v === "function" ? v(hooks[idx]) : v; rerender(); };
  i++;
  return [hooks[idx], setState];
}
function render() { i = 0; Component(); }
```
Conditional hook: render 1 with `flag=true` → slot0 = "A", slot1 = "B". Render 2 with `flag=false` → the only `useState` reads slot0 → gets "A" ❌. **That's the Rules of Hooks.** No names, only order.

### Real mechanics
- **Dispatcher switching:** mount = create hook node; update = read it. Outside render there's no dispatcher → "Invalid hook call".
- `useState` = `useReducer` with built-in reducer.
- **Setter** creates an update object, appends to the hook's queue (tagged with a **lane**), schedules a render. It doesn't change your current snapshot.
- Next render processes the queue **in order** → `setCount(c => c+1)` ×3 = +3.
- **Eager bail-out:** if no pending work, compute immediately; if `Object.is`-equal, skip scheduling.
- `useRef` = `{ current }` in the hook node, never triggers updates.
- `useMemo/useCallback` = `[value, deps]`, compare deps with `Object.is`.
- `useEffect` = `{ create, destroy, deps }`; deps changed → flag fiber `Passive`; run old `destroy` then new `create` at commit.
- `useContext` doesn't use a list slot; registers a context dependency on the fiber.

### Why deps and stale closures behave this way
Your effect fn is created **in a specific render** and closes over that render's values. If deps are equal, React keeps the **old** function (with old snapshot). Missing dep = running a function that captured outdated values. It's closures + "skip if deps equal", not a React bug.

## 6. Scheduling, lanes, concurrency
Not all updates are equal: a keystroke must feel instant; filtering 10k rows can wait.

| Lane (priority high → low) | Source | Rendering |
|---|---|---|
| Sync | click, keypress, `flushSync` | immediate, **not** time-sliced |
| Input continuous | mousemove, scroll, drag | high |
| Default | setState in timeout/promise/effect | normal, not time-sliced (React 18) |
| Transition | `startTransition` / `useTransition` | **time-sliced, interruptible** |
| Retry | Suspense retry | low |
| Idle/Offscreen | hidden work | lowest |

React renders the highest-priority lane with pending work; starved low-priority work **expires** upward.
> **Nuance:** in React 18, only **transition-type** work (+ deferred values, Suspense retries) is time-sliced. A normal `setState` runs to completion once started. Concurrency is **opt-in per update**.

- **Scheduler** runs tasks via `MessageChannel` (macrotask) so the browser regains control; ~**5 ms** slices (`shouldYield`).
- **Interrupted transition:**
  ```
  t0 keystroke "a"  → urgent: render input, commit
  t1 transition starts rendering results in slices
  t2 keystroke "ab" → new urgent update
  t3 React DISCARDS the half-built transition draft (screen never touched)
  t4 render input for "ab", commit
  t5 restart transition with latest query → commit
  ```
- **Batching internally:** updates queued with lanes, processed in **one render** per lane. Sync lane flushes in a **microtask**, so everything your handler does synchronously is batched. `flushSync` forces immediate render (rare).
- **Tearing & `useSyncExternalStore`:** if an external store changes mid-render, part of the tree may show old data, part new. `useSyncExternalStore` reads a consistent snapshot and forces such updates synchronous. Zustand/Redux use it.

## 7. Transitions, deferred values, Suspense
| | `useTransition` | `useDeferredValue` |
|---|---|---|
| You wrap | the **state update** | a **value** |
| Use when | you own `setState` | value arrives as prop |
| Gives | `isPending` | a lagging value |
| Mechanism | update gets transition lane | render old value first, then low-priority re-render with new |

Limits: they don't speed up work; can't wrap controlled-input `setState`; `useSyncExternalStore` updates can't be transitions.

**Suspense mechanics:** a component **throws a promise** during render (`lazy`, Suspense data libs; React 19 `use(promise)`). Nearest `<Suspense>` catches, shows `fallback`, attaches `.then`, **retries** render on resolve (Retry lane).
- Boundaries nest (nearest catches).
- Inside a **transition**, React keeps showing old UI (with `isPending`) rather than replace visible content with a fallback.
- **Streaming SSR** uses boundaries to send HTML in chunks.
- Errors go to the nearest **Error Boundary**, not Suspense.

## 8. Context, memo, events internally
**Context:** value stored on the Provider fiber; `useContext` records a dependency on the consumer fiber. When `value` changes (`Object.is`), React walks the subtree, finds dependents, **marks them for update regardless of props or `memo`**. Consequences: `memo` can't stop it; inline `value={{}}` re-renders all; big contexts cause broad renders; middle components that don't consume are skipped.

**`React.memo`:** shallow-compare props with `Object.is` before rendering; never blocks own state/context updates; custom comparator possible but risky. `PureComponent` = class equivalent (props + state).

**Events:** one listener per event type at the **root container** (React 17+; before: `document`) = delegation. React finds the source fiber, simulates capture/bubble, passes a SyntheticEvent (pooling removed in 17). **Event type sets update priority:** click/keydown/input → discrete (Sync); scroll/mousemove → continuous; else default. Portals bubble through the **React tree**.

## 9. StrictMode
Dev only: double-invokes component bodies and `useState/useMemo/reducer` initializers; on mount runs effect **setup → cleanup → setup**; re-runs ref callbacks (19). No effect in production. Fix effects, don't remove StrictMode.

## 10. SSR, hydration, Server Components, React 19, Compiler

| Strategy | HTML built | Good for | Cost |
|---|---|---|---|
| **CSR** | Browser, after JS | dashboards behind login | blank until JS; weaker SEO |
| **SSR** | Server per request | dynamic SEO pages | server cost; TTFB |
| **SSG** | At build time | docs, marketing | stale until rebuild |
| **ISR** | Static pages rebuilt in background | large catalogs | framework-specific staleness |

React alone is a UI library; SSR/SSG/ISR come from frameworks (Next.js, React Router framework mode…).

**Hydration:** server HTML is visible but lifeless; client React walks the HTML, **attaches handlers/state** instead of rebuilding (`hydrateRoot`). **Mismatch** = client first render ≠ server HTML (`Date.now`, `Math.random`, `window` in render, locale). Fix: render same first, update in an effect. **Streaming SSR + selective hydration:** shell first, Suspense parts later; hydrate the boundary the user clicks first.

**Server Components (RSC):** run only on server, can read DB/files directly, ship **zero JS** for themselves, output an RSC payload. **Client Components** (`"use client"`) hold state/effects/handlers. `"use server"` functions = Server Actions. Needs a framework/bundler integration (Next.js App Router), not a plain Vite SPA toggle. Model: *Server = data + structure, Client = interaction; boundary = `"use client"`.*

**React 19:** Actions (`<form action>`, `useActionState`, `useFormStatus`, `useOptimistic`), `use()`, `ref` as prop, `<Context value>`, document metadata, better error reporting. Verify on react.dev.

**React Compiler:** build-time auto-memoization assuming you follow the **Rules of React** (pure render, immutability, Hooks rules). Helps boilerplate and unstable references. Doesn't fix state too high, giant DOM, heavy calc, waterfalls, or rule-breaking code (those components are skipped). You still learn manual memoization to read old code and know its limits.

## 11. Why React is designed this way
| Decision | Reason |
|---|---|
| Declarative `UI = f(state)` | Humans are bad at tracking every DOM mutation |
| One-way data flow | Every value has one owner → traceable |
| Props read-only | Silent child mutation makes flow untraceable |
| Immutable state | Change detection by cheap `Object.is`; enables bail-outs, memoization, time-travel |
| Pure render | Pause, restart, discard, double-run freely |
| Hooks by call order | No names to manage; cheap linked list; cost = Rules of Hooks |
| Effects separate from render | Render stays pure; effects at known times with cleanup |
| Keys | O(n) diff needs identity; position misattributes state |
| Fiber (list + 2 trees) | Pausable, resumable, abandonable rendering |
| Render/commit split | Interruptible draft, atomic screen update |
| Lanes + Scheduler | Urgent input first; heavy work yields; no starvation |
| Batching | Many updates → one render |
| Suspense via throw | "Not ready" propagates to a boundary without `loading` props everywhere |
| Event delegation | Fewer listeners; React controls priority/propagation |
| Context re-renders consumers | Correctness first; precision is your job |
| Reconciler/renderer split | One algorithm, many platforms |

## 12. Master mental model
```
USER → EVENT (type → priority lane)
  → STATE / CONTEXT / STORE UPDATE (queued on hook with lane)
  → SCHEDULER (which lane first? yield every ~5ms?)
  → RENDER PHASE (pure, interruptible for transitions)
       beginWork → run component → new elements → reconcile (type+key) → flags
       completeWork → prepare DOM, bubble flags
  → COMMIT PHASE (synchronous, atomic): mutate DOM → swap current tree → layout effects + refs
  → BROWSER PAINT
  → PASSIVE EFFECTS (cleanups → setups; may set state) → loop
```
**Mastery shift:** from *"which Hook do I use?"* to *"who owns this data? what caused this render? which reference changed? what priority? what's the real bottleneck and can I prove the fix?"*

## Official docs / deep reading
- Render and commit: https://react.dev/learn/render-and-commit
- Rules of React: https://react.dev/reference/rules
- Suspense: https://react.dev/reference/react/Suspense
- React 18 release (concurrency, batching): https://react.dev/blog/2022/03/29/react-v18
- React 19: https://react.dev/blog/2024/12/05/react-19
- Server Components: https://react.dev/reference/rsc/server-components
- hydrateRoot: https://react.dev/reference/react-dom/client/hydrateRoot
- React Compiler: https://react.dev/learn/react-compiler
- Fiber architecture notes (Andrew Clark): https://github.com/acdlite/react-fiber-architecture
- React source: https://github.com/facebook/react (`packages/react-reconciler`, `packages/scheduler`)

## Takeaway · Mistake · Ask yourself
- **Takeaway:** render = pure description, commit = the only DOM write, scheduler decides when; plus reference equality explains almost everything.
- **Mistake:** saying "concurrent React makes everything faster". It makes *urgent* things stay responsive.
- **Ask:** *If React threw this render away and ran it twice, would my code still be correct?*
