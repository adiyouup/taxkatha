"use client";

import { useActionState, useRef, useState } from "react";
import { FileSpreadsheet, Loader2, UploadCloud, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatBytes } from "@/lib/format";
import { cn } from "@/lib/utils";
import { previewImport, type ImportFormState } from "@/server/actions/import";

const initial: ImportFormState = { error: null };
const MAX_BYTES = 4 * 1024 * 1024;

export function ImportDropzone() {
  const [state, formAction, pending] = useActionState(previewImport, initial);
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const tooLarge = file !== null && file.size > MAX_BYTES;

  function onDrop(event: React.DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setDragging(false);
    const dropped = event.dataTransfer.files;
    if (dropped.length === 0 || !inputRef.current) return;
    inputRef.current.files = dropped;
    setFile(dropped[0] ?? null);
  }

  function clear() {
    if (inputRef.current) inputRef.current.value = "";
    setFile(null);
  }

  return (
    <form action={formAction} className="space-y-4">
      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-input bg-paper px-6 py-10 text-center transition-colors hover:border-gold-600 hover:bg-gold-50/60 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring",
          dragging && "border-gold-600 bg-gold-50",
        )}
      >
        <input
          ref={inputRef}
          type="file"
          name="file"
          accept=".xlsx,.xls,.csv"
          className="sr-only"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        <span className="flex size-12 items-center justify-center rounded-full border border-gold-600/40 bg-card text-gold-700">
          <UploadCloud strokeWidth={1.5} className="size-6" />
        </span>
        <span className="text-[0.9375rem] font-semibold text-foreground">
          Drop the workbook here, or <span className="text-gold-text underline underline-offset-4">browse</span>
        </span>
        <span className="type-caption text-muted-foreground">.xlsx, .xls or .csv · up to 4 MB · one case per row</span>
      </label>

      {file ? (
        <div className="flex items-center gap-3 rounded-md border bg-card px-4 py-3">
          <FileSpreadsheet strokeWidth={1.5} className="size-5 shrink-0 text-gold-700" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-foreground">{file.name}</p>
            <p className={cn("type-caption", tooLarge ? "text-destructive" : "text-muted-foreground")}>
              {formatBytes(file.size)}
              {tooLarge ? " — larger than the 4 MB limit. Split the file into smaller parts." : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={clear}
            aria-label="Remove file"
            className="flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>
      ) : null}

      {state.error ? (
        <p role="alert" className="type-small rounded-md border border-destructive/30 bg-destructive/8 px-3.5 py-2.5 text-destructive">
          {state.error}
        </p>
      ) : null}

      <Button type="submit" size="lg" disabled={!file || tooLarge || pending}>
        {pending ? <Loader2 className="animate-spin" /> : null}
        {pending ? "Reading rows…" : "Analyse file"}
      </Button>
      <p className="type-caption text-muted-foreground">Nothing is published at this step. You review the result first.</p>
    </form>
  );
}
