"use client";

import { useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { createEvent } from "@/app/actions/events";
import { toast } from "sonner";
import type { Member } from "@/types";
import { cn } from "@/lib/utils";
import PasscodeDialog from "@/components/PasscodeDialog";

export default function EventNewForm({
  members,
  today,
}: {
  members: Member[];
  today: string;
}) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pendingFormData, setPendingFormData] = useState<FormData | null>(null);

  function toggle(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function selectAll() {
    setSelectedIds(new Set(members.map((m) => m.id)));
  }

  function handleSubmit(formData: FormData) {
    selectedIds.forEach((id) => formData.append("member_ids", id));
    setPendingFormData(formData);
    setDialogOpen(true);
  }

  function handleConfirm() {
    if (!pendingFormData) return;
    const fd = pendingFormData;
    startTransition(async () => {
      const result = await createEvent(fd);
      if (result?.error) toast.error(result.error);
    });
  }

  return (
    <>
      <form action={handleSubmit} className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="event_date">日付</Label>
          <Input
            id="event_date"
            name="event_date"
            type="date"
            defaultValue={today}
            required
            className="max-w-xs"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="notes">メモ（任意）</Label>
          <Input id="notes" name="notes" placeholder="例: 公園グラウンド" />
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>参加メンバー（{selectedIds.size}名選択中）</Label>
            <button
              type="button"
              onClick={selectAll}
              className="text-sm text-primary underline"
            >
              全選択
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {members.map((m) => {
              const selected = selectedIds.has(m.id);
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => toggle(m.id)}
                  className={cn(
                    "p-3 rounded-lg border text-left font-medium transition-colors",
                    selected
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-card hover:bg-muted"
                  )}
                >
                  {m.name}
                </button>
              );
            })}
          </div>
        </div>

        <Button
          type="submit"
          disabled={isPending || selectedIds.size < 2}
          className="w-full"
          size="lg"
        >
          {isPending ? "作成中..." : "イベントを作成する"}
        </Button>
      </form>

      <PasscodeDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onConfirm={handleConfirm}
      />
    </>
  );
}
