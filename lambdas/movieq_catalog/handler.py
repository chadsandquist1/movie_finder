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


def lambda_handler(event, context):
    body = event.get("body")
    if isinstance(body, str):
        body = json.loads(body)
    if body is None:
        body = event

    username = body.get("username")
    if not username:
        return {
            "statusCode": 400,
            "body": json.dumps({"error": "username is required"}),
        }

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
        KeyConditionExpression=boto3.dynamodb.conditions.Key("username").eq(username),
    )
    for item in result.get("Items", []):
        movie_id = item["movie_id"]
        sk = item["sk"]
        status = sk.split("#", 1)[0]
        queued[movie_id] = status

    all_movies = _convert_decimals(all_movies)

    return {
        "statusCode": 200,
        "body": json.dumps({"movies": all_movies, "queued": queued}),
    }
