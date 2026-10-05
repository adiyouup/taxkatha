import { writeAudit } from "@/server/audit";
import { AuthError, authorize } from "@/server/auth/dal";
import { db } from "@/server/db";
import { listOptedInMembers } from "@/server/queries/admin-users";

/** A cell for CSV, quoted, and defused so a spreadsheet never runs it as a formula. */
function cell(value: unknown): string {
  let text = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

/**
 * Members who opted in to marketing email (name, email, profession, joined,
 * source). Personal data: admins only, and every download is audited.
 */
export async function GET() {
  let viewer;
  try {
    viewer = await authorize("admin");
  } catch (error) {
    if (error instanceof AuthError) return new Response("Not found", { status: 404 });
    throw error;
  }

  const members = await listOptedInMembers();
  const lines = [
    ["Name", "Email", "Profession", "Joined", "Source", "Campaign"].map(cell).join(","),
    ...members.map((m) => [m.name, m.email, m.profession, new Date(m.created_at).toISOString().slice(0, 10), m.utm_source, m.utm_campaign].map(cell).join(",")),
  ];
  await writeAudit(db, {
    actorId: viewer.id,
    action: "user.export",
    entityType: "user",
    summary: `Downloaded the email list of ${members.length} opted-in members`,
  });

  const stamp = new Date().toISOString().slice(0, 10);
  // A byte-order mark so Excel reads the file as UTF-8 (names in Indian scripts survive).
  return new Response(`﻿${lines.join("\r\n")}\r\n`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="taxkatha-opted-in-members-${stamp}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
