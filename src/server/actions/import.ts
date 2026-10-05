"use server";

import "server-only";

import { and, eq, inArray } from "drizzle-orm";
import { updateTag } from "next/cache";
import { redirect } from "next/navigation";
import * as z from "zod";

import { fail, ok, type ActionResult } from "@/lib/action-result";
import { writeAudit } from "@/server/audit";
import { AuthError, authorize } from "@/server/auth/dal";
import { guard } from "@/server/auth/guard";
import { postTag, TAGS } from "@/server/cache-tags";
import { db } from "@/server/db";
import { importBatchRows, importBatches, posts } from "@/server/db/schema";
import { ImportFileError, MAX_FILE_BYTES } from "@/server/import/parse";
import { commitImportBatch, createImportPreview, discardImportBatch, ImportStateError } from "@/server/import/store";

export type ImportFormState = { error: string | null };

const ALLOWED_EXTENSIONS = /\.(xlsx|xls|csv)$/i;

function authMessage(error: AuthError) {
  return error.code === "unauthenticated" ? "Your session has expired. Please sign in again." : "Only administrators can import case laws.";
}

/** Step 1: read the uploaded workbook and store a preview. Nothing is published. */
export async function previewImport(_prev: ImportFormState, formData: FormData): Promise<ImportFormState> {
  let batchId: string;
  try {
    const viewer = await authorize("admin");

    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) return { error: "Choose a spreadsheet to upload." };
    if (!ALLOWED_EXTENSIONS.test(file.name)) return { error: "Upload an .xlsx, .xls or .csv file." };
    if (file.size > MAX_FILE_BYTES) {
      return { error: `That file is ${(file.size / 1024 / 1024).toFixed(1)} MB. The limit is ${MAX_FILE_BYTES / 1024 / 1024} MB — split it into smaller files.` };
    }

    const preview = await createImportPreview({
      buffer: Buffer.from(await file.arrayBuffer()),
      filename: file.name,
      uploadedBy: viewer.id,
    });
    batchId = preview.batchId;
  } catch (error) {
    if (error instanceof AuthError) return { error: authMessage(error) };
    if (error instanceof ImportFileError) return { error: error.message };
    console.error("previewImport failed", error);
    return { error: "The file could not be processed. Please check it and try again." };
  }
  redirect(`/admin/import/${batchId}`);
}

const commitSchema = z.object({
  batchId: z.uuid(),
  publish: z.boolean(),
  overwriteManualEdits: z.boolean(),
});

/** Step 2: apply a previewed batch. */
export async function commitImport(_prev: ImportFormState, formData: FormData): Promise<ImportFormState> {
  const parsed = commitSchema.safeParse({
    batchId: formData.get("batchId"),
    publish: formData.get("publish") === "on",
    overwriteManualEdits: formData.get("overwriteManualEdits") === "on",
  });
  if (!parsed.success) return { error: "This import could not be found." };

  try {
    const viewer = await authorize("admin");
    const result = await commitImportBatch({ ...parsed.data, actorId: viewer.id });

    // Public pages must show the new content on the very next request.
    updateTag(TAGS.posts);
    updateTag(TAGS.taxonomy);
    updateTag(TAGS.trending);
    updateTag(TAGS.stats);
    for (const id of result.affectedPostIds.slice(0, 100)) updateTag(postTag(id));
  } catch (error) {
    if (error instanceof AuthError) return { error: authMessage(error) };
    if (error instanceof ImportStateError) return { error: error.message };
    console.error("commitImport failed", error);
    return { error: "The import failed and nothing was changed. Please try again." };
  }
  redirect(`/admin/import/${parsed.data.batchId}`);
}

export async function discardImport(formData: FormData): Promise<void> {
  const batchId = z.uuid().safeParse(formData.get("batchId"));
  if (!batchId.success) return;
  const viewer = await authorize("admin");
  try {
    await discardImportBatch(batchId.data, viewer.id);
  } catch (error) {
    if (!(error instanceof ImportStateError)) throw error;
  }
  redirect("/admin/import");
}

/**
 * Takes the rulings an import ADDED off the site again (back to draft), for
 * when a file turns out to be wrong. Rulings it only updated are left as they are.
 */
export async function unpublishImportBatch(batchId: string): Promise<ActionResult<{ count: number }>> {
  const auth = await guard("admin");
  if (!auth.ok) return auth.result;
  if (!z.uuid().safeParse(batchId).success) return fail("Unknown import.", "invalid");

  const result = await db.transaction(async (tx) => {
    const [batch] = await tx.select({ filename: importBatches.filename, status: importBatches.status }).from(importBatches).where(eq(importBatches.id, batchId)).limit(1);
    if (!batch) return null;
    const added = tx
      .select({ postId: importBatchRows.postId })
      .from(importBatchRows)
      .where(and(eq(importBatchRows.batchId, batchId), eq(importBatchRows.status, "new")));
    const changed = await tx
      .update(posts)
      .set({ status: "draft" })
      .where(and(inArray(posts.id, added), eq(posts.status, "published")))
      .returning({ id: posts.id, slug: posts.slug });
    await writeAudit(tx, {
      actorId: auth.viewer.id,
      action: "import.unpublish",
      entityType: "import_batch",
      entityId: batchId,
      summary: `Unpublished ${changed.length} rulings added by “${batch.filename}”`,
      meta: { ids: changed.map((c) => c.id) },
    });
    return changed;
  });

  if (!result) return fail("This import no longer exists.", "not_found");
  updateTag(TAGS.posts);
  updateTag(TAGS.trending);
  updateTag(TAGS.stats);
  for (const post of result.slice(0, 100)) {
    updateTag(postTag(post.id));
    updateTag(postTag(post.slug));
  }
  return ok({ count: result.length });
}
