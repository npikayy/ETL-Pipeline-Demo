import os
from dotenv import load_dotenv

load_dotenv()

# Google Cloud
PROJECT_ID = os.getenv("GOOGLE_CLOUD_PROJECT", "your-project-id")
TOPIC_ID = os.getenv("PUBSUB_TOPIC", "sensor-data")
DATASET_ID = os.getenv("BIGQUERY_DATASET", "water_quality")
TABLE_ID = os.getenv("BIGQUERY_TABLE", "sensor_data_cleaned")
REGION = os.getenv("REGION", "us-central1")

# MongoDB Atlas (Operational Store)
MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
MONGODB_DB = os.getenv("MONGODB_DB", "water_quality")
MONGODB_COLLECTION = os.getenv("MONGODB_COLLECTION", "stations")

# Cloud Storage (Raw Data Lake)
BUCKET_NAME = os.getenv("BUCKET_NAME", "your-raw-data-bucket")
RAW_DATA_PREFIX = os.getenv("RAW_DATA_PREFIX", "raw/water-quality")