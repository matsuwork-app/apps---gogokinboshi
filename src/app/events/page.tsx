import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Plus, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import EventDeleteButton from "./EventDeleteButton";

export default async function EventsPage() {
  const supabase = await createClient();
  const { data: events } = await supabase
    .from("events")
    .select("id, event_date, notes")
    .order("event_date", { ascending: false })
    .limit(50);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">イベント一覧</h1>
        <Link href="/events/new" className={cn(buttonVariants())}>
          <Plus size={16} className="mr-1" />
          新規
        </Link>
      </div>

      {(!events || events.length === 0) ? (
        <p className="text-muted-foreground text-center py-12">
          まだイベントがありません。「新規」から作成してください。
        </p>
      ) : (
        <ul className="space-y-2">
          {events.map((event) => {
            const label = new Date(event.event_date).toLocaleDateString("ja-JP", {
              year: "numeric",
              month: "long",
              day: "numeric",
              weekday: "short",
            });
            return (
              <li key={event.id} className="flex items-center gap-1">
                <Link
                  href={`/events/${event.id}`}
                  className="flex-1 flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-muted transition-colors"
                >
                  <div>
                    <p className="font-semibold">{label}</p>
                    {event.notes && (
                      <p className="text-sm text-muted-foreground mt-0.5">
                        {event.notes}
                      </p>
                    )}
                  </div>
                  <ChevronRight size={18} className="text-muted-foreground" />
                </Link>
                <EventDeleteButton id={event.id} label={label} />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
