import { createClient } from "@/lib/supabase/server";
import EventNewForm from "./EventNewForm";

export default async function EventNewPage() {
  const supabase = await createClient();
  const { data: members } = await supabase
    .from("members")
    .select("*")
    .order("created_at");

  if (!members || members.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">イベント作成</h1>
        <p className="text-muted-foreground text-center py-12">
          先にメンバーを登録してください。
        </p>
      </div>
    );
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">イベント作成</h1>
      <EventNewForm members={members} today={today} />
    </div>
  );
}
