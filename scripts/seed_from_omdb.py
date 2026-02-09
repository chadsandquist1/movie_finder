#!/usr/bin/env python3
"""Seed DynamoDB with theatrical movies (2020-2026) earning $20M+ via OMDB API.

Skips documentaries and foreign-language films.

Usage:
    export OMDB_API_KEY=your_key_here
    python scripts/seed_from_omdb.py

    python scripts/seed_from_omdb.py --api-key your_key --dry-run   # preview only
    python scripts/seed_from_omdb.py --api-key your_key              # write to DynamoDB

Get a free API key at: https://www.omdbapi.com/apikey.aspx (1,000 req/day free)
"""

import argparse
import json
import os
import random
import re
import subprocess
import sys
import time
import uuid
from decimal import Decimal

import boto3
import requests

OMDB_BASE = "https://www.omdbapi.com/"
MIN_REVENUE = 20_000_000
STATUSES = ["active", "recentlyWatched", "notInterested"]
BASE62 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"
REQUEST_DELAY = 0.12  # stay well under free tier limits

# ---------------------------------------------------------------------------
# Comprehensive list of English-language theatrical releases 2020-2026
# (title, year) — OMDB provides director, genre, rating, box office
# ---------------------------------------------------------------------------
CANDIDATES = [
    # 2026
    ("Avatar: Fire and Ash", 2026),
    ("The Batman Part II", 2026),
    ("Zootopia 2", 2026),
    ("Ice Age 6", 2026),
    # 2025
    ("Sinners", 2025),
    ("Thunderbolts*", 2025),
    ("Mission: Impossible - The Final Reckoning", 2025),
    ("The Amateur", 2025),
    ("Ballerina", 2025),
    ("Elio", 2025),
    ("The Fantastic Four: First Steps", 2025),
    ("Superman", 2025),
    ("Lilo & Stitch", 2025),
    ("How to Train Your Dragon", 2025),
    ("Captain America: Brave New World", 2025),
    ("Paddington in Peru", 2025),
    ("Snow White", 2025),
    ("A Minecraft Movie", 2025),
    ("Karate Kid: Legends", 2025),
    ("Jurassic World Rebirth", 2025),
    ("28 Years Later", 2025),
    ("F1", 2025),
    ("The Bride", 2025),
    ("Tron: Ares", 2025),
    ("Blade", 2025),
    ("Wicked: For Good", 2025),
    ("Toy Story 5", 2025),
    ("The Running Man", 2025),
    ("Freaky Friday 2", 2025),
    # 2024
    ("Dune: Part Two", 2024),
    ("Inside Out 2", 2024),
    ("Deadpool & Wolverine", 2024),
    ("Moana 2", 2024),
    ("Despicable Me 4", 2024),
    ("Wicked", 2024),
    ("Beetlejuice Beetlejuice", 2024),
    ("Gladiator II", 2024),
    ("Kung Fu Panda 4", 2024),
    ("Godzilla x Kong: The New Empire", 2024),
    ("Twisters", 2024),
    ("A Quiet Place: Day One", 2024),
    ("Bad Boys: Ride or Die", 2024),
    ("The Wild Robot", 2024),
    ("It Ends with Us", 2024),
    ("Wonka", 2024),
    ("Alien: Romulus", 2024),
    ("Ghostbusters: Frozen Empire", 2024),
    ("Kingdom of the Planet of the Apes", 2024),
    ("Venom: The Last Dance", 2024),
    ("The Garfield Movie", 2024),
    ("Furiosa: A Mad Max Saga", 2024),
    ("Abigail", 2024),
    ("IF", 2024),
    ("Nosferatu", 2024),
    ("Joker: Folie à Deux", 2024),
    ("Mufasa: The Lion King", 2024),
    ("Sonic the Hedgehog 3", 2024),
    ("Aquaman and the Lost Kingdom", 2024),
    ("The Fall Guy", 2024),
    ("Challengers", 2024),
    ("Civil War", 2024),
    ("Fly Me to the Moon", 2024),
    ("Trap", 2024),
    ("The Substance", 2024),
    ("Anora", 2024),
    ("Conclave", 2024),
    ("A Real Pain", 2024),
    ("Emilia Pérez", 2024),
    ("The Brutalist", 2024),
    ("Smile 2", 2024),
    ("Terrifier 3", 2024),
    ("Lisa Frankenstein", 2024),
    ("Bob Marley: One Love", 2024),
    ("Argylle", 2024),
    ("Madame Web", 2024),
    ("Imaginary", 2024),
    ("Immaculate", 2024),
    ("The Beekeeper", 2024),
    ("Anyone But You", 2024),
    ("Migration", 2024),
    ("Mean Girls", 2024),
    ("Land of Bad", 2024),
    ("Love Lies Bleeding", 2024),
    ("Monkey Man", 2024),
    ("Wolfs", 2024),
    ("Red One", 2024),
    ("Kraven the Hunter", 2024),
    ("Heretic", 2024),
    # 2023
    ("Barbie", 2023),
    ("Oppenheimer", 2023),
    ("The Super Mario Bros. Movie", 2023),
    ("Guardians of the Galaxy Vol. 3", 2023),
    ("Spider-Man: Across the Spider-Verse", 2023),
    ("The Little Mermaid", 2023),
    ("Mission: Impossible - Dead Reckoning Part One", 2023),
    ("Ant-Man and the Wasp: Quantumania", 2023),
    ("John Wick: Chapter 4", 2023),
    ("Elemental", 2023),
    ("Indiana Jones and the Dial of Destiny", 2023),
    ("Creed III", 2023),
    ("Scream VI", 2023),
    ("Wish", 2023),
    ("The Hunger Games: The Ballad of Songbirds & Snakes", 2023),
    ("Killers of the Flower Moon", 2023),
    ("Napoleon", 2023),
    ("Sound of Freedom", 2023),
    ("Wonka", 2023),
    ("The Marvels", 2023),
    ("Aquaman and the Lost Kingdom", 2023),
    ("A Haunting in Venice", 2023),
    ("Cocaine Bear", 2023),
    ("Meg 2: The Trench", 2023),
    ("Teenage Mutant Ninja Turtles: Mutant Mayhem", 2023),
    ("Transformers: Rise of the Beasts", 2023),
    ("The Equalizer 3", 2023),
    ("Insidious: The Red Door", 2023),
    ("The Nun II", 2023),
    ("Blue Beetle", 2023),
    ("Expend4bles", 2023),
    ("65", 2023),
    ("Shazam! Fury of the Gods", 2023),
    ("The Flash", 2023),
    ("Haunted Mansion", 2023),
    ("No Hard Feelings", 2023),
    ("Five Nights at Freddy's", 2023),
    ("Saw X", 2023),
    ("Talk to Me", 2023),
    ("Gran Turismo", 2023),
    ("Puss in Boots: The Last Wish", 2023),
    ("M3GAN", 2023),
    ("Knock at the Cabin", 2023),
    ("80 for Brady", 2023),
    ("Anyone But You", 2023),
    ("Poor Things", 2023),
    ("The Holdovers", 2023),
    ("Past Lives", 2023),
    ("Anatomy of a Fall", 2023),
    ("American Fiction", 2023),
    ("May December", 2023),
    ("The Iron Claw", 2023),
    ("Saltburn", 2023),
    ("The Killer", 2023),
    ("Maestro", 2023),
    ("Priscilla", 2023),
    ("The Zone of Interest", 2023),
    ("The Color Purple", 2023),
    ("Ferrari", 2023),
    ("Dream Scenario", 2023),
    ("Bottoms", 2023),
    ("Theater Camp", 2023),
    ("Are You There God? It's Me, Margaret.", 2023),
    ("Joy Ride", 2023),
    ("Strays", 2023),
    ("The Exorcist: Believer", 2023),
    ("The Creator", 2023),
    ("Dumb Money", 2023),
    ("Pain Hustlers", 2023),
    ("Migration", 2023),
    # 2022
    ("Top Gun: Maverick", 2022),
    ("Avatar: The Way of Water", 2022),
    ("Black Panther: Wakanda Forever", 2022),
    ("Doctor Strange in the Multiverse of Madness", 2022),
    ("Jurassic World Dominion", 2022),
    ("The Batman", 2022),
    ("Thor: Love and Thunder", 2022),
    ("Minions: The Rise of Gru", 2022),
    ("Sonic the Hedgehog 2", 2022),
    ("Black Adam", 2022),
    ("Bullet Train", 2022),
    ("Elvis", 2022),
    ("Nope", 2022),
    ("The Lost City", 2022),
    ("Uncharted", 2022),
    ("Smile", 2022),
    ("Everything Everywhere All at Once", 2022),
    ("The Banshees of Inisherin", 2022),
    ("Tár", 2022),
    ("The Whale", 2022),
    ("Glass Onion: A Knives Out Mystery", 2022),
    ("Triangle of Sadness", 2022),
    ("All Quiet on the Western Front", 2022),
    ("The Fabelmans", 2022),
    ("Women Talking", 2022),
    ("Babylon", 2022),
    ("Puss in Boots: The Last Wish", 2022),
    ("Lightyear", 2022),
    ("DC League of Super-Pets", 2022),
    ("Morbius", 2022),
    ("Fantastic Beasts: The Secrets of Dumbledore", 2022),
    ("Where the Crawdads Sing", 2022),
    ("The Woman King", 2022),
    ("Ticket to Paradise", 2022),
    ("Don't Worry Darling", 2022),
    ("Halloween Ends", 2022),
    ("Scream", 2022),
    ("Lyle, Lyle, Crocodile", 2022),
    ("The Bad Guys", 2022),
    ("Dog", 2022),
    ("The Menu", 2022),
    ("Violent Night", 2022),
    ("The Northman", 2022),
    ("Ambulance", 2022),
    ("Marcel the Shell with Shoes On", 2022),
    ("Aftersun", 2022),
    ("Decision to Leave", 2022),
    ("RRR", 2022),
    ("Prey", 2022),
    ("Bodies Bodies Bodies", 2022),
    ("Pearl", 2022),
    ("X", 2022),
    ("Barbarian", 2022),
    ("Bros", 2022),
    ("She Said", 2022),
    ("Amsterdam", 2022),
    ("Strange World", 2022),
    ("Devotion", 2022),
    ("Whitney Houston: I Wanna Dance with Somebody", 2022),
    ("Easter Sunday", 2022),
    ("Mr. Harrigan's Phone", 2022),
    ("Moonfall", 2022),
    ("Memory", 2022),
    # 2021
    ("Spider-Man: No Way Home", 2021),
    ("Shang-Chi and the Legend of the Ten Rings", 2021),
    ("No Time to Die", 2021),
    ("Venom: Let There Be Carnage", 2021),
    ("Black Widow", 2021),
    ("F9: The Fast Saga", 2021),
    ("Eternals", 2021),
    ("Dune", 2021),
    ("Godzilla vs. Kong", 2021),
    ("Free Guy", 2021),
    ("A Quiet Place Part II", 2021),
    ("The Suicide Squad", 2021),
    ("Ghostbusters: Afterlife", 2021),
    ("The Conjuring: The Devil Made Me Do It", 2021),
    ("Jungle Cruise", 2021),
    ("Cruella", 2021),
    ("Sing 2", 2021),
    ("The Boss Baby: Family Business", 2021),
    ("Raya and the Last Dragon", 2021),
    ("Space Jam: A New Legacy", 2021),
    ("Encanto", 2021),
    ("The Matrix Resurrections", 2021),
    ("House of Gucci", 2021),
    ("West Side Story", 2021),
    ("King Richard", 2021),
    ("The Power of the Dog", 2021),
    ("Belfast", 2021),
    ("Licorice Pizza", 2021),
    ("CODA", 2021),
    ("Don't Look Up", 2021),
    ("The French Dispatch", 2021),
    ("Nightmare Alley", 2021),
    ("The Last Duel", 2021),
    ("Spencer", 2021),
    ("Drive My Car", 2021),
    ("The Worst Person in the World", 2021),
    ("Tick, Tick... Boom!", 2021),
    ("The Tragedy of Macbeth", 2021),
    ("C'mon C'mon", 2021),
    ("Flee", 2021),
    ("Clifford the Big Red Dog", 2021),
    ("Old", 2021),
    ("The Addams Family 2", 2021),
    ("Ron's Gone Wrong", 2021),
    ("Luca", 2021),
    ("Tom and Jerry", 2021),
    ("Mortal Kombat", 2021),
    ("Nobody", 2021),
    ("Wrath of Man", 2021),
    ("Snake Eyes: G.I. Joe Origins", 2021),
    ("The Many Saints of Newark", 2021),
    ("Cry Macho", 2021),
    ("Reminiscence", 2021),
    ("Spiral: From the Book of Saw", 2021),
    ("The Green Knight", 2021),
    ("Respect", 2021),
    ("Stillwater", 2021),
    ("In the Heights", 2021),
    ("Dear Evan Hansen", 2021),
    ("Last Night in Soho", 2021),
    ("Candyman", 2021),
    ("Malignant", 2021),
    ("Halloween Kills", 2021),
    ("Antlers", 2021),
    # 2020
    ("Bad Boys for Life", 2020),
    ("Sonic the Hedgehog", 2020),
    ("Birds of Prey", 2020),
    ("Tenet", 2020),
    ("Wonder Woman 1984", 2020),
    ("The Invisible Man", 2020),
    ("The Croods: A New Age", 2020),
    ("Monster Hunter", 2020),
    ("Onward", 2020),
    ("The Call of the Wild", 2020),
    ("Dolittle", 2020),
    ("Bloodshot", 2020),
    ("The Gentlemen", 2020),
    ("The New Mutants", 2020),
    ("Mulan", 2020),
    ("Soul", 2020),
    ("Nomadland", 2020),
    ("Promising Young Woman", 2020),
    ("The Father", 2020),
    ("Minari", 2020),
    ("Sound of Metal", 2020),
    ("Judas and the Black Messiah", 2020),
    ("Mank", 2020),
    ("The Trial of the Chicago 7", 2020),
    ("Another Round", 2020),
    ("My Hero Academia: Heroes Rising", 2020),
    ("Unhinged", 2020),
    ("Trolls World Tour", 2020),
    ("The War with Grandpa", 2020),
    ("Scoob!", 2020),
    ("Greenland", 2020),
    ("Fantasy Island", 2020),
    ("Brahms: The Boy II", 2020),
    ("Come Play", 2020),
    ("Freaky", 2020),
    ("News of the World", 2020),
    ("One Night in Miami", 2020),
    ("Pieces of a Woman", 2020),
    ("Palm Springs", 2020),
    ("Borat Subsequent Moviefilm", 2020),
    ("I'm Thinking of Ending Things", 2020),
    ("Da 5 Bloods", 2020),
    ("Extraction", 2020),
    ("The Old Guard", 2020),
    ("Enola Holmes", 2020),
    ("The Devil All the Time", 2020),
    ("Hillbilly Elegy", 2020),
    ("Ma Rainey's Black Bottom", 2020),
    ("Let Him Go", 2020),
    ("The Marksman", 2020),
    ("The Midnight Sky", 2020),
    ("Monster Hunter", 2020),
]


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


def parse_box_office(value):
    """Parse OMDB BoxOffice string like '$316,000,000' to int."""
    if not value or value == "N/A":
        return None
    return int(re.sub(r"[^\d]", "", value))


def fetch_movie(api_key, title, year):
    """Fetch movie details from OMDB."""
    time.sleep(REQUEST_DELAY)
    resp = requests.get(OMDB_BASE, params={
        "apikey": api_key,
        "t": title,
        "y": year,
        "type": "movie",
        "plot": "short",
    })
    resp.raise_for_status()
    data = resp.json()
    if data.get("Response") == "False":
        return None
    return data


def main():
    parser = argparse.ArgumentParser(description="Seed DynamoDB from OMDB")
    parser.add_argument("--api-key", default=os.environ.get("OMDB_API_KEY"),
                        help="OMDB API key (or set OMDB_API_KEY env var)")
    parser.add_argument("--table", help="DynamoDB table name")
    parser.add_argument("--region", default="us-east-1", help="AWS region")
    parser.add_argument("--dry-run", action="store_true",
                        help="Fetch from OMDB but don't write to DynamoDB")
    args = parser.parse_args()

    if not args.api_key:
        print("Error: OMDB API key required.")
        print("  export OMDB_API_KEY=your_key")
        print("  or pass --api-key your_key")
        print("  Get one free at: https://www.omdbapi.com/apikey.aspx")
        raise SystemExit(1)

    api_key = args.api_key
    table_name = args.table or get_table_name()

    # Deduplicate candidates
    seen = set()
    unique_candidates = []
    for title, year in CANDIDATES:
        key = (title.lower(), year)
        if key not in seen:
            seen.add(key)
            unique_candidates.append((title, year))

    print(f"Fetching {len(unique_candidates)} movies from OMDB...")

    qualifying = []
    skipped_revenue = 0
    skipped_genre = 0
    skipped_not_found = 0

    for i, (title, year) in enumerate(unique_candidates):
        data = fetch_movie(api_key, title, year)

        if not data:
            skipped_not_found += 1
            continue

        # Skip documentaries
        genre = data.get("Genre", "")
        if "Documentary" in genre:
            skipped_genre += 1
            continue

        # Check box office
        box_office = parse_box_office(data.get("BoxOffice"))
        if box_office is not None and box_office < MIN_REVENUE:
            skipped_revenue += 1
            continue

        # Extract first genre
        primary_genre = genre.split(",")[0].strip() if genre and genre != "N/A" else "Drama"

        # Parse rating
        imdb_rating = data.get("imdbRating", "0")
        try:
            rating = float(imdb_rating)
        except (ValueError, TypeError):
            rating = 0.0

        director = data.get("Director", "Unknown")
        if director == "N/A":
            director = "Unknown"
        # If multiple directors, take first
        director = director.split(",")[0].strip()

        actual_year = year
        released_year = data.get("Year", "")
        if released_year and released_year.isdigit():
            actual_year = int(released_year)

        qualifying.append({
            "title": data.get("Title", title),
            "year": actual_year,
            "genre": primary_genre,
            "rating": round(rating, 1),
            "director": director,
            "box_office": box_office,
        })

        if (i + 1) % 50 == 0:
            print(f"  ... processed {i + 1}/{len(unique_candidates)}, "
                  f"{len(qualifying)} qualifying so far")

    print(f"\nResults:")
    print(f"  Qualifying: {len(qualifying)}")
    print(f"  Skipped (revenue < $20M): {skipped_revenue}")
    print(f"  Skipped (documentary): {skipped_genre}")
    print(f"  Skipped (not found): {skipped_not_found}")
    # Movies with no box office data still included (likely qualify but OMDB lacks data)
    no_bo = sum(1 for m in qualifying if m["box_office"] is None)
    if no_bo:
        print(f"  Included without box office data: {no_bo} (likely qualify)")

    if args.dry_run:
        print(f"\n[DRY RUN] Would write {len(qualifying)} movies:")
        for m in sorted(qualifying, key=lambda x: (x["year"], x["title"])):
            bo = f"${m['box_office']:,.0f}" if m["box_office"] else "N/A"
            print(f"  {m['year']} | {m['title']:<50} | {bo:>15} | {m['genre']:<12} | {m['director']}")
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
