"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { EyeOff } from "lucide-react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { Button } from "@/components/ui/button";
import { pluralize } from "@/lib/format";
import { unpublishImportBatch } from "@/server/actions/import";

/** After an import: open its rulings, or take the ones it added off the site again. */
export function ImportBatchActions({ batchId, added }: { batchId: string; added: number }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link href={`/admin/case-laws?batch=${batchId}`} className="text-sm font-semibold text-gold-text hover:underline">
        See these rulings
      </Link>
      {added > 0 ? (
        <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>
          <EyeOff strokeWidth={1.5} /> Unpublish what it added
        </Button>
      ) : null}
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={`Unpublish the ${pluralize(added, "ruling")} this import added?`}
        description="They go back to drafts and disappear from the site; nothing is deleted. Rulings this import only updated are not affected. You can publish them again from Case laws."
        confirmLabel="Unpublish"
        pending={pending}
        onConfirm={() =>
          startTransition(async () => {
            const result = await unpublishImportBatch(batchId);
            setOpen(false);
            if (!result.ok) return void toast.error(result.error);
            toast.success(`${pluralize(result.data.count, "ruling")} moved to drafts.`);
          })
        }
      />
    </div>
  );
}
