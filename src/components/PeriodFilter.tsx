"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

export default function PeriodFilter({
  from,
  to,
}: {
  from: string;
  to: string;
}) {
  const router = useRouter();

  const fromDate = new Date(from);
  const toDate = new Date(to);
  const label = `${fromDate.getFullYear()}年${fromDate.getMonth() + 1}月 〜 ${toDate.getFullYear()}年${toDate.getMonth() + 1}月`;

  function shift(months: number) {
    const newFrom = new Date(fromDate);
    newFrom.setMonth(newFrom.getMonth() + months);
    const newTo = new Date(toDate);
    newTo.setMonth(newTo.getMonth() + months);
    router.push(
      `/?from=${newFrom.toISOString().slice(0, 10)}&to=${newTo.toISOString().slice(0, 10)}`
    );
  }

  function resetToYear() {
    const now = new Date();
    const f = new Date(now.getFullYear() - 1, now.getMonth(), 1)
      .toISOString()
      .slice(0, 10);
    const t = now.toISOString().slice(0, 10);
    router.push(`/?from=${f}&to=${t}`);
  }

  return (
    <div className="flex items-center gap-2 text-sm">
      <Button variant="outline" size="icon" onClick={() => shift(-1)}>
        <ChevronLeft size={16} />
      </Button>
      <span className="flex-1 text-center font-medium">{label}</span>
      <Button variant="outline" size="icon" onClick={() => shift(1)}>
        <ChevronRight size={16} />
      </Button>
      <Button variant="ghost" size="sm" onClick={resetToYear} className="text-xs">
        直近1年
      </Button>
    </div>
  );
}
