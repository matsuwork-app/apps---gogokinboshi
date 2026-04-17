-- ================================================================
-- GOGO金星 テストデータ 2026年5〜9月（各月1イベント・1試合・3分）
-- Supabase SQL Editor で実行してください
-- ================================================================

DO $$
DECLARE
  ev_may  uuid; ev_jun uuid; ev_jul uuid; ev_aug uuid; ev_sep uuid;
  m_may   uuid; m_jun  uuid; m_jul  uuid; m_aug  uuid; m_sep  uuid;

  id_mahiro   uuid; id_shouta  uuid; id_taka    uuid;
  id_noza     uuid; id_motoki  uuid; id_rion    uuid;
  id_tanikai  uuid; id_shunpei uuid; id_mizota  uuid;
  id_rikuma   uuid; id_hideki  uuid; id_busshy  uuid;

  ts timestamptz; te timestamptz;
BEGIN
  -- メンバーID取得
  SELECT id INTO id_mahiro  FROM members WHERE name = 'まひろ';
  SELECT id INTO id_shouta  FROM members WHERE name = 'しょうた';
  SELECT id INTO id_taka    FROM members WHERE name = 'たかまつ';
  SELECT id INTO id_noza    FROM members WHERE name = 'のざ';
  SELECT id INTO id_motoki  FROM members WHERE name = 'もとき';
  SELECT id INTO id_rion    FROM members WHERE name = 'りおん';
  SELECT id INTO id_tanikai FROM members WHERE name = 'たにかい';
  SELECT id INTO id_shunpei FROM members WHERE name = 'しゅんぺい';
  SELECT id INTO id_mizota  FROM members WHERE name = 'みぞた';
  SELECT id INTO id_rikuma  FROM members WHERE name = 'りくま';
  SELECT id INTO id_hideki  FROM members WHERE name = 'ひでき';
  SELECT id INTO id_busshy  FROM members WHERE name = 'ぶっしー';

  -- ================================================================
  -- 5月：横浜
  -- ================================================================
  INSERT INTO events (event_date, notes) VALUES ('2026-05-10', '横浜') RETURNING id INTO ev_may;
  INSERT INTO event_participants (event_id, member_id) VALUES
    (ev_may, id_mahiro),(ev_may, id_shouta),(ev_may, id_taka),
    (ev_may, id_noza),(ev_may, id_motoki),(ev_may, id_rion),
    (ev_may, id_tanikai),(ev_may, id_shunpei),(ev_may, id_rikuma),(ev_may, id_hideki);

  m_may := gen_random_uuid();
  ts := '2026-05-10 10:00:00+09'; te := ts + interval '3 minutes';
  INSERT INTO matches (id, event_id, match_number, status, started_at, ended_at)
    VALUES (m_may, ev_may, 1, 'finished', ts, te);
  INSERT INTO match_lineups (match_id, member_id, team) VALUES
    (m_may, id_mahiro,'A'),(m_may, id_shouta,'A'),(m_may, id_noza,'A'),(m_may, id_rion,'A'),(m_may, id_rikuma,'A'),
    (m_may, id_taka,'B'),(m_may, id_motoki,'B'),(m_may, id_tanikai,'B'),(m_may, id_shunpei,'B'),(m_may, id_hideki,'B');
  INSERT INTO goals (match_id, member_id, scored_at) VALUES
    (m_may, id_mahiro,  ts + interval '45 seconds'),
    (m_may, id_mahiro,  ts + interval '110 seconds'),
    (m_may, id_shouta,  ts + interval '70 seconds'),
    (m_may, id_noza,    ts + interval '150 seconds'),
    (m_may, id_taka,    ts + interval '90 seconds'),
    (m_may, id_motoki,  ts + interval '130 seconds');
  INSERT INTO playing_intervals (match_id, member_id, started_at, ended_at)
    SELECT m_may, member_id, ts, te FROM match_lineups WHERE match_id = m_may;

  -- ================================================================
  -- 6月：町田
  -- ================================================================
  INSERT INTO events (event_date, notes) VALUES ('2026-06-14', '町田') RETURNING id INTO ev_jun;
  INSERT INTO event_participants (event_id, member_id) VALUES
    (ev_jun, id_mahiro),(ev_jun, id_shouta),(ev_jun, id_taka),
    (ev_jun, id_noza),(ev_jun, id_motoki),(ev_jun, id_rion),
    (ev_jun, id_tanikai),(ev_jun, id_shunpei),(ev_jun, id_mizota),(ev_jun, id_busshy);

  m_jun := gen_random_uuid();
  ts := '2026-06-14 10:00:00+09'; te := ts + interval '3 minutes';
  INSERT INTO matches (id, event_id, match_number, status, started_at, ended_at)
    VALUES (m_jun, ev_jun, 1, 'finished', ts, te);
  INSERT INTO match_lineups (match_id, member_id, team) VALUES
    (m_jun, id_mahiro,'A'),(m_jun, id_noza,'A'),(m_jun, id_tanikai,'A'),(m_jun, id_mizota,'A'),(m_jun, id_busshy,'A'),
    (m_jun, id_shouta,'B'),(m_jun, id_taka,'B'),(m_jun, id_motoki,'B'),(m_jun, id_rion,'B'),(m_jun, id_shunpei,'B');
  INSERT INTO goals (match_id, member_id, scored_at) VALUES
    (m_jun, id_mahiro,  ts + interval '30 seconds'),
    (m_jun, id_mahiro,  ts + interval '120 seconds'),
    (m_jun, id_noza,    ts + interval '80 seconds'),
    (m_jun, id_shouta,  ts + interval '100 seconds'),
    (m_jun, id_shouta,  ts + interval '155 seconds'),
    (m_jun, id_motoki,  ts + interval '60 seconds'),
    (m_jun, id_taka,    ts + interval '140 seconds');
  INSERT INTO playing_intervals (match_id, member_id, started_at, ended_at)
    SELECT m_jun, member_id, ts, te FROM match_lineups WHERE match_id = m_jun;

  -- ================================================================
  -- 7月：府中
  -- ================================================================
  INSERT INTO events (event_date, notes) VALUES ('2026-07-12', '府中') RETURNING id INTO ev_jul;
  INSERT INTO event_participants (event_id, member_id) VALUES
    (ev_jul, id_mahiro),(ev_jul, id_shouta),(ev_jul, id_taka),
    (ev_jul, id_noza),(ev_jul, id_motoki),(ev_jul, id_tanikai),
    (ev_jul, id_shunpei),(ev_jul, id_mizota),(ev_jul, id_rikuma),(ev_jul, id_hideki);

  m_jul := gen_random_uuid();
  ts := '2026-07-12 10:00:00+09'; te := ts + interval '3 minutes';
  INSERT INTO matches (id, event_id, match_number, status, started_at, ended_at)
    VALUES (m_jul, ev_jul, 1, 'finished', ts, te);
  INSERT INTO match_lineups (match_id, member_id, team) VALUES
    (m_jul, id_mahiro,'A'),(m_jul, id_shouta,'A'),(m_jul, id_tanikai,'A'),(m_jul, id_mizota,'A'),(m_jul, id_rikuma,'A'),
    (m_jul, id_taka,'B'),(m_jul, id_noza,'B'),(m_jul, id_motoki,'B'),(m_jul, id_shunpei,'B'),(m_jul, id_hideki,'B');
  INSERT INTO goals (match_id, member_id, scored_at) VALUES
    (m_jul, id_mahiro,  ts + interval '50 seconds'),
    (m_jul, id_shouta,  ts + interval '95 seconds'),
    (m_jul, id_shouta,  ts + interval '160 seconds'),
    (m_jul, id_noza,    ts + interval '35 seconds'),
    (m_jul, id_noza,    ts + interval '115 seconds'),
    (m_jul, id_motoki,  ts + interval '145 seconds'),
    (m_jul, id_taka,    ts + interval '75 seconds');
  INSERT INTO playing_intervals (match_id, member_id, started_at, ended_at)
    SELECT m_jul, member_id, ts, te FROM match_lineups WHERE match_id = m_jul;

  -- ================================================================
  -- 8月：川崎
  -- ================================================================
  INSERT INTO events (event_date, notes) VALUES ('2026-08-09', '川崎') RETURNING id INTO ev_aug;
  INSERT INTO event_participants (event_id, member_id) VALUES
    (ev_aug, id_mahiro),(ev_aug, id_shouta),(ev_aug, id_taka),
    (ev_aug, id_noza),(ev_aug, id_rion),(ev_aug, id_tanikai),
    (ev_aug, id_shunpei),(ev_aug, id_rikuma),(ev_aug, id_hideki),(ev_aug, id_busshy);

  m_aug := gen_random_uuid();
  ts := '2026-08-09 10:00:00+09'; te := ts + interval '3 minutes';
  INSERT INTO matches (id, event_id, match_number, status, started_at, ended_at)
    VALUES (m_aug, ev_aug, 1, 'finished', ts, te);
  INSERT INTO match_lineups (match_id, member_id, team) VALUES
    (m_aug, id_mahiro,'A'),(m_aug, id_taka,'A'),(m_aug, id_rion,'A'),(m_aug, id_shunpei,'A'),(m_aug, id_busshy,'A'),
    (m_aug, id_shouta,'B'),(m_aug, id_noza,'B'),(m_aug, id_tanikai,'B'),(m_aug, id_rikuma,'B'),(m_aug, id_hideki,'B');
  INSERT INTO goals (match_id, member_id, scored_at) VALUES
    (m_aug, id_mahiro,  ts + interval '40 seconds'),
    (m_aug, id_mahiro,  ts + interval '155 seconds'),
    (m_aug, id_rion,    ts + interval '100 seconds'),
    (m_aug, id_shouta,  ts + interval '30 seconds'),
    (m_aug, id_shouta,  ts + interval '120 seconds'),
    (m_aug, id_noza,    ts + interval '75 seconds'),
    (m_aug, id_tanikai, ts + interval '140 seconds');
  INSERT INTO playing_intervals (match_id, member_id, started_at, ended_at)
    SELECT m_aug, member_id, ts, te FROM match_lineups WHERE match_id = m_aug;

  -- ================================================================
  -- 9月：相模原
  -- ================================================================
  INSERT INTO events (event_date, notes) VALUES ('2026-09-13', '相模原') RETURNING id INTO ev_sep;
  INSERT INTO event_participants (event_id, member_id) VALUES
    (ev_sep, id_mahiro),(ev_sep, id_shouta),(ev_sep, id_taka),
    (ev_sep, id_noza),(ev_sep, id_motoki),(ev_sep, id_rion),
    (ev_sep, id_tanikai),(ev_sep, id_shunpei),(ev_sep, id_mizota),(ev_sep, id_busshy);

  m_sep := gen_random_uuid();
  ts := '2026-09-13 10:00:00+09'; te := ts + interval '3 minutes';
  INSERT INTO matches (id, event_id, match_number, status, started_at, ended_at)
    VALUES (m_sep, ev_sep, 1, 'finished', ts, te);
  INSERT INTO match_lineups (match_id, member_id, team) VALUES
    (m_sep, id_mahiro,'A'),(m_sep, id_noza,'A'),(m_sep, id_rion,'A'),(m_sep, id_mizota,'A'),(m_sep, id_busshy,'A'),
    (m_sep, id_shouta,'B'),(m_sep, id_taka,'B'),(m_sep, id_motoki,'B'),(m_sep, id_tanikai,'B'),(m_sep, id_shunpei,'B');
  INSERT INTO goals (match_id, member_id, scored_at) VALUES
    (m_sep, id_mahiro,  ts + interval '25 seconds'),
    (m_sep, id_mahiro,  ts + interval '130 seconds'),
    (m_sep, id_noza,    ts + interval '90 seconds'),
    (m_sep, id_rion,    ts + interval '155 seconds'),
    (m_sep, id_shouta,  ts + interval '55 seconds'),
    (m_sep, id_shouta,  ts + interval '170 seconds'),
    (m_sep, id_motoki,  ts + interval '85 seconds'),
    (m_sep, id_taka,    ts + interval '120 seconds');
  INSERT INTO playing_intervals (match_id, member_id, started_at, ended_at)
    SELECT m_sep, member_id, ts, te FROM match_lineups WHERE match_id = m_sep;

END $$;
