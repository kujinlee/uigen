import { test, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { ToolInvocationBadge } from "../ToolInvocationBadge";
import type { ToolInvocation } from "ai";

afterEach(() => {
  cleanup();
});

function makeTool(
  toolName: string,
  args: Record<string, unknown>,
  state: "call" | "result" = "result"
): ToolInvocation {
  return {
    toolCallId: "test-id",
    toolName,
    args,
    state,
    ...(state === "result" ? { result: "ok" } : {}),
  } as ToolInvocation;
}

test("shows 'Creating' label for str_replace_editor create command", () => {
  render(
    <ToolInvocationBadge
      tool={makeTool("str_replace_editor", { command: "create", path: "/src/components/Card.tsx" })}
    />
  );
  expect(screen.getByText("Creating Card.tsx")).toBeDefined();
});

test("shows 'Editing' label for str_replace_editor str_replace command", () => {
  render(
    <ToolInvocationBadge
      tool={makeTool("str_replace_editor", { command: "str_replace", path: "/src/App.jsx" })}
    />
  );
  expect(screen.getByText("Editing App.jsx")).toBeDefined();
});

test("shows 'Editing' label for str_replace_editor insert command", () => {
  render(
    <ToolInvocationBadge
      tool={makeTool("str_replace_editor", { command: "insert", path: "/src/App.jsx" })}
    />
  );
  expect(screen.getByText("Editing App.jsx")).toBeDefined();
});

test("shows 'Viewing' label for str_replace_editor view command", () => {
  render(
    <ToolInvocationBadge
      tool={makeTool("str_replace_editor", { command: "view", path: "/src/App.jsx" })}
    />
  );
  expect(screen.getByText("Viewing App.jsx")).toBeDefined();
});

test("shows fallback label when no path provided", () => {
  render(
    <ToolInvocationBadge
      tool={makeTool("str_replace_editor", { command: "create" })}
    />
  );
  expect(screen.getByText("Creating file")).toBeDefined();
});

test("shows 'Renaming' label for file_manager rename command", () => {
  render(
    <ToolInvocationBadge
      tool={makeTool("file_manager", {
        command: "rename",
        path: "/src/Old.tsx",
        new_path: "/src/New.tsx",
      })}
    />
  );
  expect(screen.getByText("Renaming Old.tsx to New.tsx")).toBeDefined();
});

test("shows 'Deleting' label for file_manager delete command", () => {
  render(
    <ToolInvocationBadge
      tool={makeTool("file_manager", { command: "delete", path: "/src/Unused.tsx" })}
    />
  );
  expect(screen.getByText("Deleting Unused.tsx")).toBeDefined();
});

test("shows green dot when tool state is result", () => {
  const { container } = render(
    <ToolInvocationBadge
      tool={makeTool("str_replace_editor", { command: "create", path: "/App.jsx" }, "result")}
    />
  );
  expect(container.querySelector(".bg-emerald-500")).toBeDefined();
});

test("shows spinner when tool state is call", () => {
  const { container } = render(
    <ToolInvocationBadge
      tool={makeTool("str_replace_editor", { command: "create", path: "/App.jsx" }, "call")}
    />
  );
  expect(container.querySelector(".animate-spin")).toBeDefined();
});

test("falls back to toolName for unknown tools", () => {
  render(
    <ToolInvocationBadge
      tool={makeTool("unknown_tool", {})}
    />
  );
  expect(screen.getByText("unknown_tool")).toBeDefined();
});
