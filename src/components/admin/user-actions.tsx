"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Ban, Loader2, LogOut, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatDateTime } from "@/lib/format";
import { banUser, deleteMember, setUserRole, signOutEverywhere, unbanUser } from "@/server/actions/admin-users";

type Member = {
  id: string;
  name: string;
  email: string;
  role: "user" | "moderator" | "admin";
  banned: boolean;
  banReason: string | null;
  banExpires: string | null;
  sessions: number;
};

const ROLE_HELP = {
  user: "Reads, likes, saves and joins discussions.",
  moderator: "Also hides, restores and deletes comments, and handles reports.",
  admin: "Everything: content, imports, members and settings.",
} as const;

const select = "select-chevron h-10 w-full rounded-md border border-input bg-card pr-9 pl-3 text-sm hover:border-navy-300";

/** Role, ban, sign-out and deletion controls on a member's page. */
export function UserActions({ member, self }: { member: Member; self: boolean }) {
  const router = useRouter();
  const [role, setRole] = useState(member.role);
  const [banOpen, setBanOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [days, setDays] = useState("7");
  const [confirmEmail, setConfirmEmail] = useState("");
  const [pending, startTransition] = useTransition();

  const run = (work: () => Promise<{ ok: boolean; error?: string }>, success: string, after?: () => void) =>
    startTransition(async () => {
      const result = await work();
      if (!result.ok) return void toast.error(result.error ?? "That did not work.");
      toast.success(success);
      after?.();
    });

  if (self) {
    return <p className="type-small text-muted-foreground">This is your account. Another administrator has to change your role or access.</p>;
  }

  return (
    <div className="space-y-6">
      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          run(() => setUserRole({ userId: member.id, role }), "Role updated.");
        }}
      >
        <Label htmlFor="member-role">Role</Label>
        <div className="flex gap-2">
          <select id="member-role" value={role} onChange={(event) => setRole(event.target.value as Member["role"])} className={select} disabled={member.banned}>
            <option value="user">Member</option>
            <option value="moderator">Moderator</option>
            <option value="admin">Administrator</option>
          </select>
          <Button type="submit" variant="navy" disabled={pending || role === member.role}>
            Save
          </Button>
        </div>
        <p className="type-caption text-muted-foreground">{ROLE_HELP[role]}</p>
      </form>

      <div className="space-y-3 border-t pt-5">
        {member.banned ? (
          <>
            <p className="text-sm">
              <span className="font-semibold text-destructive">Banned</span>
              {member.banExpires ? ` until ${formatDateTime(member.banExpires)}` : " permanently"}
              {member.banReason ? ` — ${member.banReason}` : ""}
            </p>
            <Button variant="outline" disabled={pending} onClick={() => run(() => unbanUser(member.id), "Ban lifted.")}>
              <ShieldCheck strokeWidth={1.5} /> Lift ban
            </Button>
          </>
        ) : (
          <Button variant="outline" disabled={pending || member.role !== "user"} onClick={() => setBanOpen(true)}>
            <Ban strokeWidth={1.5} /> Ban member
          </Button>
        )}
        {member.role !== "user" && !member.banned ? (
          <p className="type-caption text-muted-foreground">Staff must be made a member before they can be banned.</p>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2 border-t pt-5">
        <Button variant="ghost" disabled={pending || member.sessions === 0} onClick={() => run(() => signOutEverywhere(member.id), "Signed out everywhere.")}>
          {pending ? <Loader2 className="animate-spin" /> : <LogOut strokeWidth={1.5} />} Sign out everywhere ({member.sessions})
        </Button>
        <Button variant="destructive" disabled={pending || member.role !== "user"} onClick={() => setDeleteOpen(true)}>
          <Trash2 strokeWidth={1.5} /> Delete account
        </Button>
      </div>

      <Dialog open={banOpen} onOpenChange={setBanOpen}>
        <DialogContent>
          <form
            className="contents"
            onSubmit={(event) => {
              event.preventDefault();
              run(
                () => banUser({ userId: member.id, reason, days: days === "permanent" ? null : Number(days) }),
                `${member.name} is banned.`,
                () => setBanOpen(false),
              );
            }}
          >
            <DialogHeader>
              <DialogTitle>Ban {member.name}?</DialogTitle>
              <DialogDescription>
                They are signed out everywhere and cannot post or sign in until the ban ends (a page they already have open may keep showing member content
                for up to five minutes). Their existing comments stay unless you moderate them.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="ban-length">For how long</Label>
                <select id="ban-length" value={days} onChange={(event) => setDays(event.target.value)} className={select}>
                  <option value="1">1 day</option>
                  <option value="7">7 days</option>
                  <option value="30">30 days</option>
                  <option value="90">90 days</option>
                  <option value="permanent">Until lifted</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="ban-reason">Reason</Label>
                <Textarea
                  id="ban-reason"
                  value={reason}
                  rows={3}
                  maxLength={300}
                  required
                  onChange={(event) => setReason(event.target.value)}
                  placeholder="Repeated spam links in discussions"
                />
                <p className="type-caption text-muted-foreground">Kept in the audit log. The member is not shown this text.</p>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setBanOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="destructive" disabled={pending || reason.trim().length < 3}>
                {pending ? <Loader2 className="animate-spin" /> : null}
                Ban member
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <form
            className="contents"
            onSubmit={(event) => {
              event.preventDefault();
              run(
                () => deleteMember({ userId: member.id, confirmEmail }),
                "Account deleted.",
                () => router.push("/admin/users"),
              );
            }}
          >
            <DialogHeader>
              <DialogTitle>Delete this account?</DialogTitle>
              <DialogDescription>
                {member.name}’s profile, likes, saves and sign-in links are deleted, and their comments are erased. This cannot be undone. Use it for erasure
                requests.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="delete-confirm">Type {member.email} to confirm</Label>
              <Input id="delete-confirm" value={confirmEmail} autoComplete="off" onChange={(event) => setConfirmEmail(event.target.value)} />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setDeleteOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="destructive" disabled={pending || confirmEmail.trim().toLowerCase() !== member.email.toLowerCase()}>
                {pending ? <Loader2 className="animate-spin" /> : null}
                Delete permanently
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
