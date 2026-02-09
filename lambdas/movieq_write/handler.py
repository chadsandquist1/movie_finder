import json
import os
import uuid
from decimal import Decimal

import boto3

TABLE_NAME = os.environ["TABLE_NAME"]
dynamodb = boto3.resource("dynamodb")
table = dynamodb.Table(TABLE_NAME)

REQUIRED_FIELDS = {"title", "year", "genre", "rating", "director", "status", "rank"}


def lambda_handler(event, context):
    body = event.get("body")
    if isinstance(body, str):
        body = json.loads(body)
    if body is None:
        body = event

    movie_id = body.get("movie_id")

    # Update existing movie (e.g. status change)
    if movie_id:
        updates = {}
        for field in ("status", "rank", "title", "genre", "director"):
            if field in body:
                updates[field] = body[field]
        for field in ("year", "rating"):
            if field in body:
                updates[field] = Decimal(str(body[field]))

        if not updates:
            return {
                "statusCode": 400,
                "body": json.dumps({"error": "No fields to update"}),
            }

        expr_parts = []
        expr_names = {}
        expr_values = {}
        for i, (k, v) in enumerate(updates.items()):
            token = f"#f{i}"
            val_token = f":v{i}"
            expr_parts.append(f"{token} = {val_token}")
            expr_names[token] = k
            expr_values[val_token] = v

        table.update_item(
            Key={"movie_id": movie_id},
            UpdateExpression="SET " + ", ".join(expr_parts),
            ExpressionAttributeNames=expr_names,
            ExpressionAttributeValues=expr_values,
        )

        return {
            "statusCode": 200,
            "body": json.dumps({"message": "Movie updated", "movie_id": movie_id}),
        }

    # Create new movie
    missing = REQUIRED_FIELDS - set(body.keys())
    if missing:
        return {
            "statusCode": 400,
            "body": json.dumps({"error": f"Missing fields: {', '.join(sorted(missing))}"}),
        }

    movie_id = str(uuid.uuid4())
    table.put_item(Item={
        "movie_id": movie_id,
        "status": body["status"],
        "rank": body["rank"],
        "title": body["title"],
        "year": Decimal(str(body["year"])),
        "genre": body["genre"],
        "rating": Decimal(str(body["rating"])),
        "director": body["director"],
    })

    return {
        "statusCode": 200,
        "body": json.dumps({"message": "Movie created", "movie_id": movie_id}),
    }
