#!/usr/bin/env python3
"""Find and remove duplicate queue entries (same user + movie_id in multiple lists).

For each (username, movie_id) pair with multiple entries, keeps the first one
(by sk sort order) and deletes the rest.

Usage:
    python scripts/dedup_queue.py                          # scan all users
    python scripts/dedup_queue.py --username chad           # single user
    python scripts/dedup_queue.py --dry-run                 # preview only
    python scripts/dedup_queue.py --queue-table my-queue    # explicit table name
    python scripts/dedup_queue.py --region us-west-2        # explicit region
"""

import argparse
import subprocess
from collections import defaultdict

import boto3


def get_table_name(output_name):
    """Try to read a table name from terraform output."""
    try:
        result = subprocess.run(
            ["terraform", "output", "-raw", output_name],
            capture_output=True,
            text=True,
            cwd=str(__import__("pathlib").Path(__file__).resolve().parent.parent / "terraform"),
        )
        if result.returncode == 0 and result.stdout.strip():
            return result.stdout.strip()
    except FileNotFoundError:
        pass
    return None


def main():
    parser = argparse.ArgumentParser(description="Remove duplicate queue entries")
    parser.add_argument("--queue-table", help="DynamoDB queue table name")
    parser.add_argument("--username", help="Only check this username (default: all users)")
    parser.add_argument("--region", default="us-east-1", help="AWS region")
    parser.add_argument("--dry-run", action="store_true", help="Preview duplicates without deleting")
    args = parser.parse_args()

    queue_table_name = args.queue_table or get_table_name("queue_table_name") or "movie-finder-dev-queue"
    print(f"Queue table: {queue_table_name}")
    print(f"Region: {args.region}")
    if args.dry_run:
        print("DRY RUN — no deletions will be made\n")

    dynamodb = boto3.resource("dynamodb", region_name=args.region)
    queue_table = dynamodb.Table(queue_table_name)

    # Fetch entries
    if args.username:
        print(f"Querying entries for user: {args.username}")
        items = []
        resp = queue_table.query(
            KeyConditionExpression="username = :u",
            ExpressionAttributeValues={":u": args.username},
        )
        items.extend(resp["Items"])
        while "LastEvaluatedKey" in resp:
            resp = queue_table.query(
                KeyConditionExpression="username = :u",
                ExpressionAttributeValues={":u": args.username},
                ExclusiveStartKey=resp["LastEvaluatedKey"],
            )
            items.extend(resp["Items"])
    else:
        print("Scanning all entries...")
        items = []
        resp = queue_table.scan()
        items.extend(resp["Items"])
        while "LastEvaluatedKey" in resp:
            resp = queue_table.scan(ExclusiveStartKey=resp["LastEvaluatedKey"])
            items.extend(resp["Items"])

    print(f"Found {len(items)} total queue entries\n")

    # Group by (username, movie_id)
    groups = defaultdict(list)
    for item in items:
        key = (item["username"], item["movie_id"])
        groups[key].append(item)

    # Find duplicates
    total_dupes = 0
    total_deleted = 0
    for (username, movie_id), entries in sorted(groups.items()):
        if len(entries) <= 1:
            continue

        # Sort by sk — keep the first, delete the rest
        entries.sort(key=lambda x: x["sk"])
        kept = entries[0]
        to_delete = entries[1:]
        total_dupes += 1
        total_deleted += len(to_delete)

        print(f"DUPLICATE: user={username} movie_id={movie_id}")
        print(f"  KEEP:   sk={kept['sk']}")
        for dup in to_delete:
            print(f"  DELETE: sk={dup['sk']}")
            if not args.dry_run:
                queue_table.delete_item(Key={"username": username, "sk": dup["sk"]})

    print(f"\nSummary: {total_dupes} movies with duplicates, {total_deleted} entries {'would be ' if args.dry_run else ''}deleted")


if __name__ == "__main__":
    main()
