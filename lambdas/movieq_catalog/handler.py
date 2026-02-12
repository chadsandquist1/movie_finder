import json
import os
from decimal import Decimal

import boto3
from boto3.dynamodb.conditions import Attr, Key

TABLE_NAME = os.environ["TABLE_NAME"]
QUEUE_TABLE_NAME = os.environ["QUEUE_TABLE_NAME"]
dynamodb = boto3.resource("dynamodb")
movies_table = dynamodb.Table(TABLE_NAME)
queue_table = dynamodb.Table(QUEUE_TABLE_NAME)


def _convert_decimals(obj):
    """DynamoDB returns numbers as Decimal; convert to int/float for JSON."""
    if isinstance(obj, list):
        return [_convert_decimals(i) for i in obj]
    if isinstance(obj, dict):
        return {k: _convert_decimals(v) for k, v in obj.items()}
    if isinstance(obj, Decimal):
        return int(obj) if obj == int(obj) else float(obj)
    return obj


def _response(status_code, body):
    return {
        "statusCode": status_code,
        "headers": {"Content-Type": "application/json"},
        "body": json.dumps(body),
    }


def _handle_delete(event):
    """DELETE /movies/{movie_id} — delete a movie from the catalog if no users have it queued."""
    movie_id = event.get("pathParameters", {}).get("movie_id")
    if not movie_id:
        return _response(400, {"error": "movie_id is required"})

    # Check if the movie exists
    result = movies_table.get_item(Key={"movie_id": movie_id})
    if "Item" not in result:
        return _response(404, {"error": "Movie not found"})

    # Scan queue table for any users who have this movie queued
    queued_by = set()
    scan_kwargs = {"FilterExpression": Attr("movie_id").eq(movie_id)}
    while True:
        response = queue_table.scan(**scan_kwargs)
        for item in response.get("Items", []):
            queued_by.add(item["username"])
        if "LastEvaluatedKey" not in response:
            break
        scan_kwargs["ExclusiveStartKey"] = response["LastEvaluatedKey"]

    if queued_by:
        return _response(409, {
            "error": "Movie is queued by other users",
            "queued_by": sorted(queued_by),
        })

    # Safe to delete
    movies_table.delete_item(Key={"movie_id": movie_id})
    return _response(200, {"message": "Movie deleted"})


def _handle_get(event):
    """GET /movies — list full catalog with user's queue status."""
    claims = (
        event.get("requestContext", {})
        .get("authorizer", {})
        .get("jwt", {})
        .get("claims", {})
    )
    username = claims.get("cognito:username") or claims.get("sub")
    if not username:
        return _response(400, {"error": "username is required"})

    # Scan full movies catalog
    all_movies = []
    scan_kwargs = {}
    while True:
        response = movies_table.scan(**scan_kwargs)
        all_movies.extend(response.get("Items", []))
        if "LastEvaluatedKey" not in response:
            break
        scan_kwargs["ExclusiveStartKey"] = response["LastEvaluatedKey"]

    # Query user's queue to build movie_id -> status map
    queued = {}
    result = queue_table.query(
        KeyConditionExpression=Key("username").eq(username),
    )
    for item in result.get("Items", []):
        movie_id = item["movie_id"]
        sk = item["sk"]
        status = sk.split("#", 1)[0]
        queued[movie_id] = status

    # Deduplicate movies by (title_lowercase, year)
    groups = {}
    for movie in all_movies:
        title = movie.get("title", "")
        year = movie.get("year")
        key = (title.lower().strip(), year)
        groups.setdefault(key, []).append(movie)

    deduped = []
    merged_queued = dict(queued)
    for key, movies in groups.items():
        if len(movies) == 1:
            deduped.append(movies[0])
            continue
        # Pick canonical: prefer one the user has queued, then earliest importedDate
        canonical = None
        for m in movies:
            if m["movie_id"] in queued:
                canonical = m
                break
        if canonical is None:
            movies.sort(key=lambda m: m.get("importedDate", ""))
            canonical = movies[0]
        deduped.append(canonical)
        # Map any queued duplicate movie_ids to the canonical one
        canonical_id = canonical["movie_id"]
        for m in movies:
            mid = m["movie_id"]
            if mid != canonical_id and mid in queued:
                merged_queued[canonical_id] = merged_queued.pop(mid)

    all_movies = _convert_decimals(deduped)

    return _response(200, {"movies": all_movies, "queued": merged_queued})


def lambda_handler(event, context):
    http_method = (
        event.get("requestContext", {})
        .get("http", {})
        .get("method", "GET")
    )

    if http_method == "DELETE":
        return _handle_delete(event)

    return _handle_get(event)
