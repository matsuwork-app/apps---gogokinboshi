"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { deleteEvent } from "@/app/actions/events";
import { toast } from "sonner";

export default function EventDeleteButton({
  id,
  label,
}: {
  id: string;
  label: string;
}) {
  const [isPending, startTransition] = useTransition();

  function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`「${label}」を削除しますか？\n関連する試合・得点データも全て削除されます。`)) return;
    startTransition(async () => {
      const result = await deleteEvent(id);
      if (result?.error) toast.error(result.error);
      else toast.success("イベントを削除しました");
    });
  }

  return (
    <button
        onClick={handleClick}
        disabled={isPending}
        className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-40"
        aria-label="削除"
      >
        <Trash2 size={17} />
    </button>
  );
}
