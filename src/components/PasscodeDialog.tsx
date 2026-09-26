"use client";

import { useState, useEffect, useTransition } from "react";

import { unlockManager } from "@/app/actions/auth";

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

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="passcode-dialog-title"
        className="relative bg-background rounded-2xl shadow-2xl w-72 p-6 space-y-4"
      >
        <p id="passcode-dialog-title" className="text-center font-bold text-lg">
          パスコードを入力
        </p>
        <input
          aria-label="管理パスコード"
          type="password"
          inputMode="numeric"
          autoComplete="current-password"
          value={value}
          onChange={(e) => { setValue(e.target.value); setError(""); }}
          onKeyDown={(e) => e.key === "Enter" && handleGo()}
          placeholder="••••"
          autoFocus
          className="w-full text-center text-2xl tracking-widest border rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-primary"
        />
        {error && (
          <p className="text-destructive text-sm text-center">
            {error}
          </p>
        )}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="flex-1 py-2.5 rounded-lg border text-sm font-semibold hover:bg-muted transition-colors"
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={handleGo}
            disabled={isPending}
            className="flex-1 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {isPending ? "確認中…" : "GO"}
          </button>
        </div>
      </div>
    </div>
  );
}
