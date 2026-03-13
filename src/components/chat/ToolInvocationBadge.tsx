import { Loader2 } from "lucide-react";
import type { ToolInvocation } from "ai";

interface ToolInvocationBadgeProps {
  tool: ToolInvocation;
}

function getFilename(path: unknown): string {
  if (!path || typeof path !== "string") return "";
  return path.split("/").filter(Boolean).pop() ?? "";
}

function getLabel(toolName: string, args: Record<string, unknown>): string {
  const filename = getFilename(args.path);

  if (toolName === "str_replace_editor") {
    switch (args.command) {
      case "create":
        return filename ? `Creating ${filename}` : "Creating file";
      case "str_replace":
      case "insert":
        return filename ? `Editing ${filename}` : "Editing file";
      case "view":
        return filename ? `Viewing ${filename}` : "Viewing file";
      default:
        return filename ? `Editing ${filename}` : "Editing file";
    }
  }

  if (toolName === "file_manager") {
    switch (args.command) {
      case "rename": {
        const newFilename = getFilename(args.new_path);
        return `Renaming ${filename || "file"} to ${newFilename || "new file"}`;
      }
      case "delete":
        return `Deleting ${filename || "file"}`;
      default:
        return "Managing files";
    }
  }

  return toolName;
}

export function ToolInvocationBadge({ tool }: ToolInvocationBadgeProps) {
  const label = getLabel(tool.toolName, tool.args as Record<string, unknown>);
  const isDone = tool.state === "result";

  return (
    <div className="inline-flex items-center gap-2 mt-2 px-3 py-1.5 bg-neutral-50 rounded-lg text-xs font-mono border border-neutral-200">
      {isDone ? (
        <div className="w-2 h-2 rounded-full bg-emerald-500" />
      ) : (
        <Loader2 className="w-3 h-3 animate-spin text-blue-600" />
      )}
      <span className="text-neutral-700">{label}</span>
    </div>
  );
}
