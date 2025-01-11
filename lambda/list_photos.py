import os
import json
import time
import boto3
from urllib.parse import urlparse

dynamodb = boto3.client("dynamodb")


def to_public_read_url(url):
    path = urlparse(url).path
    return os.environ["PHOTO_BUCKET_PUBLIC_READ_URL"].replace("{path}", path)


def lambda_handler(event, context):
    next_token = event.get("queryStringParameters", {}).get(
        "next", str(int(time.time() * 1000))
    )

    params = {
        "TableName": os.environ["PHOTO_TABLE_NAME"],
        "IndexName": "GSI1",
        "KeyConditionExpression": "GSI1PK = :pk and GSI1SK < :sk",
        "ExpressionAttributeValues": {
            ":pk": {"S": "list"},
            ":sk": {"S": next_token},
        },
        "ScanIndexForward": False,
        "Limit": int(os.environ["PHOTOS_PER_BATCH"]),
    }

    response = dynamodb.query(**params)
    records = response["Items"]
    next_pointer = response.get("LastEvaluatedKey", {}).get("GSI1SK", {}).get("S")

    body = {
        "_links": {
            "self": {
                "href": (
                    f"{os.environ['HOST']}/api/list?next={next_token}"
                    if next_token
                    else f"{os.environ['HOST']}/api/list"
                ),
            },
            **(
                {"next": {"href": f"{os.environ['HOST']}/api/list?next={next_pointer}"}}
                if next_pointer
                else {}
            ),
            "request": {"href": f"{os.environ['HOST']}/api/request"},
            "bootstrap": {"href": f"{os.environ['HOST']}/api"},
        },
        "photos": [
            {
                "id": record["PK"]["S"],
                "thumbnail": to_public_read_url(record["thumbnail"]["S"]),
                "web": to_public_read_url(record["web"]["S"]),
                "original": to_public_read_url(record["original"]["S"]),
            }
            for record in records
        ],
    }

    return {
        "statusCode": 200,
        "headers": {
            "Content-Type": "application/hal+json",
        },
        "body": json.dumps(body, indent=2),
    }
