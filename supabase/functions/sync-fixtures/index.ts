// supabase/functions/sync-fixtures/index.ts
//
// Live sync Edge Function — called every 20 min by pg_cron during match windows.
// Checks for active matches within ±3h of now, then makes a single API-Football
// call per day-bucket to update statuses. When a match flips to FT (group stage)
// or AET/PEN (knockouts), the DB UPDATE fires the scoring trigger automatically.
//
// Env vars (auto-injected by Supabase runtime):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// Env vars (set via `supabase secrets set`):
//   API_FOOTBALL_KEY

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const API_KEY = Deno.env.get("API_FOOTBALL_KEY")!;
const API_BASE = "https://v3.football.api-sports.io";

// Statuses that mean "this match is fully decided — no more updates needed".
const TERMINAL_STATUSES = new Set(["FT", "AET", "PEN", "PST", "CANC", "ABD", "AWD", "WO"]);

Deno.serve(async (_req: Request) => {
  try {
    const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

    // 1. Find matches that could be active right now (kickoff ±3h, not terminated).
    const now = new Date();
    const windowStart = new Date(now.getTime() - 3 * 3600 * 1000).toISOString();
    const windowEnd = new Date(now.getTime() + 3 * 3600 * 1000).toISOString();

    const { data: activeMatches, error: fetchErr } = await sb
      .from("matches")
      .select("id, api_fixture_id, status")
      .gte("kickoff_at", windowStart)
      .lte("kickoff_at", windowEnd)
      .not("status", "in", `(${[...TERMINAL_STATUSES].join(",")})`);

    if (fetchErr) throw fetchErr;
    if (!activeMatches || activeMatches.length === 0) {
      return new Response(JSON.stringify({ status: "idle", reason: "no active matches in window" }));
    }

    // 2. Determine unique dates to query. Usually just today, but could span
    //    midnight if matches are at 23:00 and 01:00.
    const datesToQuery = new Set<string>();
    // Use today in UTC as the primary date.
    datesToQuery.add(now.toISOString().slice(0, 10));

    // 3. For each date, make a single API call.
    let updatedCount = 0;
    const activeFixtureIds = new Set(activeMatches.map((m) => m.api_fixture_id));

    for (const date of datesToQuery) {
      const apiUrl = `${API_BASE}/fixtures?date=${date}`;
      const resp = await fetch(apiUrl, {
        headers: {
          "x-rapidapi-key": API_KEY,
          "x-rapidapi-host": "v3.football.api-sports.io",
        },
      });

      if (!resp.ok) {
        console.error(`API-Football error: ${resp.status} ${resp.statusText}`);
        continue;
      }

      const json = await resp.json();
      const fixtures = json.response ?? [];

      for (const fx of fixtures) {
        const fixtureId: number = fx.fixture.id;
        if (!activeFixtureIds.has(fixtureId)) continue;

        const apiStatus: string = fx.fixture.status.short;
        const homeScore120: number | null = fx.score.fulltime?.home ?? fx.goals?.home ?? null;
        const awayScore120: number | null = fx.score.fulltime?.away ?? fx.goals?.away ?? null;

        // For AET, use extra-time score if available.
        const etHome: number | null = fx.score.extratime?.home ?? null;
        const etAway: number | null = fx.score.extratime?.away ?? null;
        const finalHome = etHome !== null ? (fx.score.fulltime?.home ?? 0) + etHome : homeScore120;
        const finalAway = etAway !== null ? (fx.score.fulltime?.away ?? 0) + etAway : awayScore120;

        // Determine the penalty-winner team (only when status is PEN).
        let advancerTeamId: string | null = null;
        if (apiStatus === "PEN") {
          if (fx.teams.home.winner === true) {
            advancerTeamId = fx.teams.home.name;
          } else if (fx.teams.away.winner === true) {
            advancerTeamId = fx.teams.away.name;
          }
        }

        // Only update if we have a meaningful status change.
        if (!TERMINAL_STATUSES.has(apiStatus) && apiStatus === "NS") continue;

        const { error: updateErr } = await sb
          .from("matches")
          .update({
            status: apiStatus,
            home_score_120: finalHome,
            away_score_120: finalAway,
            advancer_team_id: advancerTeamId,
          })
          .eq("api_fixture_id", fixtureId);

        if (updateErr) {
          console.error(`Failed to update fixture ${fixtureId}:`, updateErr);
        } else {
          updatedCount++;
          console.log(`Updated fixture ${fixtureId} → status=${apiStatus}, score=${finalHome}-${finalAway}`);
        }
      }
    }

    return new Response(
      JSON.stringify({
        status: "ok",
        activeInWindow: activeMatches.length,
        updatedCount,
        queriedDates: [...datesToQuery],
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("sync-fixtures error:", err);
    return new Response(JSON.stringify({ status: "error", message: String(err) }), { status: 500 });
  }
});
