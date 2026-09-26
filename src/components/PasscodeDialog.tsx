"use client";

import { useEffect, useRef, useState, useTransition } from "react";

import { unlockManager } from "@/app/actions/auth";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export default function PasscodeDialog({
  open,
  onClose,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setValue("");
      setError("");
    }
  }, [open]);

  function handleGo() {
    if (isPending) return;

    startTransition(async () => {
      try {
        const result = await unlockManager(value);
        if (result.ok) {
          onConfirm();
          onClose();
          return;
        }

        setError(result.error);
        setValue("");
      } catch {
        setError("通信に失敗しました。もう一度お試しください");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent
        className="w-72 rounded-2xl p-6 shadow-2xl"
        showCloseButton={false}
        initialFocus={inputRef}
      >
        <DialogTitle className="text-center text-lg font-bold">
          パスコードを入力
        </DialogTitle>
        <DialogDescription className="sr-only">
          管理機能を利用するためのパスコードを入力してください。
        </DialogDescription>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            handleGo();
          }}
        >
          <label htmlFor="manager-passcode" className="sr-only">管理パスコード</label>
          <input
            ref={inputRef}
            id="manager-passcode"
            type="password"
            inputMode="numeric"
            autoComplete="current-password"
            value={value}
            onChange={(e) => { setValue(e.target.value); setError(""); }}
            placeholder="••••"
            aria-invalid={Boolean(error)}
            aria-describedby={error ? "manager-passcode-error" : undefined}
            className="w-full rounded-lg border px-4 py-3 text-center text-2xl tracking-widest outline-none focus:ring-2 focus:ring-primary"
          />
          {error && (
            <p id="manager-passcode-error" role="alert" className="text-center text-sm text-destructive">
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <DialogClose
              render={<Button type="button" variant="outline" className="flex-1" />}
              disabled={isPending}
            >
              キャンセル
            </DialogClose>
            <Button
              type="submit"
              disabled={isPending}
              className="flex-1 font-bold"
            >
              {isPending ? "確認中…" : "GO"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
