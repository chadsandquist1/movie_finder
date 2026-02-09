#!/usr/bin/env python3
"""Seed DynamoDB with theatrical movies (2020-2026) that earned $20M+ from TMDB.

Skips documentaries and non-English-language films.

Usage:
    export TMDB_API_KEY=your_key_here
    python scripts/seed_from_tmdb.py

    # or pass inline
    python scripts/seed_from_tmdb.py --api-key your_key_here

    # custom table / region
    python scripts/seed_from_tmdb.py --table movie-finder-dev-movies --region us-east-1

Get a free API key at: https://www.themoviedb.org/settings/api
"""

import argparse
import os
import random
import subprocess
import time
import uuid
from decimal import Decimal

import boto3
import requests

TMDB_BASE = "https://api.themoviedb.org/3"
MIN_REVENUE = 20_000_000
YEARS = range(2020, 2027)
DOCUMENTARY_GENRE_ID = 99
STATUSES = ["active", "recentlyWatched", "notInterested"]
BASE62 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"

# Rate limiting: TMDB allows ~40 requests per 10 seconds
REQUEST_DELAY = 0.26  # ~3.8 req/s, stays under limit


def rank_for_index(i):
    d1 = BASE62[i // 62]
    d2 = BASE62[i % 62]
    return f"a{d1}{d2}"


def get_table_name():
    try:
        result = subprocess.run(
            ["terraform", "output", "-raw", "dynamodb_table_name"],
            capture_output=True, text=True,
            cwd=str(__import__("pathlib").Path(__file__).resolve().parent.parent / "terraform"),
        )
        if result.returncode == 0 and result.stdout.strip():
            return result.stdout.strip()
    except FileNotFoundError:
        pass
    return "movie-finder-dev-movies"


def tmdb_get(path, api_key, params=None):
    """Make a TMDB API request with rate limiting."""
    time.sleep(REQUEST_DELAY)
    headers = {"Authorization": f"Bearer {api_key}"}
    url = f"{TMDB_BASE}{path}"
    resp = requests.get(url, headers=headers, params=params or {})
    resp.raise_for_status()
    return resp.json()


def fetch_genre_map(api_key):
    """Fetch TMDB genre ID -> name mapping."""
    data = tmdb_get("/genre/movie/list", api_key, {"language": "en-US"})
    return {g["id"]: g["name"] for g in data["genres"]}


def discover_year(api_key, year):
    """Discover theatrical English-language movies for a year, sorted by revenue desc."""
    all_results = []
    page = 1
    while True:
        data = tmdb_get("/discover/movie", api_key, {
            "primary_release_year": year,
            "sort_by": "revenue.desc",
            "with_original_language": "en",
            "without_genres": str(DOCUMENTARY_GENRE_ID),
            "with_release_type": "3",  # theatrical
            "page": page,
        })
        results = data.get("results", [])
        if not results:
            break
        all_results.extend(results)
        total_pages = data.get("total_pages", 1)
        # Stop after enough pages — movies are sorted by revenue desc,
        # so later pages have diminishing revenue. 15 pages = 300 movies per year.
        if page >= min(total_pages, 15):
            break
        page += 1
    return all_results


def fetch_movie_details(api_key, movie_id):
    """Fetch full movie details + credits in a single API call."""
    return tmdb_get(f"/movie/{movie_id}", api_key, {
        "append_to_response": "credits",
        "language": "en-US",
    })


def extract_director(details):
    """Extract director name from movie credits."""
    credits = details.get("credits", {})
    for person in credits.get("crew", []):
        if person.get("job") == "Director":
            return person.get("name", "Unknown")
    return "Unknown"


def extract_genre(details, genre_map):
    """Extract primary genre name."""
    genres = details.get("genres", [])
    if genres:
        return genres[0].get("name", "Unknown")
    # Fallback to genre_ids from discover
    genre_ids = details.get("genre_ids", [])
    if genre_ids:
        return genre_map.get(genre_ids[0], "Unknown")
    return "Unknown"


def main():
    parser = argparse.ArgumentParser(description="Seed DynamoDB from TMDB")
    parser.add_argument("--api-key", default=os.environ.get("TMDB_API_KEY"),
                        help="TMDB API key (or set TMDB_API_KEY env var)")
    parser.add_argument("--table", help="DynamoDB table name")
    parser.add_argument("--region", default="us-east-1", help="AWS region")
    parser.add_argument("--dry-run", action="store_true",
                        help="Fetch from TMDB but don't write to DynamoDB")
    args = parser.parse_args()

    if not args.api_key:
        print("Error: TMDB API key required.")
        print("  export TMDB_API_KEY=your_key")
        print("  or pass --api-key your_key")
        print("  Get one free at: https://www.themoviedb.org/settings/api")
        raise SystemExit(1)

    api_key = args.api_key
    table_name = args.table or get_table_name()

    print("Fetching genre list...")
    genre_map = fetch_genre_map(api_key)
    print(f"  {len(genre_map)} genres loaded")

    # Discover movies by year
    qualifying = []
    for year in YEARS:
        print(f"\nDiscovering {year}...")
        candidates = discover_year(api_key, year)
        print(f"  {len(candidates)} candidates found, fetching details...")

        year_count = 0
        below_threshold_streak = 0
        for i, movie in enumerate(candidates):
            details = fetch_movie_details(api_key, movie["id"])
            revenue = details.get("revenue", 0)

            if revenue < MIN_REVENUE:
                below_threshold_streak += 1
                # If we've seen 10 consecutive movies below threshold, stop
                # (they're sorted by revenue desc)
                if below_threshold_streak >= 10:
                    break
                continue

            below_threshold_streak = 0
            runtime = details.get("runtime", 0)
            # Skip TV movies or very short films
            if runtime and runtime < 60:
                continue

            director = extract_director(details)
            genre = extract_genre(details, genre_map)
            rating = round(details.get("vote_average", 0), 1)

            qualifying.append({
                "title": details["title"],
                "year": year,
                "genre": genre,
                "rating": rating,
                "director": director,
                "revenue": revenue,
            })
            year_count += 1

            if (i + 1) % 20 == 0:
                print(f"    ... processed {i + 1}/{len(candidates)}, {year_count} qualifying")

        print(f"  {year_count} movies qualified for {year}")

    print(f"\nTotal qualifying movies: {len(qualifying)}")

    if args.dry_run:
        print("\n[DRY RUN] Would write these movies:")
        for m in qualifying[:20]:
            print(f"  {m['title']} ({m['year']}) - ${m['revenue']:,.0f} - {m['genre']} - {m['director']}")
        if len(qualifying) > 20:
            print(f"  ... and {len(qualifying) - 20} more")
        return

    # Assign random statuses and ranks
    random.seed(42)
    random.shuffle(qualifying)

    groups = {s: [] for s in STATUSES}
    for movie in qualifying:
        r = random.random()
        if r < 0.40:
            groups["active"].append(movie)
        elif r < 0.75:
            groups["recentlyWatched"].append(movie)
        else:
            groups["notInterested"].append(movie)

    # Write to DynamoDB
    print(f"\nWriting to table: {table_name} in {args.region}")
    dynamodb = boto3.resource("dynamodb", region_name=args.region)
    table = dynamodb.Table(table_name)

    written = 0
    with table.batch_writer() as batch:
        for status, movie_list in groups.items():
            for i, movie in enumerate(movie_list):
                batch.put_item(Item={
                    "movie_id": str(uuid.uuid4()),
                    "status": status,
                    "rank": rank_for_index(i),
                    "title": movie["title"],
                    "year": movie["year"],
                    "genre": movie["genre"],
                    "rating": Decimal(str(movie["rating"])),
                    "director": movie["director"],
                })
                written += 1

    for status in STATUSES:
        print(f"  {status}: {len(groups[status])} movies")
    print(f"Done! Wrote {written} movies total.")


if __name__ == "__main__":
    main()
