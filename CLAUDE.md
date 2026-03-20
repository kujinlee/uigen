# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Initial setup (install deps, generate Prisma client, run migrations)
npm run setup

# Development server (with Turbopack)
npm run dev

# Run all tests
npm test

# Run a single test file
npx vitest run src/lib/__tests__/file-system.test.ts

# Lint
npm run lint

# Build for production
npm run build

# Reset database
npm run db:reset
```

The app requires `ANTHROPIC_API_KEY` in `.env` to use real AI generation. Without it, a `MockLanguageModel` is used that returns static component code.

## Architecture

UIGen is a Next.js 15 App Router application where users describe React components in a chat interface, and Claude generates live-previewed code using a **virtual file system** (no files written to disk).

### Data Flow

1. User sends a message → `POST /api/chat` (`src/app/api/chat/route.ts`)
2. The API reconstructs a `VirtualFileSystem` from serialized file state sent with the request
3. `streamText` (Vercel AI SDK) runs Claude with two tools: `str_replace_editor` and `file_manager`
4. Tool calls stream back to the client → `ChatContext` (`src/lib/contexts/chat-context.tsx`) forwards them to `FileSystemContext`
5. `FileSystemContext` (`src/lib/contexts/file-system-context.tsx`) applies mutations to its in-memory `VirtualFileSystem`
6. `PreviewFrame` (`src/components/preview/PreviewFrame.tsx`) reacts to `refreshTrigger` and re-renders the iframe

### Virtual File System

`VirtualFileSystem` (`src/lib/file-system.ts`) is a tree-structured in-memory filesystem. It serializes to/from plain `Record<string, FileNode>` for transport (JSON over HTTP, JSON stored in Prisma `Project.data`).

The two AI tools that manipulate it:
- `str_replace_editor` (`src/lib/tools/str-replace.ts`): create/view/str_replace/insert commands
- `file_manager` (`src/lib/tools/file-manager.ts`): rename/delete commands

### Live Preview

`PreviewFrame` uses `@babel/standalone` (via `src/lib/transform/jsx-transformer.ts`) to transpile JSX/TSX files in-browser to blob URLs, then injects an ES module import map into an `<iframe srcdoc>`. Third-party npm packages are resolved via `https://esm.sh/`. The entry point defaults to `/App.jsx`.

### Auth & Persistence

- JWT sessions via `jose` stored in an `httpOnly` cookie (`src/lib/auth.ts`)
- Prisma + SQLite (`prisma/schema.prisma`) with two models: `User` and `Project`
- `Project.messages` and `Project.data` store JSON-serialized chat history and file system state
- Anonymous users can generate components; data is only persisted when signed in
- The `[projectId]` route (`src/app/[projectId]/page.tsx`) requires authentication and loads a saved project
- `src/middleware.ts` guards `/api/projects` and `/api/filesystem` routes — returns 401 if no session

### Server Actions

`src/actions/` contains Next.js Server Actions (not API routes):
- `src/actions/index.ts` — auth: `signUp`, `signIn`, `signOut`, `getUser`
- `src/actions/create-project.ts` / `get-project.ts` / `get-projects.ts` — project CRUD

### Anonymous Work Tracking

`src/lib/anon-work-tracker.ts` persists anonymous session work in `sessionStorage` so it can be saved to a project after the user signs in. It stores the full message history and file system snapshot.

### Key Contexts

Both contexts are provided at the top-level layout:
- `FileSystemProvider` — owns the `VirtualFileSystem` instance and exposes file CRUD + `handleToolCall`
- `ChatProvider` — wraps Vercel AI SDK's `useChat`, passing serialized file state on every request and routing tool calls into `FileSystemContext`

### Language Model

`src/lib/provider.ts` exports `getLanguageModel()`: returns `anthropic("claude-haiku-4-5")` when `ANTHROPIC_API_KEY` is set, otherwise a `MockLanguageModel` that streams static hardcoded component examples.

### UI Components

shadcn/ui components live in `src/components/ui/`. The main layout (`src/app/main-content.tsx`) uses `react-resizable-panels` to split the chat sidebar from a tabbed preview/code editor pane. Monaco Editor (`@monaco-editor/react`) powers the code view.

## Database

The database schema is defined in `prisma/schema.prisma`. Reference it anytime you need to understand the structure of data stored in the database.

## Code Style

- Use comments only for complex or non-obvious code. Do not add comments to self-explanatory code.

## Testing

Before writing tests, build a checklist from the source code:
- For every `if` → test the truthy and falsy branch
- For every `try/catch` → test success and each failure mode
- For paired/similar functions → mirror the same cases across both

Each function should have tests for:
- Happy path
- Missing/null/undefined input
- Invalid/malformed input
- Each error branch
- Type correctness of the return value
