import Link from "next/link";
import { ChevronRight } from "lucide-react";

export type Crumb = { label: string; href?: string };

/** Title block for admin pages: breadcrumb, serif title, optional actions. */
export function AdminPageHeader({
  title,
  description,
  crumbs,
  actions,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  crumbs?: Crumb[];
  actions?: React.ReactNode;
}) {
  return (
    <header className="mb-8">
      {crumbs && crumbs.length > 0 ? (
        <nav aria-label="Breadcrumb" className="mb-3">
          <ol className="type-caption flex flex-wrap items-center gap-1.5 text-muted-foreground">
            {crumbs.map((crumb, i) => (
              <li key={`${crumb.label}-${i}`} className="flex items-center gap-1.5">
                {i > 0 ? <ChevronRight className="size-3.5" aria-hidden /> : null}
                {crumb.href ? (
                  <Link href={crumb.href} className="hover:text-foreground hover:underline">
                    {crumb.label}
                  </Link>
                ) : (
                  <span className="text-foreground">{crumb.label}</span>
                )}
              </li>
            ))}
          </ol>
        </nav>
      ) : null}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="type-display-md break-words text-foreground">{title}</h1>
          {description ? <p className="type-small mt-2 max-w-2xl text-muted-foreground">{description}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}

/** White surface used for every admin panel. */
export function AdminCard({
  title,
  description,
  children,
  className = "",
  action,
  flush = false,
}: {
  title?: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  action?: React.ReactNode;
  /** No inner padding: for tables and lists that run edge to edge. */
  flush?: boolean;
}) {
  return (
    <section className={`overflow-hidden rounded-xl border bg-card shadow-soft ${className}`}>
      {title ? (
        <div className="flex flex-wrap items-start justify-between gap-3 border-b px-5 py-4 sm:px-6">
          <div>
            <h2 className="font-display text-lg font-semibold text-foreground">{title}</h2>
            {description ? <p className="type-caption mt-1 text-muted-foreground">{description}</p> : null}
          </div>
          {action}
        </div>
      ) : null}
      {flush ? children : <div className="p-5 sm:p-6">{children}</div>}
    </section>
  );
}
