import type { NextRequest } from "next/server";

import { AuthError, authorize } from "@/server/auth/dal";
import { pickPosts } from "@/server/queries/admin-posts";

/** Post picker for admin tools (embed a ruling, feature a post). Staff only. */
export async function GET(request: NextRequest) {
  try {
    await authorize("moderator");
  } catch (error) {
    if (error instanceof AuthError) return Response.json({ error: "Not allowed." }, { status: error.code === "unauthenticated" ? 401 : 403 });
    throw error;
  }

  const params = request.nextUrl.searchParams;
  const type = params.get("type");
  const results = await pickPosts(params.get("q") ?? "", { type: type === "case_law" || type === "insight" ? type : undefined });
  return Response.json({ results }, { headers: { "Cache-Control": "private, no-store" } });
}
