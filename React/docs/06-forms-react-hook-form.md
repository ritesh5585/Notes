# 06 · Forms with React Hook Form (+ zod)

> **Prev ←** [05-axios-and-data-fetching](./05-axios-and-data-fetching.md) · **Next →** [07-context-api](./07-context-api.md)

## 1. Why a form library?
A controlled form re-renders the **whole form on every keystroke**, and you hand-write validation, touched/dirty flags, submit state, error mapping.

**React Hook Form (RHF)** registers inputs as **uncontrolled** (reads values through refs/DOM), subscribes only to the form state you use, so typing in a field doesn't re-render the form. Less code, fewer renders.

```
input ──register()──▶ RHF keeps value in its own store (not React state)
submit ──handleSubmit──▶ validate (resolver/zod) ──▶ valid? onSubmit(data) : errors → UI
```
```bash
npm i react-hook-form zod @hookform/resolvers
```

## 2. Smallest form
```jsx
import { useForm } from "react-hook-form";

export default function Login() {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = async (data) => { await authService.login(data); };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <input type="email" {...register("email", { required: "Email is required" })} />
      {errors.email && <p role="alert">{errors.email.message}</p>}

      <input type="password" {...register("password", { required: "Required", minLength: { value: 8, message: "Min 8 chars" } })} />
      {errors.password && <p role="alert">{errors.password.message}</p>}

      <button disabled={isSubmitting}>{isSubmitting ? "Signing in…" : "Sign in"}</button>
    </form>
  );
}
```
`register("name")` returns `{ name, onChange, onBlur, ref }`. Spread it onto the input.

## 3. With zod (schema = single source of truth)
```jsx
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const schema = z.object({
  email: z.string().min(1, "Email is required").email("Invalid email"),
  password: z.string().min(8, "Min 8 characters"),
  confirm: z.string(),
  age: z.coerce.number().min(18, "Must be 18+"),          // inputs give strings → coerce
}).refine((d) => d.password === d.confirm, {
  message: "Passwords don't match", path: ["confirm"],    // attach error to a field
});

// TypeScript: type FormValues = z.infer<typeof schema>;

export default function Register() {
  const { register, handleSubmit, setError, reset,
          formState: { errors, isSubmitting, isDirty, isValid } } = useForm({
    resolver: zodResolver(schema),
    mode: "onTouched",                                    // validate on blur, then on change
    defaultValues: { email: "", password: "", confirm: "", age: "" },
  });

  const onSubmit = async (values) => {
    try {
      await authService.register(values);
      reset();
    } catch (e) {
      // map SERVER errors onto fields (error shape from apiClient, see 05)
      e.fieldErrors
        ? Object.entries(e.fieldErrors).forEach(([name, message]) => setError(name, { type: "server", message }))
        : setError("root", { message: e.message });
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <Field label="Email" error={errors.email} {...register("email")} />
      <Field label="Password" type="password" error={errors.password} {...register("password")} />
      <Field label="Confirm" type="password" error={errors.confirm} {...register("confirm")} />
      <Field label="Age" type="number" error={errors.age} {...register("age")} />
      {errors.root && <p role="alert">{errors.root.message}</p>}
      <button disabled={isSubmitting}>Create account</button>
    </form>
  );
}

// Reusable field. React 19: ref arrives as a normal prop. (React ≤18: wrap in forwardRef)
function Field({ label, error, ref, ...rest }) {
  return (
    <label>
      {label}
      <input ref={ref} aria-invalid={!!error} {...rest} />
      {error && <span role="alert">{error.message}</span>}
    </label>
  );
}
```
Zod version note: `z.string().email()` works everywhere; newer zod also offers `z.email()`. Check https://zod.dev.

## 4. Validation modes
| `mode` | Validates on |
|---|---|
| `onSubmit` (default) | submit, then re-validates on change |
| `onBlur` | blur |
| `onChange` | every change (more re-renders) |
| `onTouched` | first blur, then every change (best UX default) |
| `all` | blur + change |

## 5. `Controller`: for controlled UI components (MUI, react-select, custom)
Third-party components don't expose a ref to an `<input>`. `Controller` bridges them.
```jsx
import { Controller } from "react-hook-form";

<Controller
  name="country"
  control={control}
  rules={{ required: "Pick a country" }}
  render={({ field, fieldState }) => (
    <Select {...field} options={countries} error={fieldState.error?.message} />
  )}
/>
```
`useForm()` gives you `control`. Native inputs → `register`. Custom/controlled → `Controller`.

## 6. Dynamic lists: `useFieldArray`
```jsx
import { useForm, useFieldArray } from "react-hook-form";

const { register, control, handleSubmit } = useForm({ defaultValues: { items: [{ name: "", qty: 1 }] } });
const { fields, append, remove } = useFieldArray({ control, name: "items" });

<form onSubmit={handleSubmit(console.log)}>
  {fields.map((f, i) => (
    <div key={f.id}>                                      {/* use f.id, NOT index */}
      <input {...register(`items.${i}.name`)} />
      <input type="number" {...register(`items.${i}.qty`, { valueAsNumber: true })} />
      <button type="button" onClick={() => remove(i)}>Remove</button>
    </div>
  ))}
  <button type="button" onClick={() => append({ name: "", qty: 1 })}>Add item</button>
  <button>Save</button>
</form>
```

## 7. Reading/changing values without re-rendering everything
| API | Use | Re-renders? |
|---|---|---|
| `getValues("email")` | read once (e.g., in a handler) | No |
| `watch("email")` | live value, in the same component that called `useForm` | Re-renders that component (whole form) |
| `useWatch({ control, name })` | live value in a **child** | Only that child |
| `setValue("email", "x", { shouldValidate: true })` | set programmatically | Only subscribers |
| `reset(values)` | reset form / load fetched data | Yes |
| `trigger("email")` | run validation manually | Updates errors |

Load async defaults: `useForm({ values: serverData })` (or `reset(serverData)` after fetch).

## 8. Big/nested forms: `FormProvider`
```jsx
const methods = useForm();
<FormProvider {...methods}>
  <form onSubmit={methods.handleSubmit(onSubmit)}><AddressFields /><PaymentFields /></form>
</FormProvider>

function AddressFields() {
  const { register, formState: { errors } } = useFormContext();   // no prop drilling
  return <input {...register("address.city")} />;
}
```
Multi-step checkout: one `useForm` at the top, steps are children, validate step fields with `trigger(["address.city", …])` before moving next, persist step in the URL.

## 9. formState: what to read
`errors · isSubmitting · isDirty · dirtyFields · touchedFields · isValid · isSubmitSuccessful · submitCount`
RHF uses a Proxy: **only the properties you read are subscribed**. Reading `isDirty` makes the form care about dirtiness; don't read what you don't render.

## 10. Common mistakes
- Using `register` on a controlled third-party input (value never updates) → `Controller`.
- Forgetting `defaultValues` → "uncontrolled to controlled" warnings, `reset()` doesn't know what to reset to.
- `useFieldArray` with `key={index}` → state jumps rows when removing. Use `field.id`.
- Number inputs return strings → `valueAsNumber` or `z.coerce.number()`.
- `watch()` at the top for one field → whole form re-renders; use `useWatch` in a child.
- Client validation is UX only. **Server validates again.**

## 11. Controlled vs RHF vs React 19 actions
| Approach | Pick when |
|---|---|
| Controlled `useState` | 1-3 fields, live dependent UI |
| **RHF + zod** | Real forms: validation, many fields, performance |
| `<form action={fn}>` + `useActionState` (React 19) | Framework/server-action flows, simple forms |

## Official docs
- React Hook Form: https://react-hook-form.com/get-started · API: https://react-hook-form.com/docs
- useForm: https://react-hook-form.com/docs/useform · Controller: https://react-hook-form.com/docs/usecontroller/controller
- useFieldArray: https://react-hook-form.com/docs/usefieldarray · useWatch: https://react-hook-form.com/docs/usewatch
- Resolvers: https://github.com/react-hook-form/resolvers
- Zod: https://zod.dev
- React forms (controlled inputs): https://react.dev/reference/react-dom/components/input

## Takeaway · Mistake · Ask yourself
- **Takeaway:** RHF keeps values outside React state, so you pay renders only for what you subscribe to.
- **Mistake:** treating RHF like controlled state (`watch` everywhere).
- **Ask:** *Which of these form values does the UI actually need to re-render for?*
