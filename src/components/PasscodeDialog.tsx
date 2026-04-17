"use client";

import { useState, useEffect } from "react";

// パスコードをここで変更できます
const PASSCODE = "55";

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
  const [error, setError] = useState(false);

  useEffect(() => {
    if (open) {
      setValue("");
      setError(false);
    }
  }, [open]);

  function handleGo() {
    if (value === PASSCODE) {
      onConfirm();
      onClose();
    } else {
      setError(true);
      setValue("");
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-background rounded-2xl shadow-2xl w-72 p-6 space-y-4">
        <p className="text-center font-bold text-lg">パスコードを入力</p>
        <input
          type="password"
          inputMode="numeric"
          value={value}
          onChange={(e) => { setValue(e.target.value); setError(false); }}
          onKeyDown={(e) => e.key === "Enter" && handleGo()}
          placeholder="••••"
          autoFocus
          className="w-full text-center text-2xl tracking-widest border rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-primary"
        />
        {error && (
          <p className="text-destructive text-sm text-center">
            パスコードが違います
          </p>
        )}
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-lg border text-sm font-semibold hover:bg-muted transition-colors"
          >
            キャンセル
          </button>
          <button
            onClick={handleGo}
            className="flex-1 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-bold hover:opacity-90 transition-opacity"
          >
            GO
          </button>
        </div>
      </div>
    </div>
  );
}
