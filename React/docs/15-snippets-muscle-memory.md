# 15 · Snippets for Muscle Memory

> **Prev ←** [14-interview-bank](./14-interview-bank.md) · **Back to** [README](../README.md)

## How to build muscle memory (this actually works)
1. **Read** the snippet once, say aloud *what problem it solves*.
2. **Type** it while looking.
3. **Delete**, type it **blind**. Check diffs.
4. **Timed:** retype in under the target time. Next day repeat only the ones you missed.
5. **Mutate:** change one requirement (add debounce, add error state) and re-type.
Repeat across 7 days (plan at the bottom). Typing with understanding beats copying.

Each drill: target time in brackets.

---

### 1. Counter, functional update [2 min]
```jsx
const [count, setCount] = useState(0);
<button onClick={() => setCount(c => c + 1)}>{count}</button>
```

### 2. Controlled input + derived filter [3 min]
```jsx
const [q, setQ] = useState("");
const filtered = items.filter(i => i.name.toLowerCase().includes(q.toLowerCase()));   // derived, not stored
<input value={q} onChange={e => setQ(e.target.value)} />
{filtered.map(i => <li key={i.id}>{i.name}</li>)}
```

### 3. Immutable array updates [2 min]
```jsx
setItems(p => [...p, item]);
setItems(p => p.filter(i => i.id !== id));
setItems(p => p.map(i => i.id === id ? { ...i, done: !i.done } : i));
setUser(u => ({ ...u, address: { ...u.address, city } }));
```

### 4. Fetch in effect with abort [4 min]
```jsx
useEffect(() => {
  const c = new AbortController();
  setStatus("loading");
  fetch(`/api/items?q=${encodeURIComponent(q)}`, { signal: c.signal })
    .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(d => { setData(d); setStatus("success"); })
    .catch(e => { if (e.name !== "AbortError") setStatus("error"); });
  return () => c.abort();
}, [q]);
```

### 5. Event listener with cleanup [2 min]
```jsx
useEffect(() => {
  const h = (e) => e.key === "Escape" && onClose();
  window.addEventListener("keydown", h);
  return () => window.removeEventListener("keydown", h);
}, [onClose]);
```

### 6. useDebounce [2 min]
```jsx
function useDebounce(value, delay = 300) {
  const [v, setV] = useState(value);
  useEffect(() => { const id = setTimeout(() => setV(value), delay); return () => clearTimeout(id); }, [value, delay]);
  return v;
}
```

### 7. debounce + throttle (plain JS) [4 min]
```js
const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
const throttle = (fn, ms) => { let last = 0; return (...a) => { const n = Date.now(); if (n - last >= ms) { last = n; fn(...a); } }; };
```

### 8. useLocalStorage [3 min]
```jsx
function useLocalStorage(key, init) {
  const [v, setV] = useState(() => { try { const r = localStorage.getItem(key); return r ? JSON.parse(r) : init; } catch { return init; } });
  useEffect(() => { try { localStorage.setItem(key, JSON.stringify(v)); } catch {} }, [key, v]);
  return [v, setV];
}
```

### 9. useReducer cart [4 min]
```jsx
function reducer(s, a) {
  switch (a.type) {
    case "add": return s.some(i => i.id === a.item.id)
      ? s.map(i => i.id === a.item.id ? { ...i, qty: i.qty + 1 } : i)
      : [...s, { ...a.item, qty: 1 }];
    case "remove": return s.filter(i => i.id !== a.id);
    default: throw new Error(a.type);
  }
}
const [cart, dispatch] = useReducer(reducer, []);
```

### 10. Context provider + guarded hook [4 min]
```jsx
const Ctx = createContext(null);
export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState("light");
  const toggle = useCallback(() => setTheme(t => t === "light" ? "dark" : "light"), []);
  const value = useMemo(() => ({ theme, toggle }), [theme, toggle]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
export const useTheme = () => { const c = useContext(Ctx); if (!c) throw new Error("Wrap in ThemeProvider"); return c; };
```

### 11. Zustand store + selector [3 min]
```jsx
const useCart = create((set) => ({
  items: [],
  add: (p) => set(s => ({ items: [...s.items, p] })),
  clear: () => set({ items: [] }),
}));
const count = useCart(s => s.items.length);
const add = useCart(s => s.add);
```

### 12. Zustand persist + devtools [3 min]
```jsx
import { persist, devtools } from "zustand/middleware";
export const useAuth = create(devtools(persist(
  (set) => ({ user: null, login: (user) => set({ user }), logout: () => set({ user: null }) }),
  { name: "auth", partialize: (s) => ({ user: s.user }) }
)));
```

### 13. Axios instance + interceptors [5 min]
```js
export const api = axios.create({ baseURL: import.meta.env.VITE_API_URL, timeout: 10000, withCredentials: true });
api.interceptors.request.use(cfg => { const t = useAuth.getState().token; if (t) cfg.headers.Authorization = `Bearer ${t}`; return cfg; });
api.interceptors.response.use(r => r, err => Promise.reject({ status: err.response?.status, message: err.response?.data?.message ?? err.message }));
```

### 14. Service layer [2 min]
```js
export const productService = {
  list: (params, signal) => api.get("/products", { params, signal }).then(r => r.data),
  get: (id) => api.get(`/products/${id}`).then(r => r.data),
};
```

### 15. TanStack Query read + mutate [4 min]
```jsx
const { data, isPending, isError } = useQuery({ queryKey: ["products", q], queryFn: ({ signal }) => productService.list({ q }, signal) });
const qc = useQueryClient();
const m = useMutation({ mutationFn: cartService.add, onSuccess: () => qc.invalidateQueries({ queryKey: ["cart"] }) });
```

### 16. React Hook Form + zod [5 min]
```jsx
const schema = z.object({ email: z.string().email(), password: z.string().min(8) });
const { register, handleSubmit, formState: { errors, isSubmitting } } =
  useForm({ resolver: zodResolver(schema), defaultValues: { email: "", password: "" } });

<form onSubmit={handleSubmit(onSubmit)}>
  <input {...register("email")} />{errors.email && <p>{errors.email.message}</p>}
  <input type="password" {...register("password")} />{errors.password && <p>{errors.password.message}</p>}
  <button disabled={isSubmitting}>Login</button>
</form>
```

### 17. useFieldArray [3 min]
```jsx
const { fields, append, remove } = useFieldArray({ control, name: "items" });
{fields.map((f, i) => <input key={f.id} {...register(`items.${i}.name`)} />)}
<button type="button" onClick={() => append({ name: "" })}>Add</button>
```

### 18. Protected route [3 min]
```jsx
function Protected() {
  const { isAuth, isLoading } = useAuth(); const loc = useLocation();
  if (isLoading) return <Loader />;
  return isAuth ? <Outlet /> : <Navigate to="/login" state={{ from: loc }} replace />;
}
```

### 19. Search params [2 min]
```jsx
const [p, setP] = useSearchParams();
const q = p.get("q") ?? ""; const page = Number(p.get("page") ?? 1);
setP({ q: value, page: 1 });
```

### 20. lazy + Suspense [2 min]
```jsx
const Checkout = lazy(() => import("./Checkout"));
<Suspense fallback={<Spinner />}><Checkout /></Suspense>
```

### 21. memo + useCallback + stable props [3 min]
```jsx
const Row = memo(function Row({ item, onSelect }) { return <li onClick={() => onSelect(item.id)}>{item.name}</li>; });
const onSelect = useCallback((id) => setSelected(id), []);
{items.map(i => <Row key={i.id} item={i} onSelect={onSelect} />)}
```

### 22. useTransition search [3 min]
```jsx
const [isPending, startTransition] = useTransition();
const onChange = (e) => { setQuery(e.target.value); startTransition(() => setFilter(e.target.value)); };
```

### 23. Click outside [3 min]
```jsx
function useClickOutside(ref, fn) {
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) fn(); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [ref, fn]);
}
```

### 24. Infinite scroll sentinel [4 min]
```jsx
const sentinel = useRef(null);
useEffect(() => {
  const io = new IntersectionObserver(([e]) => e.isIntersecting && hasNext && fetchNext(), { rootMargin: "200px" });
  if (sentinel.current) io.observe(sentinel.current);
  return () => io.disconnect();
}, [hasNext, fetchNext]);
<div ref={sentinel} />
```

### 25. Modal with portal [4 min]
```jsx
function Modal({ open, onClose, children }) {
  if (!open) return null;
  return createPortal(
    <div className="backdrop" onClick={onClose}>
      <div role="dialog" aria-modal="true" onClick={e => e.stopPropagation()}>{children}</div>
    </div>, document.body);
}
```

### 26. Error boundary [3 min]
```jsx
class ErrorBoundary extends React.Component {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(err, info) { console.error(err, info); }
  render() { return this.state.hasError ? <p>Something went wrong</p> : this.props.children; }
}
```

### 27. Interval with latest callback [3 min]
```jsx
function useInterval(cb, delay) {
  const saved = useRef(cb);
  useEffect(() => { saved.current = cb; });
  useEffect(() => { if (delay == null) return; const id = setInterval(() => saved.current(), delay); return () => clearInterval(id); }, [delay]);
}
```

### 28. Autocomplete (combo drill) [10 min]
Controlled input + `useDebounce` + `useQuery` with abort + keyboard (↑ ↓ Enter Esc) + `aria-activedescendant` + loading/empty states.

### 29. Mini Zustand (internals drill) [5 min]
```jsx
function createStore(init) {
  let state; const ls = new Set();
  const setState = (p) => { const n = typeof p === "function" ? p(state) : p; if (!Object.is(n, state)) { state = { ...state, ...n }; ls.forEach(l => l()); } };
  const getState = () => state; const subscribe = (l) => (ls.add(l), () => ls.delete(l));
  state = init(setState, getState); return { getState, setState, subscribe };
}
const useStore = (s, sel = x => x) => useSyncExternalStore(s.subscribe, () => sel(s.getState()));
```

### 30. Toy `useState` (internals drill) [4 min]
```js
let hooks = [], i = 0;
function useState(init) { const idx = i; if (hooks[idx] === undefined) hooks[idx] = init;
  const set = (v) => { hooks[idx] = typeof v === "function" ? v(hooks[idx]) : v; rerender(); }; i++; return [hooks[idx], set]; }
```

---

## 7-day plan (45 min/day)
| Day | Drills | Also read |
|---|---|---|
| 1 | 1-5 | [01](./01-basics.md), [02](./02-hooks.md) |
| 2 | 6-8, 23, 27 | [03](./03-custom-hooks.md) |
| 3 | 13-15 | [04](./04-architecture-4-layer.md), [05](./05-axios-and-data-fetching.md) |
| 4 | 16-17, 18-19 | [06](./06-forms-react-hook-form.md), [09](./09-routing.md) |
| 5 | 9-12 | [07](./07-context-api.md), [08](./08-zustand.md) |
| 6 | 20-22, 24-26 | [10](./10-performance-optimization.md), [11](./11-bugs-and-debugging.md), [12](./12-patterns-and-components.md) |
| 7 | 28-30 + mock interview | [13](./13-senior-internals.md), [14](./14-interview-bank.md) |

## Takeaway · Mistake · Ask yourself
- **Takeaway:** fluent recall of ~30 small patterns covers most machine-coding rounds.
- **Mistake:** re-reading snippets instead of typing them blind.
- **Ask:** *Can I type this without looking, and explain every line's reason?*
