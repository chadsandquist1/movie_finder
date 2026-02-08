import json
import os
from decimal import Decimal

import boto3

TABLE_NAME = os.environ["TABLE_NAME"]
dynamodb = boto3.resource("dynamodb")
table = dynamodb.Table(TABLE_NAME)

REQUIRED_FIELDS = {"rank", "title", "year", "genre", "rating", "director", "status"}


def lambda_handler(event, context):
    body = event.get("body")
    if isinstance(body, str):
        body = json.loads(body)
    if body is None:
        body = event

    missing = REQUIRED_FIELDS - set(body.keys())
    if missing:
        return {
            "statusCode": 400,
            "body": json.dumps({"error": f"Missing fields: {', '.join(sorted(missing))}"}),
        }

    item = {
        "status": body["status"],
        "rank": body["rank"],
        "title": body["title"],
        "year": Decimal(str(body["year"])),
        "genre": body["genre"],
        "rating": Decimal(str(body["rating"])),
        "director": body["director"],
    }

    table.put_item(Item=item)

    return {
        "statusCode": 200,
        "body": json.dumps({"message": "Movie saved successfully"}),
    }
