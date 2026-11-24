# 07 · Context API

> **Prev ←** [06-forms](./06-forms-react-hook-form.md) · **Next →** [08-zustand](./08-zustand.md)

## 1. Problem: prop drilling
```
App → Layout → Sidebar → Menu → MenuItem     (only MenuItem needs `user`)
```
Layout, Sidebar, Menu carry `user` without using it. Rename a prop → edit 4 files.

**Fix ladder (cheapest first):** ① restructure with **composition (`children`)** → ② **Context** → ③ external store (Zustand, [08](./08-zustand.md)) or (Redux, [Click](../../Redux/README.md)).

```jsx
// Composition often solves "drilling" with ZERO context
<Layout sidebar={<Sidebar menu={<Menu item={<MenuItem user={user} />} />} />} />
```

## 2. Context = a tunnel
A Provider puts a value in; any descendant at any depth reads it directly.

```jsx
import { createContext, useContext, useState } from "react";

const ThemeContext = createContext("light");                 // 1. create (default = no Provider above)

function App() {
  const [theme, setTheme] = useState("light");
  return (
    {/* 2. provide (React 19: <ThemeContext value={…}>) */}
    <ThemeContext.Provider value={{ theme, setTheme }}>
      <Page />
    </ThemeContext.Provider>
  );
}

function ThemeButton() {
  const { theme, setTheme } = useContext(ThemeContext);      // 3. consume at any depth
  return <button onClick={() => setTheme(t => t === "light" ? "dark" : "light")}>{theme}</button>;
}
```

## 3. The production pattern (memorize this shape)
Provider component + custom hook with a guard + memoized value.

```jsx
// context/ThemeContext.jsx
import { createContext, useContext, useState, useMemo, useCallback, useEffect } from "react";

const ThemeContext = createContext(null);                    // null → forces Provider usage

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => localStorage.getItem("theme") ?? "light");

  useEffect(() => {
    document.documentElement.dataset.theme = theme;          // CSS variables switch on [data-theme]
    localStorage.setItem("theme", theme);
  }, [theme]);

  const toggle = useCallback(() => setTheme(t => (t === "light" ? "dark" : "light")), []);
  const value = useMemo(() => ({ theme, toggle }), [theme, toggle]);   // stable unless theme changes

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (ctx === null) throw new Error("useTheme must be used inside <ThemeProvider>");
  return ctx;
}
```
```jsx
// main.jsx
<ThemeProvider><App /></ThemeProvider>

// anywhere
const { theme, toggle } = useTheme();
```
**FOUC (flash of wrong theme):** reading localStorage in `useEffect` paints light first. Set `data-theme` from a tiny inline `<script>` in `index.html` `<head>` **before** React loads.

## 4. How re-rendering works with Context (the interview favourite)
- When the Provider's `value` is **not `Object.is`-equal** to the previous one, **every consumer re-renders**, even if it uses only part of the value, even if wrapped in `React.memo` (context bypasses props).
- `value={{ a, b }}` inline = new object every Provider render = all consumers re-render every time.

```jsx
// ❌ new object each render
<Ctx.Provider value={{ user, setUser }}>
// ✅ memoized
const value = useMemo(() => ({ user, setUser }), [user]);
```
**Splitting rules**
1. **Split by update frequency** (theme vs auth vs cart) so unrelated changes don't touch each other.
2. **Split state from dispatch:** dispatch never changes, so components that only *trigger* actions don't re-render on state changes.
3. Fast-changing / many-subscriber state → store with selectors ([08](./08-zustand.md)). Context has **no selectors**.

```jsx
const CartStateContext = createContext(null);
const CartDispatchContext = createContext(null);

function CartProvider({ children }) {
  const [cart, dispatch] = useReducer(cartReducer, []);
  return (
    <CartDispatchContext.Provider value={dispatch}>          {/* dispatch is stable */}
      <CartStateContext.Provider value={cart}>{children}</CartStateContext.Provider>
    </CartDispatchContext.Provider>
  );
}
export const useCart = () => useContext(CartStateContext);
export const useCartDispatch = () => useContext(CartDispatchContext);
```

## 5. `useReducer` + Context (Redux-lite, built in)
```jsx
function cartReducer(state, action) {
  switch (action.type) {
    case "add":    return [...state, action.item];
    case "remove": return state.filter(i => i.id !== action.id);
    case "clear":  return [];
    default: throw new Error(`Unknown action: ${action.type}`);
  }
}
// component: const dispatch = useCartDispatch(); dispatch({ type: "add", item });
```
Good for a **bounded subtree** (a wizard, a settings area). For app-wide frequently-changing state → Zustand.

## 6. Auth context (typical real use)
```jsx
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);          // unknown on first load (avoid redirect flash)

  useEffect(() => {
    const c = new AbortController();
    authService.me(c.signal)
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setIsLoading(false));
    return () => c.abort();
  }, []);

  const login = useCallback(async (creds) => setUser(await authService.login(creds)), []);
  const logout = useCallback(async () => { await authService.logout(); setUser(null); }, []);

  const value = useMemo(() => ({ user, isAuth: !!user, isLoading, login, logout }),
                        [user, isLoading, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
};
```
Note: Axios interceptors (outside React) can't call hooks. If the HTTP layer needs auth state, a **Zustand store** (`getState()`) is cleaner than Context.

## 7. When Context is the right / wrong tool
| Good for | Wrong for |
|---|---|
| Theme, locale, current user, feature flags, router-like config | Frequently changing state (typing, cursor, timers) |
| Dependency injection (pass a service/client down) | Large lists of items many components select from |
| State scoped to a subtree (wizard, form group) | Server data (use TanStack Query) |

**Context is a delivery mechanism, not a state manager.** `useState`/`useReducer` hold state; Context just ships it.

## 8. `use(Context)` and React 19
`use(Ctx)` can be called conditionally (after an early return), unlike `useContext`. `<Ctx value={…}>` replaces `<Ctx.Provider>`.

## 9. Interview Q&A
- **Why does Context re-render everything?** Consumers re-render whenever the Provider `value` reference changes; context propagation marks consumers for update regardless of props/`memo`. Memoize value, split contexts.
- **Context vs Redux/Zustand?** Context: no selectors, no middleware, no devtools, whole-value subscription. Stores add selector subscriptions and tooling.
- **Does `memo` block a context update?** No.
- **Default value of `createContext(x)`?** Used only when no Provider is above.

## Official docs
- Passing data deeply with Context: https://react.dev/learn/passing-data-deeply-with-context
- Scaling up with reducer + context: https://react.dev/learn/scaling-up-with-reducer-and-context
- useContext: https://react.dev/reference/react/useContext · createContext: https://react.dev/reference/react/createContext
- Before you use context (composition first): https://react.dev/learn/passing-data-deeply-with-context#before-you-use-context

## Takeaway · Mistake · Ask yourself
- **Takeaway:** Provider + guarded custom hook + memoized value + split by update frequency.
- **Mistake:** one giant `AppContext` with inline `value={{…}}`.
- **Ask:** *How often does this value change, and how many components read it?*
