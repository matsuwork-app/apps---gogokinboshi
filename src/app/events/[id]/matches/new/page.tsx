import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import MatchNewForm from "./MatchNewForm";

export default async function MatchNewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: eventId } = await params;
  const supabase = await createClient();

  const { data: event } = await supabase
    .from("events")
    .select("event_date")
    .eq("id", eventId)
    .single();
  if (!event) notFound();

  const { data: participants } = await supabase
    .from("event_participants")
    .select("members(*)")
    .eq("event_id", eventId);

  const members =
    participants?.flatMap((p) => (p.members ? [p.members] : [])) ?? [];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">チーム編成</h1>
      <p className="text-muted-foreground text-sm">
        各メンバーをAチームかBチームに振り分けてください。
      </p>
      <MatchNewForm members={members} eventId={eventId} />
    </div>
  );
}
