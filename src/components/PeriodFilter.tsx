"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  formatPeriodMonthLabel,
  getDefaultDashboardPeriod,
  isValidDateRange,
  shiftPeriodByMonths,
} from "@/lib/rankings/date-range";

export default function PeriodFilter({
  from,
  to,
}: {
  from: string;
  to: string;
}) {
  const router = useRouter();

  const defaults = getDefaultDashboardPeriod();
  const period = isValidDateRange(from, to) ? { from, to } : defaults;
  const label = formatPeriodMonthLabel(period.from, period.to);

  function shift(months: number) {
    const shifted = shiftPeriodByMonths(period.from, period.to, months);
    router.push(`/?from=${shifted.from}&to=${shifted.to}`);
  }

  function resetToYear() {
    const period = getDefaultDashboardPeriod();
    router.push(`/?from=${period.from}&to=${period.to}`);
  }

  return (
    <div className="flex items-center gap-2 text-sm">
      <Button
        variant="outline"
        size="icon"
        onClick={() => shift(-1)}
        aria-label="前の月へ"
      >
        <ChevronLeft size={16} aria-hidden="true" />
      </Button>
      <span className="flex-1 text-center font-medium">{label}</span>
      <Button
        variant="outline"
        size="icon"
        onClick={() => shift(1)}
        aria-label="次の月へ"
      >
        <ChevronRight size={16} aria-hidden="true" />
      </Button>
      <Button variant="ghost" size="sm" onClick={resetToYear} className="text-xs">
        直近1年
      </Button>
    </div>
  );
}
