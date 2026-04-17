import { createClient } from "@/lib/supabase/server";
import MemberForm from "./MemberForm";
import MemberList from "./MemberList";

export default async function MembersPage() {
  const supabase = await createClient();
  const { data: members } = await supabase
    .from("members")
    .select("*")
    .order("created_at");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">メンバー管理</h1>
      <MemberForm />
      <MemberList members={members ?? []} />
    </div>
  );
}
