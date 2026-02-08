import json
import os
from decimal import Decimal

import boto3

TABLE_NAME = os.environ["TABLE_NAME"]
dynamodb = boto3.resource("dynamodb")
table = dynamodb.Table(TABLE_NAME)


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
    result = table.scan()
    movies = _convert_decimals(result.get("Items", []))

    return {
        "statusCode": 200,
        "body": json.dumps({"movies": movies}),
    }
