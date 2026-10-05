import { AuthError, authorize } from "@/server/auth/dal";
import { buildTemplateWorkbook } from "@/server/import/export";

export async function GET() {
  try {
    await authorize("admin");
  } catch (error) {
    if (error instanceof AuthError) return new Response("Not found", { status: 404 });
    throw error;
  }
  return new Response(new Uint8Array(buildTemplateWorkbook()), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="taxkatha-case-law-template.xlsx"',
      "Cache-Control": "private, no-store",
    },
  });
}
