#!/usr/bin/env python3
"""
seed_players.py — Fetch squads for all 48 WC2026 teams from API-Football,
filter for forwards and midfielders, and upsert into `tournaments_players`.

Usage:
    cd sync
    cp .env.example .env        # fill in real values
    pip install -r requirements.txt
    python seed_players.py

This is a one-time script. Makes ~48 API calls (one per team).
Idempotent on `api_player_id` (upsert).

Hebrew names: loads from `he_player_names.json` (api_player_id → Hebrew name).
For unmapped players, `name_he` defaults to `name_en`.
"""

import json
import os
import sys
import time
from pathlib import Path

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

API_BASE = "https://v3.football.api-sports.io"
WC_LEAGUE_ID = 1  # FIFA World Cup
WC_SEASON = 2026

# Roles we keep (attacking players for Top Scorer / Top Assister dropdowns).
# GK and DF are excluded to keep the dropdown tractable.
KEEP_POSITIONS = {"Attacker", "Midfielder"}

# Map API-Football position strings to our role enum.
POSITION_TO_ROLE = {
    "Attacker": "FW",
    "Midfielder": "MF",
    "Defender": "DF",
    "Goalkeeper": "GK",
}

# Hebrew name overrides (loaded from JSON file).
HE_NAMES: dict[int, str] = {}
HE_NAMES_PATH = Path(__file__).parent / "he_player_names.json"


def load_he_names():
    """Load Hebrew player name overrides from JSON if the file exists."""
    global HE_NAMES
    if HE_NAMES_PATH.exists():
        with open(HE_NAMES_PATH, encoding="utf-8") as f:
            raw = json.load(f)
            # Keys in JSON are strings; convert to int.
            HE_NAMES = {int(k): v for k, v in raw.items()}
        print(f"Loaded {len(HE_NAMES)} Hebrew name overrides from {HE_NAMES_PATH.name}")
    else:
        print(f"No {HE_NAMES_PATH.name} found — all name_he will default to name_en.")


def fetch_team_ids():
    """Get all team IDs registered for the WC2026."""
    url = f"{API_BASE}/teams"
    params = {"league": WC_LEAGUE_ID, "season": WC_SEASON}
    headers = {"x-rapidapi-key": API_KEY, "x-rapidapi-host": "v3.football.api-sports.io"}

    print(f"Fetching team list: league={WC_LEAGUE_ID}, season={WC_SEASON} ...")
    resp = requests.get(url, params=params, headers=headers, timeout=30)
    resp.raise_for_status()
    data = resp.json()

    if data.get("errors"):
        print(f"API errors: {data['errors']}")
        sys.exit(1)

    teams = data.get("response", [])
    result = [(t["team"]["id"], t["team"]["name"]) for t in teams]
    print(f"Got {len(result)} teams.")
    return result


def fetch_squad(team_id: int):
    """Fetch the squad for a single team."""
    url = f"{API_BASE}/players/squads"
    params = {"team": team_id}
    headers = {"x-rapidapi-key": API_KEY, "x-rapidapi-host": "v3.football.api-sports.io"}

    resp = requests.get(url, params=params, headers=headers, timeout=30)
    resp.raise_for_status()
    data = resp.json()

    if data.get("errors"):
        print(f"  API errors for team {team_id}: {data['errors']}")
        return []

    response = data.get("response", [])
    if not response:
        return []

    return response[0].get("players", [])


def process_squad(team_name: str, players: list) -> list[dict]:
    """Filter to attacking players and map to our schema."""
    rows = []
    for p in players:
        position = p.get("position", "")
        if position not in KEEP_POSITIONS:
            continue

        api_id = p["id"]
        name_en = p["name"]
        name_he = HE_NAMES.get(api_id, name_en)
        role = POSITION_TO_ROLE.get(position, "MF")

        rows.append({
            "api_player_id": api_id,
            "name_en": name_en,
            "name_he": name_he,
            "team": team_name,
            "role": role,
        })

    return rows


def seed(all_rows: list[dict]):
    """Upsert player rows into tournaments_players."""
    sb = create_client(SUPABASE_URL, SUPABASE_KEY)

    if not all_rows:
        print("No player rows to seed.")
        return

    # Batch upsert (Supabase can handle a few hundred rows in one call).
    print(f"Upserting {len(all_rows)} players ...")
    result = sb.table("tournaments_players").upsert(
        all_rows,
        on_conflict="api_player_id",
        ignore_duplicates=False,
    ).execute()

    print(f"Done. Upserted {len(result.data)} rows.")


def main():
    load_he_names()
    teams = fetch_team_ids()

    all_rows = []
    for i, (team_id, team_name) in enumerate(teams, 1):
        print(f"[{i}/{len(teams)}] Fetching squad for {team_name} (id={team_id}) ...")
        players = fetch_squad(team_id)
        rows = process_squad(team_name, players)
        all_rows.extend(rows)
        print(f"  → {len(rows)} attackers/midfielders kept out of {len(players)} players.")

        # Polite rate-limiting: API-Football free tier is 10 req/min.
        if i < len(teams):
            time.sleep(7)  # ~8-9 req/min, comfortably under limit.

    seed(all_rows)
    print(f"seed_players.py complete. Total players seeded: {len(all_rows)}")


if __name__ == "__main__":
    main()
