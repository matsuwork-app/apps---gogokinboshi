"use client";

import { useState, useTransition } from "react";
import type { Member } from "@/types";
import { Button } from "@/components/ui/button";
import { deleteMember } from "@/app/actions/members";
import { toast } from "sonner";
import { Trash2, User } from "lucide-react";
import PasscodeDialog from "@/components/PasscodeDialog";

export default function MemberList({ members }: { members: Member[] }) {
  const [isPending, startTransition] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [targetMember, setTargetMember] = useState<Member | null>(null);

  function handleDeleteClick(member: Member) {
    setTargetMember(member);
    setDialogOpen(true);
  }

  function handleConfirm() {
    if (!targetMember) return;
    const { id, name } = targetMember;
    startTransition(async () => {
      const result = await deleteMember(id);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(`「${name}」を削除しました`);
      }
    });
  }

  if (members.length === 0) {
    return (
      <p className="text-muted-foreground text-center py-8">
        メンバーがいません。追加してください。
      </p>
    );
  }

  return (
    <>
      <ul className="space-y-2">
        {members.map((member) => (
          <li
            key={member.id}
            className="flex items-center justify-between p-3 rounded-lg border bg-card"
          >
            <div className="flex items-center gap-2">
              <User size={16} className="text-muted-foreground" />
              <span className="font-medium">{member.name}</span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              disabled={isPending}
              onClick={() => handleDeleteClick(member)}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 size={16} />
            </Button>
          </li>
        ))}
      </ul>

      <PasscodeDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onConfirm={handleConfirm}
      />
    </>
  );
}
