import json
import os
from decimal import Decimal

import boto3

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


def lambda_handler(event, context):
    path_params = event.get("pathParameters") or {}
    username = path_params.get("username")
    if not username:
        return _response(400, {"error": "username is required"})

    # Query all queue entries for this user
    result = queue_table.query(
        KeyConditionExpression=boto3.dynamodb.conditions.Key("username").eq(username),
    )
    queue_items = result.get("Items", [])

    if not queue_items:
        return _response(200, {"movies": []})

    # Collect movie_ids and parse sk (status#rank)
    queue_map = {}  # movie_id -> {status, rank, sk}
    movie_ids = []
    for item in queue_items:
        movie_id = item["movie_id"]
        sk = item["sk"]
        parts = sk.split("#", 1)
        status = parts[0]
        rank = parts[1] if len(parts) > 1 else ""
        queue_map[movie_id] = {"status": status, "rank": rank, "sk": sk}
        movie_ids.append(movie_id)

    # Batch-get movie details from movies table
    # DynamoDB batch_get_item supports max 100 keys per call
    movies = []
    for i in range(0, len(movie_ids), 100):
        batch_keys = [{"movie_id": mid} for mid in movie_ids[i : i + 100]]
        response = dynamodb.batch_get_item(
            RequestItems={TABLE_NAME: {"Keys": batch_keys}}
        )
        movies.extend(response.get("Responses", {}).get(TABLE_NAME, []))

    # Merge queue data with movie data
    movie_details = {m["movie_id"]: m for m in movies}
    merged = []
    for movie_id, q in queue_map.items():
        movie = dict(movie_details.get(movie_id, {}))
        movie["movie_id"] = movie_id
        movie["status"] = q["status"]
        movie["rank"] = q["rank"]
        merged.append(movie)

    merged = _convert_decimals(merged)

    return _response(200, {"movies": merged})
