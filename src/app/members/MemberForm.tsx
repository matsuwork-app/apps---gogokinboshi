"use client";

import { useRef, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { addMember } from "@/app/actions/members";
import { toast } from "sonner";
import { Plus } from "lucide-react";

export default function MemberForm() {
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await addMember(formData);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("メンバーを追加しました");
        formRef.current?.reset();
      }
    });
  }

  return (
    <form ref={formRef} action={handleSubmit} className="flex gap-2">
        <Input
          name="name"
          placeholder="メンバー名を入力"
          className="flex-1"
          required
        />
        <Button type="submit" disabled={isPending}>
          <Plus size={16} className="mr-1" />
          追加
        </Button>
    </form>
  );
}
