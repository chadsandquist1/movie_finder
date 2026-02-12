import json
import os
import uuid
from datetime import datetime, timezone
from decimal import Decimal

import boto3

TABLE_NAME = os.environ["TABLE_NAME"]
QUEUE_TABLE_NAME = os.environ["QUEUE_TABLE_NAME"]
dynamodb = boto3.resource("dynamodb")
movies_table = dynamodb.Table(TABLE_NAME)
queue_table = dynamodb.Table(QUEUE_TABLE_NAME)

REQUIRED_FIELDS = {"title", "year", "status", "rank"}
MOVIE_FIELDS = {"title", "genre", "director", "importedDate", "importedFrom"}
MOVIE_NUMERIC_FIELDS = {"year", "rating"}


def _build_movie_item(data, movie_id=None):
    """Build a movie item dict for the movies table (no status/rank)."""
    if movie_id is None:
        movie_id = str(uuid.uuid4())
    item = {"movie_id": movie_id}
    for field in ("title", "genre", "director", "importedDate", "importedFrom"):
        if data.get(field):
            item[field] = data[field]
    for field in ("year", "rating"):
        if data.get(field) is not None and data.get(field) != "":
            item[field] = Decimal(str(data[field]))
    return item


def _remove_existing_queue_entries(username, movie_id):
    """Delete ALL existing queue entries for a (username, movie_id) pair.

    This prevents cross-list duplicates when a movie is moved between lists
    or re-added from the catalog.
    """
    resp = queue_table.query(
        KeyConditionExpression="username = :u",
        FilterExpression="movie_id = :m",
        ExpressionAttributeValues={":u": username, ":m": movie_id},
    )
    for item in resp.get("Items", []):
        queue_table.delete_item(Key={"username": username, "sk": item["sk"]})


def _handle_batch_create(movies_list, username):
    """Batch-create multiple movies: write to both movies and queue tables.

    If a movie already has a movie_id (e.g. from catalog import), reuse it
    and update the existing movies-table item instead of creating a duplicate.
    """
    movie_ids = []
    # Remove existing queue entries for movies being re-added (prevents cross-list dupes)
    for m in movies_list:
        if m.get("movie_id"):
            _remove_existing_queue_entries(username, m["movie_id"])

    with movies_table.batch_writer() as movie_batch, queue_table.batch_writer() as queue_batch:
        for m in movies_list:
            movie_id = m.get("movie_id") or str(uuid.uuid4())
            movie_ids.append(movie_id)

            # Movies table item (put_item is an upsert in DynamoDB)
            movie_item = {
                "movie_id": movie_id,
                "title": m["title"],
                "year": Decimal(str(m["year"])),
                "importedFrom": m.get("importedFrom", "omdb"),
                "importedDate": m.get("importedDate", datetime.now(timezone.utc).isoformat()),
            }
            for field in ("genre", "director"):
                if m.get(field):
                    movie_item[field] = m[field]
            if m.get("rating"):
                movie_item["rating"] = Decimal(str(m["rating"]))
            movie_batch.put_item(Item=movie_item)

            # Queue table entry
            sk = f"{m['status']}#{m['rank']}"
            queue_batch.put_item(Item={
                "username": username,
                "sk": sk,
                "movie_id": movie_id,
            })

    return _response(200, {"message": f"Created {len(movie_ids)} movies", "movie_ids": movie_ids})


def _response(status_code, body):
    return {
        "statusCode": status_code,
        "headers": {"Content-Type": "application/json"},
        "body": json.dumps(body),
    }


def lambda_handler(event, context):
    path_params = event.get("pathParameters") or {}
    username = path_params.get("username")
    if not username:
        return _response(400, {"error": "username is required"})

    http_method = event.get("requestContext", {}).get("http", {}).get("method", "")

    # DELETE /users/{username}/queue/{movie_id} — remove from queue only
    if http_method == "DELETE":
        movie_id = path_params.get("movie_id")
        if not movie_id:
            return _response(400, {"error": "movie_id is required"})

        # Find and delete ALL queue entries for this movie (handles duplicates)
        resp = queue_table.query(
            KeyConditionExpression="username = :u",
            FilterExpression="movie_id = :m",
            ExpressionAttributeValues={":u": username, ":m": movie_id},
        )
        items = resp.get("Items", [])
        if not items:
            return _response(404, {"error": "Movie not found in queue"})

        for item in items:
            queue_table.delete_item(Key={"username": username, "sk": item["sk"]})
        return _response(200, {"message": "Movie removed from list"})

    raw_body = event.get("body")
    body = json.loads(raw_body) if isinstance(raw_body, str) else (raw_body or {})

    # Batch create mode (POST /users/{username}/queue/batch)
    if "movies" in body and isinstance(body["movies"], list):
        return _handle_batch_create(body["movies"], username)

    # movie_id from path param (PUT) or body (POST create with existing id)
    movie_id = path_params.get("movie_id") or body.get("movie_id")

    # Update existing movie
    if movie_id:
        # Update movie fields in movies table if any provided
        movie_updates = {}
        for field in ("title", "genre", "director", "importedDate", "importedFrom"):
            if field in body:
                movie_updates[field] = body[field]
        for field in ("year", "rating"):
            if field in body:
                movie_updates[field] = Decimal(str(body[field]))

        if movie_updates:
            expr_parts = []
            expr_names = {}
            expr_values = {}
            for i, (k, v) in enumerate(movie_updates.items()):
                token = f"#f{i}"
                val_token = f":v{i}"
                expr_parts.append(f"{token} = {val_token}")
                expr_names[token] = k
                expr_values[val_token] = v

            movies_table.update_item(
                Key={"movie_id": movie_id},
                UpdateExpression="SET " + ", ".join(expr_parts),
                ExpressionAttributeNames=expr_names,
                ExpressionAttributeValues=expr_values,
            )

        # Handle queue entry changes (status/rank)
        new_status = body.get("status")
        new_rank = body.get("rank")
        old_sk = body.get("old_sk")

        if new_status is not None or new_rank is not None:
            # Remove ALL existing queue entries for this movie (prevents cross-list dupes)
            _remove_existing_queue_entries(username, movie_id)

            # Build new sk
            if new_status is not None and new_rank is not None:
                new_sk = f"{new_status}#{new_rank}"
            elif new_status is not None:
                # Need rank from old_sk
                old_rank = old_sk.split("#", 1)[1] if old_sk and "#" in old_sk else "a0"
                new_sk = f"{new_status}#{new_rank if new_rank else old_rank}"
            else:
                # Only rank changed, need status from old_sk
                old_status = old_sk.split("#", 1)[0] if old_sk and "#" in old_sk else "active"
                new_sk = f"{old_status}#{new_rank}"

            queue_table.put_item(Item={
                "username": username,
                "sk": new_sk,
                "movie_id": movie_id,
            })

        return _response(200, {"message": "Movie updated", "movie_id": movie_id})

    # Create new movie
    missing = REQUIRED_FIELDS - set(body.keys())
    if missing:
        return _response(400, {"error": f"Missing fields: {', '.join(sorted(missing))}"})

    movie_id = str(uuid.uuid4())

    # Movies table
    movie_item = {
        "movie_id": movie_id,
        "title": body["title"],
        "year": Decimal(str(body["year"])),
        "importedFrom": "add",
        "importedDate": datetime.now(timezone.utc).isoformat(),
    }
    for field in ("genre", "director"):
        if body.get(field):
            movie_item[field] = body[field]
    if body.get("rating"):
        movie_item["rating"] = Decimal(str(body["rating"]))
    movies_table.put_item(Item=movie_item)

    # Queue table
    sk = f"{body['status']}#{body['rank']}"
    queue_table.put_item(Item={
        "username": username,
        "sk": sk,
        "movie_id": movie_id,
    })

    return _response(200, {"message": "Movie created", "movie_id": movie_id})
