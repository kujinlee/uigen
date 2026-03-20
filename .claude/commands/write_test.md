---
Write comprehensive tests for: $ARGUMENTS

- Use Vitest with React Testing Library
- Place test files in a `__tests__` directory in the same folder as the source file
- Name test files as `[filename].test.ts(x)`
- Use `@/` prefix for imports

Before writing tests, build a checklist from the source code:
- For every `if` → test the truthy and falsy branch
- For every `try/catch` → test success and each failure mode
- For paired/similar functions → mirror the same cases across both

Each function must have tests for:
- Happy path
- Missing/null/undefined input
- Invalid/malformed input
- Each error branch
- Type correctness of the return value

After writing tests, run them and fix any failures.
