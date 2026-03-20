import { getSession } from "@/lib/auth";
import type { FileNode } from "@/lib/file-system";
import { prisma } from "@/lib/prisma";
import JSZip from "jszip";

interface RouteContext {
  params: Promise<{ projectId: string }>;
}

export async function GET(_: Request, context: RouteContext) {
  const session = await getSession();
  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { projectId } = await context.params;
  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      userId: session.userId,
    },
    select: {
      name: true,
      data: true,
    },
  });

  if (!project) {
    return new Response("Project not found", { status: 404 });
  }

  let parsedData: Record<string, FileNode>;
  try {
    parsedData =
      typeof project.data === "string"
        ? (JSON.parse(project.data) as Record<string, FileNode>)
        : (project.data as Record<string, FileNode>);
  } catch {
    return new Response("Invalid project data", { status: 500 });
  }

  const zip = new JSZip();
  for (const [path, node] of Object.entries(parsedData)) {
    if (node.type !== "file") continue;
    if (!path || path === "/") continue;

    const zipPath = path.startsWith("/") ? path.slice(1) : path;
    if (!zipPath) continue;

    zip.file(zipPath, node.content || "");
  }

  const zipContent = await zip.generateAsync({ type: "uint8array" });
  const safeName = (project.name || "uigen-project")
    .replace(/[^a-z0-9-_]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  const filename = `${safeName || "uigen-project"}.zip`;

  return new Response(zipContent, {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
