import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import { PGlite } from "@electric-sql/pglite";

const ROOT = process.cwd();
const BASELINE_PATH = path.join(
  ROOT,
  "supabase/migrations/202609250001_legacy_baseline.sql"
);
const MIGRATION_PATH = path.join(
  ROOT,
  "supabase/migrations/202609260001_multiteam_state_machine_rls.sql"
);
const RANKING_MIGRATION_PATH = path.join(
  ROOT,
  "supabase/migrations/202609260002_public_ranking_rpc.sql"
);
const REASSIGNMENT_MIGRATION_PATH = path.join(
  ROOT,
  "supabase/migrations/202609280001_reassign_event_team_members.sql"
);
const ROLLBACK_PATH = path.join(
  ROOT,
  "supabase/rollback/20260926_restore_legacy_writes.sql"
);
const TABLE_COLUMNS = {
  members: ["id", "name", "created_at"],
  events: ["id", "event_date", "notes", "created_at"],
  event_participants: ["id", "event_id", "member_id", "created_at"],
  matches: [
    "id",
    "event_id",
    "match_number",
    "status",
    "started_at",
    "ended_at",
    "created_at",
  ],
  match_lineups: ["id", "match_id", "member_id", "team", "created_at"],
  goals: ["id", "match_id", "member_id", "scored_at", "created_at"],
  playing_intervals: [
    "id",
    "match_id",
    "member_id",
    "started_at",
    "ended_at",
    "created_at",
  ],
};

async function findBackupPath() {
  if (process.argv[2]) return path.resolve(ROOT, process.argv[2]);

  const backupDirectory = path.join(ROOT, "backups");
  const candidates = (await readdir(backupDirectory))
    .filter((name) => name.startsWith("supabase-data-") && name.endsWith(".json"))
    .sort();
  const latest = candidates.at(-1);
  if (!latest) throw new Error("No Supabase JSON backup was found");
  return path.join(backupDirectory, latest);
}

async function insertRows(db, table, rows) {
  const columns = TABLE_COLUMNS[table];
  assert(columns, `Unexpected backup table: ${table}`);

  for (const row of rows) {
    const placeholders = columns.map((_, index) => `$${index + 1}`).join(", ");
    await db.query(
      `insert into public.${table} (${columns.join(", ")}) values (${placeholders})`,
      columns.map((column) => row[column] ?? null)
    );
  }
}

async function scalar(db, sql, params = []) {
  const result = await db.query(sql, params);
  const row = result.rows[0];
  return row ? Object.values(row)[0] : undefined;
}

async function setRole(db, role, callback) {
  await db.exec(`set role ${role}`);
  try {
    return await callback();
  } finally {
    await db.exec("reset role");
  }
}

const backupPath = await findBackupPath();
const backup = JSON.parse(await readFile(backupPath, "utf8"));
assert.equal(backup.format, "gogokinboshi-supabase-json-v1");

const db = new PGlite();
try {
  await db.waitReady;
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin bypassrls;
  `);
  await db.exec(await readFile(BASELINE_PATH, "utf8"));

  for (const [table, columns] of Object.entries(TABLE_COLUMNS)) {
    assert.deepEqual(Object.keys(backup.data).includes(table), true);
    assert(columns.length > 0);
    await insertRows(db, table, backup.data[table]);
  }

  await db.exec(await readFile(MIGRATION_PATH, "utf8"));
  await db.exec(await readFile(RANKING_MIGRATION_PATH, "utf8"));
  await db.exec(await readFile(REASSIGNMENT_MIGRATION_PATH, "utf8"));

  for (const [table, expectedCount] of Object.entries(backup.row_counts)) {
    const actualCount = Number(await scalar(db, `select count(*) from public.${table}`));
    assert.equal(actualCount, expectedCount, `${table} row count changed`);
  }

  assert.equal(
    Number(
      await scalar(
        db,
        `select count(*)
         from public.events e
         left join public.event_teams et on et.event_id = e.id
         group by e.id, e.team_count
         having count(et.id) <> e.team_count`
      ) ?? 0
    ),
    0,
    "event team backfill is incomplete"
  );
  assert.equal(
    Number(await scalar(db, "select count(*) from public.match_lineups where match_team_id is null")),
    0
  );
  assert.equal(
    Number(
      await scalar(
        db,
        `select count(*) from public.playing_intervals pi
         join public.matches m on m.id = pi.match_id
         where pi.ended_at is null and m.status <> 'active'`
      )
    ),
    0,
    "non-active match still has an open interval"
  );
  assert.equal(
    await scalar(db, "select has_table_privilege('anon', 'public.matches', 'select')"),
    true
  );
  assert.equal(
    await scalar(db, "select has_table_privilege('anon', 'public.matches', 'insert')"),
    false
  );
  assert.equal(
    await scalar(
      db,
      "select has_function_privilege('anon', 'public.transition_match(uuid,text,text)', 'execute')"
    ),
    false
  );

  const memberIds = backup.data.members.slice(0, 6).map((member) => member.id);
  assert.equal(memberIds.length, 6, "at least six members are required for verification");
  const teams = [0, 1, 2].map((index) => ({
    name: `検証チーム${String.fromCharCode(65 + index)}`,
    member_ids: memberIds.slice(index * 2, index * 2 + 2),
  }));

  const lifecycle = await setRole(db, "service_role", async () => {
    const eventId = await scalar(
      db,
      "select public.create_event_with_teams($1::date, $2::text, $3::jsonb)",
      ["2099-01-01", "local migration verification", JSON.stringify(teams)]
    );
    const eventTeamRows = await db.query(
      "select id from public.event_teams where event_id = $1 order by sort_order",
      [eventId]
    );
    assert.equal(eventTeamRows.rows.length, 3);

    const matchId = await scalar(
      db,
      "select public.create_match_with_teams($1::uuid, $2::uuid[], null)",
      [eventId, eventTeamRows.rows.slice(0, 2).map((team) => team.id)]
    );
    await db.query("select public.transition_match($1::uuid, 'pending', 'active')", [matchId]);
    await db.query("select public.set_player_playing($1::uuid, $2::uuid, false)", [
      matchId,
      memberIds[0],
    ]);
    await db.query("insert into public.goals (match_id, member_id) values ($1, $2)", [
      matchId,
      memberIds[1],
    ]);
    await db.query("select public.transition_match($1::uuid, 'active', 'paused')", [matchId]);
    await db.query("select public.transition_match($1::uuid, 'paused', 'active')", [matchId]);
    await db.query("select public.transition_match($1::uuid, 'active', 'finished')", [matchId]);

    return { eventId, matchId };
  });

  assert.equal(
    await scalar(db, "select status from public.matches where id = $1", [lifecycle.matchId]),
    "finished"
  );
  assert.equal(
    Number(
      await scalar(
        db,
        "select count(*) from public.playing_intervals where match_id = $1 and ended_at is null",
        [lifecycle.matchId]
      )
    ),
    0
  );
  assert.equal(
    Number(await scalar(db, "select count(*) from public.goals where match_id = $1", [lifecycle.matchId])),
    1
  );

  assert.equal(
    await scalar(
      db,
      "select has_function_privilege('anon', 'public.reassign_event_team_members(uuid,jsonb)', 'execute')"
    ),
    false
  );
  assert.equal(
    await scalar(
      db,
      "select has_function_privilege('authenticated', 'public.reassign_event_team_members(uuid,jsonb)', 'execute')"
    ),
    false
  );
  assert.equal(
    await scalar(
      db,
      "select has_function_privilege('service_role', 'public.reassign_event_team_members(uuid,jsonb)', 'execute')"
    ),
    true
  );

  await setRole(db, "service_role", async () => {
    const eventTeamRows = await db.query(
      "select id, team_code from public.event_teams where event_id = $1 order by sort_order",
      [lifecycle.eventId]
    );
    const [teamA, teamB, teamC] = eventTeamRows.rows;
    const reassigned = [
      { member_id: memberIds[4], event_team_id: teamA.id },
      { member_id: memberIds[1], event_team_id: teamA.id },
      { member_id: memberIds[2], event_team_id: teamB.id },
      { member_id: memberIds[3], event_team_id: teamB.id },
      { member_id: memberIds[0], event_team_id: teamC.id },
      { member_id: memberIds[5], event_team_id: teamC.id },
    ];
    const originalLineup = await db.query(
      `select ml.member_id, et.team_code
       from public.match_lineups ml
       join public.match_teams mt on mt.id = ml.match_team_id
       join public.event_teams et on et.id = mt.event_team_id
       where ml.match_id = $1
       order by ml.member_id`,
      [lifecycle.matchId]
    );

    for (const invalidAssignments of [
      reassigned.slice(0, -1),
      [...reassigned.slice(0, -1), reassigned[0]],
      reassigned.map((assignment) =>
        assignment.event_team_id === teamC.id
          ? { ...assignment, event_team_id: teamA.id }
          : assignment
      ),
    ]) {
      await assert.rejects(
        db.query(
          "select public.reassign_event_team_members($1::uuid, $2::jsonb)",
          [lifecycle.eventId, JSON.stringify(invalidAssignments)]
        ),
        /every event participant exactly once|every event team must have at least one member/i
      );
    }

    await db.query(
      "select public.reassign_event_team_members($1::uuid, $2::jsonb)",
      [lifecycle.eventId, JSON.stringify(reassigned)]
    );

    const currentMembership = await db.query(
      `select etm.member_id, et.team_code
       from public.event_team_members etm
       join public.event_teams et on et.id = etm.event_team_id
       where etm.event_id = $1
       order by etm.member_id`,
      [lifecycle.eventId]
    );
    assert.deepEqual(
      currentMembership.rows,
      reassigned
        .map((assignment) => ({
          member_id: assignment.member_id,
          team_code: eventTeamRows.rows.find((team) => team.id === assignment.event_team_id).team_code,
        }))
        .sort((left, right) => left.member_id.localeCompare(right.member_id))
    );

    const preservedLineup = await db.query(
      `select ml.member_id, et.team_code
       from public.match_lineups ml
       join public.match_teams mt on mt.id = ml.match_team_id
       join public.event_teams et on et.id = mt.event_team_id
       where ml.match_id = $1
       order by ml.member_id`,
      [lifecycle.matchId]
    );
    assert.deepEqual(
      preservedLineup.rows,
      originalLineup.rows,
      "reassignment must not modify a finished match lineup"
    );

    const nextMatchId = await scalar(
      db,
      "select public.create_match_with_teams($1::uuid, $2::uuid[], null)",
      [lifecycle.eventId, [teamA.id, teamC.id]]
    );
    const nextLineup = await db.query(
      `select ml.member_id, mt.side
       from public.match_lineups ml
       join public.match_teams mt on mt.id = ml.match_team_id
       where ml.match_id = $1
       order by mt.side, ml.member_id`,
      [nextMatchId]
    );
    assert.deepEqual(nextLineup.rows, [
      { member_id: memberIds[1], side: 1 },
      { member_id: memberIds[4], side: 1 },
      { member_id: memberIds[0], side: 2 },
      { member_id: memberIds[5], side: 2 },
    ]);

    await assert.rejects(
      db.query(
        "select public.reassign_event_team_members($1::uuid, $2::jsonb)",
        [lifecycle.eventId, JSON.stringify(reassigned)]
      ),
      /unfinished match/i
    );
  });

  await setRole(db, "service_role", async () => {
    const eventId = await scalar(
      db,
      "select public.create_event_with_teams($1::date, $2::text, $3::jsonb)",
      ["2099-04-01", "ranking JST boundary verification", JSON.stringify(teams)]
    );
    const eventTeamRows = await db.query(
      "select id from public.event_teams where event_id = $1 order by sort_order",
      [eventId]
    );
    const startedAtValues = [
      "2099-03-31T14:59:59Z",
      "2099-03-31T15:00:00Z",
      "2099-04-01T14:59:59Z",
      "2099-04-01T15:00:00Z",
    ];

    for (const [index, startedAt] of startedAtValues.entries()) {
      const matchId = await scalar(
        db,
        "select public.create_match_with_teams($1::uuid, $2::uuid[], null)",
        [eventId, eventTeamRows.rows.slice(0, 2).map((team) => team.id)]
      );
      await db.query(
        `update public.matches
         set status = 'finished', started_at = $2::timestamptz,
             ended_at = $2::timestamptz + interval '30 seconds', elapsed_seconds = 30
         where id = $1`,
        [matchId, startedAt]
      );
      await db.query(
        "insert into public.goals (match_id, member_id, scored_at) values ($1, $2, $3::timestamptz)",
        [matchId, memberIds[0], startedAt]
      );
      if (index === 1 || index === 2) {
        const duration = index === 1 ? 10 : 20;
        await db.query(
          `insert into public.playing_intervals (match_id, member_id, started_at, ended_at)
           values ($1, $2, $3::timestamptz, $3::timestamptz + ($4 * interval '1 second'))`,
          [matchId, memberIds[0], startedAt, duration]
        );
      }
    }
  });

  await setRole(db, "anon", async () => {
    assert.equal(
      await scalar(
        db,
        "select has_function_privilege('anon', 'public.get_public_rankings(date,date)', 'execute')"
      ),
      true
    );
    const rankingRows = await db.query(
      "select * from public.get_public_rankings('2099-04-01', '2099-04-01')"
    );
    const target = rankingRows.rows.find((row) => row.member_id === memberIds[0]);
    assert(target, "ranking must include every member");
    assert.equal(Number(target.total_goals), 2, "JST day boundaries must be inclusive by date");
    assert.equal(Number(target.total_seconds), 30);
    assert.equal(Number(target.participated_events), 1);
    assert.equal(Number(target.total_events), 1);
    assert.equal(Number(target.rank), 1);
    assert.equal(rankingRows.rows.length, backup.data.members.length);
    await assert.rejects(
      db.query("select * from public.get_public_rankings('2099-04-02', '2099-04-01')"),
      /from date must not be after to date/i
    );
    await assert.rejects(
      db.query("select * from public.get_public_rankings('2000-01-01', '2011-01-01')"),
      /ranking period must not exceed 3660 days/i
    );
  });

  await setRole(db, "anon", async () => {
    assert.equal(Number(await scalar(db, "select count(*) from public.events")) > 0, true);
    await assert.rejects(
      db.query("insert into public.events (event_date) values ('2099-02-01')"),
      /permission denied|row-level security/i
    );
  });

  await db.exec(await readFile(ROLLBACK_PATH, "utf8"));

  await setRole(db, "anon", async () => {
    const legacyEventId = await scalar(
      db,
      "insert into public.events (event_date, notes) values ('2099-03-01', 'rollback verification') returning id"
    );
    await db.query(
      "insert into public.event_participants (event_id, member_id) values ($1, $2), ($1, $3)",
      [legacyEventId, memberIds[0], memberIds[1]]
    );
    const legacyMatchId = await scalar(
      db,
      "insert into public.matches (event_id, match_number) values ($1, 1) returning id",
      [legacyEventId]
    );
    await db.query(
      "insert into public.match_lineups (match_id, member_id, team) values ($1, $2, 'A'), ($1, $3, 'B')",
      [legacyMatchId, memberIds[0], memberIds[1]]
    );
    await db.query("insert into public.goals (match_id, member_id) values ($1, $2)", [
      legacyMatchId,
      memberIds[0],
    ]);
    await db.query(
      "insert into public.playing_intervals (match_id, member_id) values ($1, $2)",
      [legacyMatchId, memberIds[0]]
    );
    await db.query(
      "update public.matches set status = 'active', started_at = now() where id = $1",
      [legacyMatchId]
    );
  });

  assert.equal(
    await scalar(db, "select has_table_privilege('anon', 'public.matches', 'insert')"),
    true
  );

  process.stdout.write(
    `${JSON.stringify({
      backupPath,
      preservedRowCounts: backup.row_counts,
      verified: [
        "baseline",
        "legacy backfill",
        "RLS privileges",
        "3-team event",
        "match lifecycle",
        "atomic event-team reassignment and lineup snapshots",
        "public ranking RPC with JST boundaries",
        "anon write rejection",
        "legacy-write rollback",
      ],
    })}\n`
  );
} finally {
  await db.close();
}
