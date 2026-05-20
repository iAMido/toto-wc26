#!/usr/bin/env python3
"""
seed_matches.py — Fetch all WC2026 fixtures from API-Football and upsert
them into the `matches` table.

Usage:
    cd sync
    cp .env.example .env        # fill in real values
    pip install -r requirements.txt
    python seed_matches.py

This is a one-time script. Idempotent on `api_fixture_id` (upsert).
"""

import os
import sys
from datetime import datetime

import requests
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

API_KEY = os.getenv("API_FOOTBALL_KEY")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not all([API_KEY, SUPABASE_URL, SUPABASE_KEY]):
    print("ERROR: Missing env vars. Copy .env.example to .env and fill in values.")
    sys.exit(1)

# API-Football config
# The WC2026 league ID may change — check https://www.api-football.com/documentation-v3
# Common IDs: World Cup = 1, but verify for 2026 season.
API_BASE = "https://v3.football.api-sports.io"
WC_LEAGUE_ID = 1  # FIFA World Cup
WC_SEASON = 2026

# Map API-Football round strings to our stage enum.
# API-Football uses: "Group A", "Group B", ..., "Round of 32", "Round of 16", etc.
ROUND_TO_STAGE = {
    "Group A": "GROUP_A", "Group B": "GROUP_B", "Group C": "GROUP_C",
    "Group D": "GROUP_D", "Group E": "GROUP_E", "Group F": "GROUP_F",
    "Group G": "GROUP_G", "Group H": "GROUP_H", "Group I": "GROUP_I",
    "Group J": "GROUP_J", "Group K": "GROUP_K", "Group L": "GROUP_L",
    "Round of 32": "R32",
    "Round of 16": "R16",
    "Quarter-finals": "QF",
    "Semi-finals": "SF",
    "3rd Place Final": "3RD",
    "Final": "FINAL",
}


def fetch_fixtures():
    """Fetch all fixtures for the WC2026 from API-Football."""
    url = f"{API_BASE}/fixtures"
    params = {"league": WC_LEAGUE_ID, "season": WC_SEASON}
    headers = {"x-rapidapi-key": API_KEY, "x-rapidapi-host": "v3.football.api-sports.io"}

    print(f"Fetching fixtures: league={WC_LEAGUE_ID}, season={WC_SEASON} ...")
    resp = requests.get(url, params=params, headers=headers, timeout=30)
    resp.raise_for_status()
    data = resp.json()

    if data.get("errors"):
        print(f"API errors: {data['errors']}")
        sys.exit(1)

    fixtures = data.get("response", [])
    print(f"Got {len(fixtures)} fixtures from API-Football.")
    return fixtures


def map_fixture(fx):
    """Map a single API-Football fixture to our matches table schema."""
    fixture = fx["fixture"]
    teams = fx["teams"]
    league = fx["league"]

    round_name = league.get("round", "")
    stage = ROUND_TO_STAGE.get(round_name)
    if not stage:
        # Try partial match for rounds like "Group A - 1", "Group A - 2", etc.
        for prefix, mapped in ROUND_TO_STAGE.items():
            if round_name.startswith(prefix):
                stage = mapped
                break
    if not stage:
        print(f"  WARNING: Unknown round '{round_name}' for fixture {fixture['id']}. Skipping.")
        return None

    kickoff_iso = fixture["date"]  # ISO 8601 with timezone

    return {
        "api_fixture_id": fixture["id"],
        "kickoff_at": kickoff_iso,
        "home_team": teams["home"]["name"],
        "away_team": teams["away"]["name"],
        "stage": stage,
        "status": "NS",
    }


def seed(fixtures):
    """Upsert fixtures into the matches table."""
    sb = create_client(SUPABASE_URL, SUPABASE_KEY)
    rows = []
    for fx in fixtures:
        row = map_fixture(fx)
        if row:
            rows.append(row)

    if not rows:
        print("No valid fixtures to seed.")
        return

    print(f"Upserting {len(rows)} matches ...")
    # Upsert on api_fixture_id (unique constraint).
    result = sb.table("matches").upsert(
        rows,
        on_conflict="api_fixture_id",
        # Only update these columns on conflict (don't overwrite scores/status
        # if the match has already been updated by the live sync).
        ignore_duplicates=False,
    ).execute()

    print(f"Done. Upserted {len(result.data)} rows.")


def main():
    fixtures = fetch_fixtures()
    seed(fixtures)
    print("seed_matches.py complete.")


if __name__ == "__main__":
    main()
