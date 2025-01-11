import boto3
from botocore.exceptions import ClientError
from PIL import Image
import io
import os
from datetime import datetime
import json


def read_stream(stream):
    try:
        return stream.read()
    except Exception as e:
        raise RuntimeError(f"Error reading stream: {e}")


def get_current_date():
    date = datetime.now()
    return {
        "day": f"{date.day:02}",
        "month": f"{date.month:02}",
        "year": str(date.year),
    }


def process_image(bucket_name, key):
    s3 = boto3.client(
        "s3",
        endpoint_url=os.getenv("S3_ENDPOINT"),
    )

    # Get the object from S3
    response = s3.get_object(Bucket=bucket_name, Key=key)
    body = read_stream(response["Body"])

    # Process the image using PIL
    image = Image.open(io.BytesIO(body))
    name = os.path.splitext(os.path.basename(key))[0]
    current_date = get_current_date()

    thumbnail_key = f"photos/thumbnail/{current_date['year']}/{current_date['month']}/{current_date['day']}/{name}.webp"
    web_key = f"photos/web/{current_date['year']}/{current_date['month']}/{current_date['day']}/{name}.webp"
    original_key = f"photos/original/{current_date['year']}/{current_date['month']}/{current_date['day']}/{key}"

    buffers = {}

    for size, key_name in [(400, thumbnail_key), (1080, web_key)]:
        resized_image = image.copy()
        resized_image.thumbnail((size, size))
        output = io.BytesIO()
        resized_image.save(output, format="WEBP")
        buffers[key_name] = output.getvalue()

    # Upload images to S3
    try:
        for key_name, data in buffers.items():
            s3.put_object(
                Bucket=os.getenv("PHOTO_BUCKET_NAME"), Key=key_name, Body=data
            )

        s3.put_object(
            Bucket=os.getenv("PHOTO_BUCKET_NAME"), Key=original_key, Body=body
        )
    except ClientError as e:
        raise RuntimeError(f"Error uploading to S3: {e}")

    return {
        "thumbnail_key": thumbnail_key,
        "web_key": web_key,
        "original_key": original_key,
    }


def save_metadata_to_dynamodb(name, keys):
    dynamodb = boto3.client("dynamodb")

    processed_at = str(int(datetime.now().timestamp() * 1000))

    try:
        dynamodb.put_item(
            TableName=os.getenv("PHOTO_TABLE_NAME"),
            Item={
                "PK": {"S": f"image#{name}"},
                "SK": {"S": processed_at},
                "GSI1PK": {"S": "list"},
                "GSI1SK": {"S": processed_at},
                "thumbnail": {
                    "S": f"s3://{os.getenv('PHOTO_BUCKET_NAME')}/{keys['thumbnail_key']}"
                },
                "web": {
                    "S": f"s3://{os.getenv('PHOTO_BUCKET_NAME')}/{keys['web_key']}"
                },
                "original": {
                    "S": f"s3://{os.getenv('PHOTO_BUCKET_NAME')}/{keys['original_key']}"
                },
            },
        )
    except ClientError as e:
        raise RuntimeError(f"Error writing to DynamoDB: {e}")


def lambda_handler(event, context):
    sqs = boto3.client("sqs")

    for record in event["Records"]:
        try:
            print("trying to process image")
            message_body = json.loads(record["body"])
            bucket_name = message_body["Records"][0]["s3"]["bucket"]["name"]
            key = message_body["Records"][0]["s3"]["object"]["key"]

            keys = process_image(bucket_name, key)
            name = os.path.splitext(os.path.basename(key))[0]
            save_metadata_to_dynamodb(name, keys)

            # Delete the message from SQS
            sqs.delete_message(
                QueueUrl=os.getenv("SQS_QUEUE_URL"),
                ReceiptHandle=record["receiptHandle"],
            )

        except Exception as e:
            print(f"Error processing record: {e}")

    return {"statusCode": 200, "body": "Processing completed successfully."}
