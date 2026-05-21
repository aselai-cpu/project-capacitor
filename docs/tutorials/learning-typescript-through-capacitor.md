# Learning TypeScript Through Project Capacitor

In this tutorial, we'll explore TypeScript by walking through a real production codebase — Project Capacitor, a full-stack Task Assignment application. By the end, you'll understand interfaces, union types, generics, recursive types, discriminated unions, runtime validation with Zod, and how TypeScript works across a backend (Express) and frontend (React).

We won't be building the app from scratch. Instead, we'll read existing code, understand what TypeScript is doing at each level, and modify small pieces to see the compiler catch our mistakes. This is how you'll learn TypeScript on the job — reading other people's code and understanding the type system's guardrails.

**Prerequisites:** Basic JavaScript knowledge. A code editor with TypeScript support (VS Code recommended). The Capacitor repo cloned locally.

**Time:** About 2 hours at a comfortable pace.

---

## Chapter 1: Interfaces — Describing the Shape of Data

Open `frontend/src/lib/types.ts`. This is the simplest TypeScript file in the project.

```typescript
export interface Skill {
  id: string;
  name: string;
}

export interface Developer {
  id: string;
  name: string;
  skills: Skill[];
}
```

An **interface** describes the shape of an object. `Skill` says: "any object that claims to be a Skill must have an `id` that's a string and a `name` that's a string." Nothing more, nothing less.

Notice that `Developer` has a `skills` property typed as `Skill[]` — an array of Skills. TypeScript interfaces compose naturally.

**Try it:** In your editor, hover over `skills` in the `Developer` interface. Your editor shows the full type. Now add a line somewhere in the frontend code:

```typescript
const broken: Developer = { id: '1', name: 'Alice' };
```

You'll see a red squiggle immediately — TypeScript tells you `skills` is missing. Delete the line when you're done. That's the value: **the compiler catches missing fields before the code ever runs.**

### Nullable types and union types

Look at the `Task` interface in the same file:

```typescript
export interface Task {
  id: string;
  title: string;
  status: 'TODO' | 'IN_PROGRESS' | 'DONE';
  parentId: string | null;
  depth: number;
  skills: Skill[];
  developer: Developer | null;
  createdAt: string;
}
```

Two new concepts here:

1. **String literal union:** `status: 'TODO' | 'IN_PROGRESS' | 'DONE'` means status can *only* be one of these three exact strings. Not `"todo"`, not `"pending"`, not any random string. The compiler enforces this everywhere status is used.

2. **Nullable type:** `developer: Developer | null` means this field is either a full Developer object or `null`. The `|` is a **union type** — "this OR that." When you access `task.developer.name`, TypeScript will warn you: developer might be null! You must check first.

**Try it:** Look at `frontend/src/components/TaskRow.tsx`. Find this line:

```typescript
value={task.developer?.id ?? ''}
```

The `?.` is optional chaining — if `developer` is null, it short-circuits to `undefined`. The `??` is the nullish coalescing operator — if the left side is `null` or `undefined`, use the right side. TypeScript forces you to handle the null case. Without these operators, the compiler would reject `task.developer.id` because developer could be null.

---

## Chapter 2: Recursive Types — Types That Reference Themselves

Open `frontend/src/lib/types.ts` again and look at `TaskFormState`:

```typescript
export interface TaskFormState {
  id: string;
  title: string;
  skillIds: string[];
  subtasks: TaskFormState[];
}
```

`subtasks` is typed as `TaskFormState[]` — an array of the same type we're defining! This is a **recursive type**. It models a tree: a task can have subtasks, and each subtask can have its own subtasks, infinitely deep.

Now open `backend/src/types.ts`:

```typescript
export interface CreateTaskInput {
  title: string;
  skillIds: string[];
  parentId: string | null;
  subtasks: CreateTaskInput[];
}
```

Same pattern on the backend. The API accepts a recursive JSON payload — a tree of tasks submitted in a single request.

### Recursive functions on recursive types

Open `frontend/src/utils/treeUtils.ts`:

```typescript
export function updateNodeInTree(
  node: TaskFormState,
  targetId: string,
  updater: (n: TaskFormState) => Partial<TaskFormState>
): TaskFormState {
  if (node.id === targetId) return { ...node, ...updater(node) };
  return {
    ...node,
    subtasks: node.subtasks.map(child => updateNodeInTree(child, targetId, updater)),
  };
}
```

This function walks a recursive type with a recursive function. It searches the tree for a node with `targetId`, applies the `updater`, and returns a new tree (immutable — the original isn't modified).

Notice the `updater` parameter: `(n: TaskFormState) => Partial<TaskFormState>`. This is a **callback function type**. `Partial<TaskFormState>` is a built-in TypeScript utility type that makes all fields optional. So the updater can return `{ title: 'new title' }` without providing `id`, `skillIds`, and `subtasks`.

**Try it:** In the backend, open `backend/src/services/taskUtils.ts` and find `collectNodesWithoutSkills`:

```typescript
export function collectNodesWithoutSkills(node: CreateTaskInput): CreateTaskInput[] {
  const result: CreateTaskInput[] = [];
  function collect(n: CreateTaskInput) {
    if (n.skillIds.length === 0) result.push(n);
    n.subtasks.forEach(collect);
  }
  collect(node);
  return result;
}
```

This walks the same recursive structure but collects nodes instead of transforming them. Notice the inner function `collect` — it's a closure that captures `result` from the outer scope. TypeScript types flow through closures naturally.

---

## Chapter 3: Generics — Functions That Work with Any Type

Open `frontend/src/lib/api.ts` and find the `handleResponse` function:

```typescript
async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new ApiError(response.status, body.error ?? `Request failed: ${response.status}`);
  }
  return response.json() as Promise<T>;
}
```

The `<T>` is a **generic type parameter**. It means: "I don't know what type the JSON response will be — the caller tells me." Look at how it's used:

```typescript
export const fetchTasks = (): Promise<Task[]> =>
  fetch(`${API}/api/tasks`).then(r => handleResponse<Task[]>(r));

export const fetchDevelopers = (): Promise<Developer[]> =>
  fetch(`${API}/api/developers`).then(r => handleResponse<Developer[]>(r));
```

When we call `handleResponse<Task[]>(r)`, we're telling TypeScript: "the JSON coming back is a `Task[]`." The function returns `Promise<Task[]>`, and the compiler knows `fetchTasks()` returns tasks, not developers.

One function, many types. That's generics — **write the logic once, let the type system specialize it for each call site.**

### Generics in middleware

Open `backend/src/middleware/validate.ts`:

```typescript
import { ZodType } from 'zod';

export function validate(schema: ZodType) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        error: 'Validation error',
        details: result.error.flatten(),
      });
    }
    req.body = result.data;
    next();
  };
}
```

`ZodType` is itself a generic — `ZodType<T>` where `T` is the output type after parsing. When we call `validate(createTaskSchema)`, Zod knows the schema produces `CreateTaskInput`, and `result.data` is typed as `CreateTaskInput`. The generic flows from the schema definition all the way to the request handler.

---

## Chapter 4: Interface Inheritance — Building Types Layer by Layer

Open `backend/src/services/taskUtils.ts` and look at the three interfaces:

```typescript
export interface TaskWithRelations {
  id: string;
  title: string;
  status: string;
  parentId: string | null;
  developerId: string | null;
  createdAt: Date;
  updatedAt: Date;
  skills: { id: string; name: string }[];
  developer: { id: string; name: string } | null;
}

export interface TaskWithDepth extends TaskWithRelations {
  depth: number;
}

export interface TaskTree extends TaskWithRelations {
  subtasks: TaskTree[];
}
```

`extends` means "everything in the parent, plus more." `TaskWithDepth` has all the fields of `TaskWithRelations` plus a `depth` number. `TaskTree` has all the fields plus a recursive `subtasks` array.

This is **interface inheritance**. It prevents repeating yourself — if you add a field to `TaskWithRelations`, both `TaskWithDepth` and `TaskTree` automatically get it.

Notice `TaskTree` is both inherited AND recursive — it extends `TaskWithRelations` and references itself. TypeScript handles this naturally.

**Try it:** Look at the function signatures in the same file:

```typescript
export function computeFlatListWithDepth(tasks: TaskWithRelations[]): TaskWithDepth[] {
```

The input is `TaskWithRelations[]` (no depth yet), the output is `TaskWithDepth[]` (depth added). The type signature tells you exactly what the function does without reading the implementation.

---

## Chapter 5: Discriminated Unions — The Pattern for Results

Open `backend/src/services/taskService.ts` and find the `UpdateResult` type:

```typescript
export type UpdateResult =
  | { success: true; data: any; status: 200 }
  | { success: false; error: string; status: 400 | 404 | 422; details?: unknown };
```

This is a **discriminated union** — a union of object types where one field (`success`) tells you which variant you have. When `success` is `true`, you know `data` exists. When `success` is `false`, you know `error` exists.

The power shows in the route handler. Open `backend/src/routes/tasks.ts` and find the PATCH handler:

```typescript
const result = await taskService.updateTask(req.params.id as string, req.body);
if (!result.success) {
  res.status(result.status).json({ error: result.error });
  return;
}
res.json(result.data);
```

After the `if (!result.success)` check, TypeScript **narrows** the type. Inside the if-block, it knows `result` is the failure variant — so `result.error` is available. After the if-block (or after the return), it knows `result` is the success variant — so `result.data` is available. The compiler proves you've handled both cases.

This is safer than returning a plain object with optional fields. With optional fields, you can forget to check for errors. With discriminated unions, the compiler won't let you access `result.data` until you've proven `success` is true.

---

## Chapter 6: Zod — Runtime Validation That Matches Your Types

TypeScript types only exist at compile time. They vanish when the code runs. So when a user sends a POST request with a JSON body, TypeScript can't check it — the data comes from the network, not from typed code.

Open `backend/src/types.ts`:

```typescript
export const createTaskSchema: z.ZodType<CreateTaskInput> = z.object({
  title: z.string().min(1),
  skillIds: z.array(z.string().uuid()).optional().default([]),
  parentId: z.string().uuid().nullable().optional().default(null),
  subtasks: z.lazy(() => z.array(createTaskSchema)).optional().default([]),
});
```

Zod is a runtime validation library. This schema says: "title must be a non-empty string, skillIds must be an array of UUID strings (defaulting to empty), and subtasks is a recursive array of the same schema."

The magic is `z.ZodType<CreateTaskInput>` — this links the Zod schema to the TypeScript interface. If the schema doesn't match the interface (e.g., you forget a field), the compiler errors. So your runtime validation and your compile-time types are always in sync.

Notice `z.lazy(() => z.array(createTaskSchema))` — this is how Zod handles recursive schemas. It delays evaluation to avoid infinite recursion during schema construction.

**Try it:** Look at `updateTaskSchema`:

```typescript
export const updateTaskSchema = z.object({
  status: z.enum(['TODO', 'IN_PROGRESS', 'DONE']).optional(),
  developerId: z.string().uuid().nullable().optional(),
});
```

`z.enum(['TODO', 'IN_PROGRESS', 'DONE'])` creates both a runtime check AND a TypeScript type. If someone sends `{ "status": "INVALID" }`, Zod rejects it at runtime. If you accidentally write `z.enum(['TODO', 'DONE'])` (forgetting IN_PROGRESS), TypeScript checks the mismatch.

---

## Chapter 7: Higher-Order Functions — Functions That Return Functions

Open `backend/src/middleware/asyncHandler.ts`:

```typescript
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}
```

This is a **higher-order function** — a function that takes a function as input and returns a new function. The input `fn` is an async Express handler. The output is a regular Express handler that catches any async errors.

The type annotation `(req: Request, res: Response, next: NextFunction) => Promise<void>` precisely describes the expected function signature. If you pass a function with the wrong parameters, TypeScript catches it.

Now look at `validate` again in `backend/src/middleware/validate.ts`:

```typescript
export function validate(schema: ZodType) {
  return (req: Request, res: Response, next: NextFunction) => {
    // ...
  };
}
```

Same pattern — a function that takes a schema and returns an Express middleware function. This is called a **middleware factory**. In Express, you use it like:

```typescript
router.post('/', validate(createTaskSchema), asyncHandler(async (req, res) => {
  // req.body is now validated and typed
}));
```

Two higher-order functions composed: `validate(schema)` returns middleware, `asyncHandler(fn)` wraps the handler. TypeScript types flow through both layers.

---

## Chapter 8: Custom Error Classes — Extending Built-in Types

Open `frontend/src/lib/api.ts` and look at `ApiError`:

```typescript
export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}
```

TypeScript classes can extend built-in JavaScript classes. `ApiError` extends `Error`, adding a `status` field. When you catch an error, you can check if it's an `ApiError` and access the HTTP status code:

```typescript
try {
  await updateTask(task.id, { status });
} catch (err) {
  if (err instanceof ApiError) {
    console.log(err.status); // TypeScript knows this exists
  }
}
```

`instanceof` acts as a **type guard** — after the check, TypeScript narrows the type from `unknown` to `ApiError`.

---

## Chapter 9: The Spread Operator and Conditional Properties

Open `backend/src/services/taskUtils.ts` and look at `toPrismaCreate`:

```typescript
export function toPrismaCreate(node: CreateTaskInput, isRoot = true): any {
  return {
    title: node.title,
    ...(isRoot && node.parentId ? { parent: { connect: { id: node.parentId } } } : {}),
    skills: node.skillIds.length > 0
      ? { connect: node.skillIds.map(id => ({ id })) }
      : undefined,
    subtasks: node.subtasks.length > 0
      ? { create: node.subtasks.map(child => toPrismaCreate(child, false)) }
      : undefined,
  };
}
```

The pattern `...(condition ? { key: value } : {})` conditionally adds a property to an object. If the condition is true, the object `{ parent: ... }` is spread into the result. If false, an empty object `{}` is spread (adding nothing).

This is a common TypeScript/JavaScript pattern for building objects where some fields are optional. The ternary operator `? :` combined with the spread operator `...` keeps the code concise.

---

## Chapter 10: `import type` — TypeScript's Module Discipline

Throughout the codebase, you'll see two kinds of imports:

```typescript
import { TaskStatus } from '@prisma/client';              // Value import
import type { CreateTaskInput } from '../types.js';        // Type-only import
```

`import type` tells TypeScript: "I only need this for type checking — don't include it in the compiled JavaScript." This matters because TypeScript types don't exist at runtime. If you import a type as a regular import, the compiled code might try to import something that doesn't exist.

This project uses `verbatimModuleSyntax: true` in tsconfig, which means TypeScript **enforces** that type-only imports use `import type`. If you forget, the compiler errors.

**The rule:** If you're importing something that's only used in type positions (function parameter types, return types, variable annotations), use `import type`. If you're importing something you call, instantiate, or reference at runtime, use regular `import`.

---

## Chapter 11: Putting It All Together — Reading a Full File

Let's read `frontend/src/utils/treeUtils.ts` as a complete example:

```typescript
import type { TaskFormState } from '../lib/types';

export function createEmptyNode(): TaskFormState {
  return { id: crypto.randomUUID(), title: '', skillIds: [], subtasks: [] };
}

export function updateNodeInTree(
  node: TaskFormState,
  targetId: string,
  updater: (n: TaskFormState) => Partial<TaskFormState>
): TaskFormState {
  if (node.id === targetId) return { ...node, ...updater(node) };
  return {
    ...node,
    subtasks: node.subtasks.map(child => updateNodeInTree(child, targetId, updater)),
  };
}
```

In 17 lines, this file demonstrates:
- `import type` (type-only import)
- Interface as a return type (`TaskFormState`)
- Factory function (`createEmptyNode`)
- Callback parameter type (`(n: TaskFormState) => Partial<TaskFormState>`)
- Built-in utility type (`Partial<T>`)
- Spread operator for immutable updates (`{ ...node, ...updater(node) }`)
- Recursive function on a recursive type
- Array `.map()` with typed callback

Every concept from this tutorial, in one small file. That's the power of TypeScript — these patterns compose together cleanly.

---

## What You've Learned

By reading real code from this project, you've encountered:

| Concept | Where you saw it |
|---------|-----------------|
| Interfaces | `frontend/src/lib/types.ts` — Skill, Developer, Task |
| Union types | `Task.status: 'TODO' \| 'IN_PROGRESS' \| 'DONE'` |
| Nullable types | `Task.developer: Developer \| null` |
| Recursive types | `TaskFormState.subtasks: TaskFormState[]` |
| Generics | `handleResponse<T>()` in `api.ts` |
| Interface inheritance | `TaskWithDepth extends TaskWithRelations` |
| Discriminated unions | `UpdateResult` in `taskService.ts` |
| Zod runtime validation | `createTaskSchema` in `types.ts` |
| Higher-order functions | `asyncHandler()`, `validate()` |
| Custom error classes | `ApiError extends Error` |
| Conditional spread | `...(condition ? { key: value } : {})` |
| `import type` | Used throughout for ESM module discipline |
| `Partial<T>` utility type | `updateNodeInTree` updater callback |

## Next Steps

Now that you understand the type patterns, explore these files to see how they connect:

1. **Follow the data flow:** Start at `frontend/src/lib/api.ts` → see what types it sends → follow to `backend/src/routes/tasks.ts` → see the validation → follow to `backend/src/services/taskService.ts` → see the business logic.

2. **Break something:** Change a type in `frontend/src/lib/types.ts` (e.g., rename `title` to `name`) and watch the compiler light up every file that depends on it. That's TypeScript's real value — refactoring confidence.

3. **Read the tests:** `backend/src/__tests__/taskUtils.test.ts` shows how to test typed code. Notice how the test helper `makeTask()` returns objects matching the `TaskWithRelations` interface.

4. **Read the DDD explanation:** `docs/concepts/domain-driven-design.md` explains *why* the types are structured this way — bounded contexts, aggregates, and invariants.
