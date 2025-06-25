from functools import lru_cache
from botocore.exceptions import ClientError
import boto3

from config import get_settings

settings = get_settings()


@lru_cache()
def get_s3_client():
    return boto3.client('s3',
                        aws_access_key_id=settings.aws_access_key_id,
                        aws_secret_access_key=settings.aws_secret_access_key,
                        region_name=settings.aws_default_region
                        )


def generate_upload_url(object_key, expiration=3600):
    s3_client = get_s3_client()
    response = s3_client.generate_presigned_url(
        'put_object',
        Params={
            'Bucket': settings.aws_s3_videos_bucket, 
            'Key': str(object_key),
            'ContentType': 'video/mp4'  # Set a default content type
        },
        ExpiresIn=expiration
    )
    return response


def generate_download_url(object_key, expiration=3600):
    s3_client = get_s3_client()
    response = s3_client.generate_presigned_url(
        'get_object',
        Params={'Bucket': settings.aws_s3_videos_bucket, 'Key': object_key},
        ExpiresIn=expiration
    )
    return response
