import type { Metadata } from "next";

import { AdminShell } from "@/components/admin/admin-shell";
import { requireRolePage } from "@/server/auth/dal";
import { countOpenReports } from "@/server/queries/admin-dashboard";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · TaxKatha Admin" },
  robots: { index: false, follow: false },
};

// Admin pages are per-request by nature; they are allowed to block on the
// session instead of prerendering a static shell.
export const instant = false;

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  // Chrome only. This check hides the admin frame from non-staff, but every
  // page and action below performs its own authorization.
  const viewer = await requireRolePage("moderator");
  const openReports = await countOpenReports();
  return (
    <AdminShell
      viewer={{ name: viewer.name, email: viewer.email, image: viewer.image, role: viewer.role === "admin" ? "admin" : "moderator" }}
      openReports={openReports}
    >
      {children}
    </AdminShell>
  );
}
