"use client";

import { useState } from "react";
import { adminSetRole } from "@/lib/actions/admin";
import { Button } from "@/components/ui/button";
import type { UserRole } from "@/types/database";

export default function MemberRoleForm({ userId, currentRole }: { userId: string; currentRole: UserRole }) {
  const [role, setRole] = useState<UserRole>(currentRole);

  return (
    <form action={adminSetRole} className="flex items-center gap-1.5">
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="role" value={role} />
      <select
        value={role}
        onChange={(e) => setRole(e.target.value as UserRole)}
        className="h-7 rounded-md border border-input bg-input/30 px-1.5 text-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        <option value="member">Member</option>
        <option value="admin">Admin</option>
      </select>
      {role !== currentRole && (
        <Button type="submit" size="sm" variant="outline" className="h-7 px-2 text-xs">
          Save
        </Button>
      )}
    </form>
  );
}
