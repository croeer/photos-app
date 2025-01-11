import os
import json
import boto3
import random
import string
from botocore.exceptions import ClientError

s3_client = boto3.client("s3")


def create_presigned_post(bucket_name, object_name, expiration):
    try:
        response = s3_client.generate_presigned_post(
            bucket_name, object_name, Fields=None, Conditions=None, ExpiresIn=expiration
        )
    except ClientError as e:
        print(e)
        return None
    return response


def lambda_handler(event, context):
    body = json.loads(event.get("body", "{}"))
    photos = json.loads(body.get("photos", "[]"))

    # print(body)
    # print(photos)
    # print(len(photos))
    if not (1 <= len(photos) <= int(os.environ["MAX_PHOTOS_PER_REQUEST"])):
        print("Error")
        return {
            "statusCode": 400,
            "body": json.dumps(
                {
                    "error": f"Expected between 1 and {os.environ['MAX_PHOTOS_PER_REQUEST']} photos"
                },
                indent=2,
            ),
        }

    print("Uploading photos")
    urls = []
    for name in photos:
        print(f"Uploading {name}")
        key = f"{''.join(random.choices(string.ascii_lowercase + string.digits, k=8))}.{name.split('.')[-1]}"
        print(key)
        presigned_post = create_presigned_post(
            os.environ["UPLOAD_BUCKET_NAME"], key, len(photos) * 300
        )
        print(presigned_post)
        if presigned_post:
            urls.append(presigned_post)
    print("Done")
    # print(urls)
    return {
        "statusCode": 200,
        "headers": {
            "Content-Type": "application/json",
        },
        "body": json.dumps(
            {
                "_links": {
                    "self": {"href": f"/api/request"},
                },
                "urls": urls,
            },
            indent=2,
        ),
    }
