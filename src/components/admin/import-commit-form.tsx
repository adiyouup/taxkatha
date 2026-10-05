"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { pluralize } from "@/lib/format";
import { commitImport, discardImport, type ImportFormState } from "@/server/actions/import";

const initial: ImportFormState = { error: null };

export function ImportCommitForm({
  batchId,
  toAdd,
  toUpdate,
  editedInAdmin,
}: {
  batchId: string;
  toAdd: number;
  toUpdate: number;
  editedInAdmin: number;
}) {
  const [state, formAction, pending] = useActionState(commitImport, initial);
  const nothing = toAdd + toUpdate + editedInAdmin === 0;

  return (
    <div className="space-y-5">
      <form action={formAction} className="space-y-5">
        <input type="hidden" name="batchId" value={batchId} />

        <label className="flex cursor-pointer items-start gap-3">
          <input type="checkbox" name="publish" defaultChecked className="mt-1 size-4 accent-(--color-gold-700)" />
          <span>
            <span className="block text-[0.9375rem] font-semibold text-foreground">Publish new cases immediately</span>
            <span className="type-caption block text-muted-foreground">
              Untick to import them as drafts and publish later. Existing cases keep their current status either way.
            </span>
          </span>
        </label>

        {editedInAdmin > 0 ? (
          <label className="flex cursor-pointer items-start gap-3">
            <input type="checkbox" name="overwriteManualEdits" className="mt-1 size-4 accent-(--color-gold-700)" />
            <span>
              <span className="block text-[0.9375rem] font-semibold text-foreground">
                Overwrite {pluralize(editedInAdmin, "case")} edited in the admin
              </span>
              <span className="type-caption block text-muted-foreground">
                These were changed by hand after their last import. Leave unticked to keep the hand edits.
              </span>
            </span>
          </label>
        ) : null}

        {state.error ? (
          <p role="alert" className="type-small rounded-md border border-destructive/30 bg-destructive/8 px-3.5 py-2.5 text-destructive">
            {state.error}
          </p>
        ) : null}

        <Button type="submit" size="lg" disabled={pending || nothing}>
          {pending ? <Loader2 className="animate-spin" /> : null}
          {pending
            ? "Importing…"
            : nothing
              ? "Nothing to import"
              : `Import ${pluralize(toAdd, "new case")}${toUpdate ? ` and update ${toUpdate}` : ""}`}
        </Button>
      </form>

      <form action={discardImport}>
        <input type="hidden" name="batchId" value={batchId} />
        <Button type="submit" variant="link" className="text-muted-foreground hover:text-destructive" disabled={pending}>
          Discard this preview
        </Button>
      </form>
    </div>
  );
}
