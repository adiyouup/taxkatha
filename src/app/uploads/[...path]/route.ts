import { readLocalUpload } from "@/server/storage";

/** Serves images stored on local disk in development. In production images live on Vercel Blob. */
export async function GET(_request: Request, context: RouteContext<"/uploads/[...path]">) {
  const { path } = await context.params;
  const file = await readLocalUpload(path);
  if (!file) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(file.bytes), {
    headers: {
      "Content-Type": file.type,
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
