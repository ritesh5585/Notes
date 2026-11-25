# 12 · Patterns, Error Boundaries, Portals, Refs, Testing, TypeScript

> **Prev ←** [11-bugs-and-debugging](./11-bugs-and-debugging.md) · **Next →** [13-senior-internals](./13-senior-internals.md)

## 1. Error Boundaries
Catch **render-time** errors in children and show a fallback instead of a blank app.
```jsx
class ErrorBoundary extends React.Component {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }          // switch to fallback UI
  componentDidCatch(error, info) { logToService(error, info.componentStack); } // side effect: report
  reset = () => this.setState({ hasError: false });
  render() { return this.state.hasError ? this.props.fallback(this.reset) : this.props.children; }
}
<ErrorBoundary fallback={(reset) => <button onClick={reset}>Retry</button>}><Widget /></ErrorBoundary>
```
- **Catches:** errors thrown during render, lifecycle, constructors of children.
- **Does NOT catch:** event handlers, async code (promises/setTimeout), SSR, errors in the boundary itself → use `try/catch`.
- Practice: several small boundaries (per route/widget), reset mechanism (key change / `resetErrorBoundary`), log to a service.
- Function-style API: `react-error-boundary` (`<ErrorBoundary FallbackComponent onReset resetKeys>`).
- React 19: root options `onCaughtError`, `onUncaughtError`.

## 2. Portals (modal, tooltip, dropdown)
Render into a different DOM node while staying in the **same React tree** (context, state, and synthetic events bubble through the React tree, not the DOM tree).
```jsx
import { createPortal } from "react-dom";

function Modal({ open, onClose, children }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [open, onClose]);

  if (!open) return null;
  return createPortal(
    <div className="backdrop" onClick={onClose}>
      <div role="dialog" aria-modal="true" onClick={e => e.stopPropagation()}>{children}</div>
    </div>,
    document.body
  );
}
```
Why: escape `overflow:hidden`, `z-index` stacking contexts, `transform` ancestors. Modal a11y: focus trap, `aria-modal`, return focus on close (or use a headless library: Radix, React Aria).

## 3. Refs
| Thing | Meaning |
|---|---|
| `useRef(init)` | One `{ current }` object that persists for the component's life |
| `createRef()` | New object each call → for class components; wrong in function components |
| Callback ref | `ref={node => …}` called with node on attach, `null` on detach |
| `forwardRef` | (≤18) pass a parent's `ref` through to an inner DOM node |
| `ref` as a prop | **React 19+**: function components receive `ref` directly; no `forwardRef` |
| `useImperativeHandle` | Expose a **limited API** instead of the raw node |

```jsx
// React 19
function TextField({ ref, ...props }) { return <input ref={ref} {...props} />; }
// React 18
const TextField = forwardRef((props, ref) => <input ref={ref} {...props} />);

// limited API
function Player({ ref }) {
  const video = useRef();
  useImperativeHandle(ref, () => ({ play: () => video.current.play(), pause: () => video.current.pause() }));
  return <video ref={video} />;
}
```
`ref.current` is `null` during first render (attached in commit's layout step). Don't read/write refs during render.

## 4. Composition patterns

### Compound components (Tabs, Accordion, Select)
```jsx
const TabsCtx = createContext(null);
function Tabs({ defaultValue, children }) {
  const [value, setValue] = useState(defaultValue);
  const ctx = useMemo(() => ({ value, setValue }), [value]);
  return <TabsCtx.Provider value={ctx}>{children}</TabsCtx.Provider>;
}
Tabs.List = ({ children }) => <div role="tablist">{children}</div>;
Tabs.Tab = ({ value, children }) => {
  const { value: active, setValue } = useContext(TabsCtx);
  return <button role="tab" aria-selected={active === value} onClick={() => setValue(value)}>{children}</button>;
};
Tabs.Panel = ({ value, children }) => useContext(TabsCtx).value === value ? <div role="tabpanel">{children}</div> : null;

// <Tabs defaultValue="a"><Tabs.List><Tabs.Tab value="a">A</Tabs.Tab></Tabs.List><Tabs.Panel value="a">…</Tabs.Panel></Tabs>
```
Flexible API, implicit shared state, consumer controls layout.

### Render props / children as function
```jsx
function Toggle({ children }) { const [on, setOn] = useState(false); return children({ on, toggle: () => setOn(o => !o) }); }
<Toggle>{({ on, toggle }) => <button onClick={toggle}>{on ? "ON" : "OFF"}</button>}</Toggle>
```
Mostly replaced by custom hooks; still useful for headless components.

### HOC (higher-order component)
```jsx
const withAuth = (Component) => (props) => {
  const { isAuth } = useAuth();
  return isAuth ? <Component {...props} /> : <Navigate to="/login" />;
};
const ProtectedDashboard = withAuth(Dashboard);
```
Mostly replaced by hooks/layout routes. Pitfalls: wrapper hell, prop collisions, don't create HOCs inside render (new type each render), hoist statics, forward refs.

### Controlled vs uncontrolled component APIs
Support both when building a library component: `value/onChange` (controlled) and `defaultValue` (uncontrolled).

### Polymorphic / slot props
`<Button as={Link} to="/x">` or `asChild` (Radix) so styling is reusable across elements.

### Composition over configuration
Prefer `<Card><Card.Header/>…</Card>` over `<Card header=… footer=… actions=… variant=… />` with 20 props.

## 5. Testing (Vitest/Jest + Testing Library)
Test **behavior the user sees**, not implementation.
```jsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

test("adds a todo", async () => {
  const user = userEvent.setup();
  render(<Todos />);

  await user.type(screen.getByRole("textbox"), "Buy milk");
  await user.click(screen.getByRole("button", { name: /add/i }));

  expect(screen.getByText("Buy milk")).toBeInTheDocument();
});

test("loads products", async () => {
  render(<ProductsPage />, { wrapper: AppProviders });       // QueryClientProvider, Router…
  expect(await screen.findByText(/headphones/i)).toBeInTheDocument();   // findBy* waits
});
```
- Query by **role/label/text** (`getByRole`, `getByLabelText`), not CSS classes or state.
- `userEvent` > `fireEvent`. `findBy*`/`waitFor` for async.
- Mock the **network** (MSW), not your own modules.
- Hooks: `renderHook(() => useDebounce(v, 300))` + fake timers (`vi.useFakeTimers()`).
- Don't snapshot-test everything; don't assert on internal state.

## 6. TypeScript with React (essentials)
```tsx
type Props = { title: string; price: number; onAdd?: (id: string) => void; children?: React.ReactNode };
function ProductCard({ title, price, onAdd }: Props) { /* … */ }          // avoid React.FC unless you want its implicit behavior

const [user, setUser] = useState<User | null>(null);                      // annotate when initial can't infer
const ref = useRef<HTMLInputElement>(null);
const onChange = (e: React.ChangeEvent<HTMLInputElement>) => setText(e.target.value);

// discriminated unions: impossible states become unrepresentable
type State =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; data: Product[] }
  | { status: "error"; error: string };

type Action = { type: "add"; item: Item } | { type: "remove"; id: string };   // reducer actions

// generics for reusable components
function List<T>({ items, render }: { items: T[]; render: (item: T) => React.ReactNode }) {
  return <ul>{items.map((i, idx) => <li key={idx}>{render(i)}</li>)}</ul>;
}
```
Rules: avoid `any` → `unknown` + narrowing at API boundaries; infer types from schemas (`z.infer<typeof schema>`); type your Axios responses in services; `ComponentProps<"button">` to extend native props.

## 7. Accessibility (interview-grade basics)
Semantic HTML first (`button`, not clickable `div`), labels on inputs (`htmlFor`/`useId`), keyboard support, focus management in modals/route changes, `aria-live` for toasts, color contrast, `alt` text. Test with keyboard + screen reader.

## 8. Toast system (portal + store + timers)
```jsx
// store: push/dismiss
const useToasts = create((set) => ({
  toasts: [],
  notify: (msg) => { const id = crypto.randomUUID(); set(s => ({ toasts: [...s.toasts, { id, msg }] })); setTimeout(() => useToasts.getState().dismiss(id), 3000); },
  dismiss: (id) => set(s => ({ toasts: s.toasts.filter(t => t.id !== id) })),
}));
// <ToastContainer/> uses createPortal(…, document.body), key={t.id}, aria-live="polite"
```

## Official docs
- Error boundaries: https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary · react-error-boundary: https://github.com/bvaughn/react-error-boundary
- createPortal: https://react.dev/reference/react-dom/createPortal
- Manipulating the DOM with refs: https://react.dev/learn/manipulating-the-dom-with-refs · useImperativeHandle: https://react.dev/reference/react/useImperativeHandle
- Testing Library: https://testing-library.com/docs/react-testing-library/intro/ · Vitest: https://vitest.dev
- TypeScript + React: https://react.dev/learn/typescript · Cheatsheet: https://react-typescript-cheatsheet.netlify.app
- Radix primitives (a11y patterns): https://www.radix-ui.com/primitives
- MSW: https://mswjs.io

## Takeaway · Mistake · Ask yourself
- **Takeaway:** boundaries isolate failures, portals escape layout, composition beats configuration.
- **Mistake:** expecting error boundaries to catch event-handler or async errors.
- **Ask:** *What should the user see when this piece breaks, and can the rest of the page survive?*
