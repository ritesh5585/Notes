# React

## The core loop (everything in these notes is one arrow of this)

```
Event → State/Store update → (Scheduler) → Render (pure) → Reconcile → Commit (only DOM write) → Paint → Effects
```

---

## File map

| # | File | What's inside | Level |
|---|---|---|---|
| 01 | [docs/01-basics.md](./docs/01-basics.md) | Mental model, JSX, components, props, events, `useState`, rendering (trigger→render→commit), forms basics, mini todo | Junior |
| 02 | [docs/02-hooks.md](./docs/02-hooks.md) | Rules of Hooks (+why), `useState/Effect/Ref/Reducer/Memo/Callback/LayoutEffect/Id/Transition/DeferredValue/SyncExternalStore`, React 19 hooks, "you might not need an effect" | Junior → Mid |
| 03 | [docs/03-custom-hooks.md](./docs/03-custom-hooks.md) | Why custom hooks, design rules, 10+ snippets: `useToggle`, `useLocalStorage`, `useDebounce`, `useFetch`, `useClickOutside`, `useMediaQuery`, `useInterval`… | Mid |
| 04 | [docs/04-architecture-4-layer.md](./docs/04-architecture-4-layer.md) | **4-layer architecture** (UI → Hooks → Services → HTTP client), folder structure, full products feature, data ownership table | Mid → Senior |
| 05 | [docs/05-axios-and-data-fetching.md](./docs/05-axios-and-data-fetching.md) | fetch vs Axios, instance, interceptors, single-flight token refresh, cancellation, TanStack Query, optimistic updates, security | Mid → Senior |
| 06 | [docs/06-forms-react-hook-form.md](./docs/06-forms-react-hook-form.md) | RHF internals-lite, `register`, zod, `Controller`, `useFieldArray`, `useWatch`, `FormProvider`, server errors | Mid |
| 07 | [docs/07-context-api.md](./docs/07-context-api.md) | Prop drilling → composition → Context, production pattern, re-render rules, split contexts, auth/theme | Mid |
| 08 | [docs/08-zustand.md](./docs/08-zustand.md) | Store, selectors, `useShallow`, persist/devtools/immer, slices, outside-React usage, **Zustand in 20 lines**, Context vs Zustand | Mid → Senior |
| 09 | [docs/09-routing.md](./docs/09-routing.md) | React Router, nested/layout routes, URL state, protected routes, lazy routes | Mid |
| 10 | [docs/10-performance-optimization.md](./docs/10-performance-optimization.md) | Measure-first method, colocation, `memo`, virtualization, code splitting, **debounce vs throttle**, transitions, Web Vitals | Mid → Senior |
| 11 | [docs/11-bugs-and-debugging.md](./docs/11-bugs-and-debugging.md) | Symptom→Cause→Fix catalog, reference equality, re-render cheat sheet, debugging method | Mid → Senior |
| 12 | [docs/12-patterns-and-components.md](./docs/12-patterns-and-components.md) | Error boundaries, portals, refs, compound components, HOC, testing, TypeScript, a11y | Mid → Senior |
| 13 | [docs/13-senior-internals.md](./docs/13-senior-internals.md) | Fiber, double buffering, render/commit, hooks internals, lanes, scheduler, Suspense, hydration, RSC, Compiler, design "why" table | **Senior** |
| 14 | [docs/14-interview-bank.md](./docs/14-interview-bank.md) | Frequency map, Q&A by tier, senior scenarios, machine-coding checklist | All |
| 15 | [docs/15-snippets-muscle-memory.md](./docs/15-snippets-muscle-memory.md) | 30 timed drills + 7-day plan | All |

---

## Interview topic → where to study

| Interview topic | File |
|---|---|
| Props vs state, keys, controlled inputs, lifting state | 01 |
| Rules of hooks, useEffect deps/cleanup, useRef, useReducer | 02 |
| Custom hooks (why, examples) | 03 |
| Project structure, service layer, 4 layers | 04 |
| Axios, interceptors, auth refresh, TanStack Query | 05 |
| React Hook Form, validation | 06 |
| Context API, prop drilling | 07 |
| Zustand, Context vs store | 08 |
| React Router, protected routes | 09 |
| memo/useMemo/useCallback, debounce/throttle, lazy, virtualization | 10 |
| "Why is it re-rendering?", stale closures, infinite loops | 11 |
| Error boundary, portal, refs, HOC, testing, TS | 12 |
| Fiber, reconciliation, render vs commit, hooks internals, Suspense, SSR/hydration | 13 |
| Q&A drills, machine coding, system design | 14 |

---

## Folder structure

```
react-notes/
├── README.md                  ← you are here
└── docs/
    ├── 01-basics.md
    ├── 02-hooks.md
    ├── 03-custom-hooks.md
    ├── 04-architecture-4-layer.md
    ├── 05-axios-and-data-fetching.md
    ├── 06-forms-react-hook-form.md
    ├── 07-context-api.md
    ├── 08-zustand.md
    ├── 09-routing.md
    ├── 10-performance-optimization.md
    ├── 11-bugs-and-debugging.md
    ├── 12-patterns-and-components.md
    ├── 13-senior-internals.md
    ├── 14-interview-bank.md
    └── 15-snippets-muscle-memory.md
```

## Main official links
- React docs: https://react.dev · Reference: https://react.dev/reference/react · Rules: https://react.dev/reference/rules
- React Router: https://reactrouter.com · TanStack Query: https://tanstack.com/query/latest
- React Hook Form: https://react-hook-form.com · Zod: https://zod.dev
- Zustand: https://zustand.docs.pmnd.rs · Axios: https://axios-http.com
- Vite: https://vite.dev · Testing Library: https://testing-library.com

---

## Key takeaway · Common mistake · Question to ask yourself
- **Takeaway:** classify the data (UI / form / shared client / server / URL / derived) *before* choosing a tool, and measure before optimizing.
- **Mistake:** fixing symptoms (`useMemo`, `useEffect`, a store) without tracing which arrow of *event → state → render → commit* is wrong.
- **Ask:** *Who owns this data, what caused this render, and which reference changed?*
