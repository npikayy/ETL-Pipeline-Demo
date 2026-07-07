import apache_beam as beam
from apache_beam.options.pipeline_options import PipelineOptions
import json
import logging
import uuid
from datetime import datetime

# ============================================================
# 1. ĐỊNH NGHĨA SCHEMA CHUẨN CHO BIGQUERY
# ============================================================
BIGQUERY_SCHEMA = """
    observation_id:STRING,
    timestamp:TIMESTAMP,
    station_id:STRING,
    sensor_id:STRING,
    pH:FLOAT,
    dissolved_oxygen_mg_l:FLOAT,
    temperature_c:FLOAT,
    turbidity_ntu:FLOAT,
    electrical_conductivity_us_cm:FLOAT,
    tds_mg_l:FLOAT,
    orp_mv:FLOAT,
    water_level_m:FLOAT,
    battery_voltage:FLOAT,
    quality_flag:STRING,
    source:STRING,
    processed_at:TIMESTAMP
"""

# ============================================================
# 2. DoFn: PARSE & VALIDATE (Bước chung cho cả 3 job)
# ============================================================

class ParseAndValidate(beam.DoFn):
    """Parse JSON từ Pub/Sub, validate dữ liệu, gán quality_flag"""
    
    def process(self, element):
        try:
            data = json.loads(element.decode('utf-8'))
            
            timestamp = data.get('timestamp', datetime.utcnow().isoformat())
            
            record = {
                'observation_id': data.get('observation_id', f"obs_{datetime.utcnow().timestamp()}"),
                'timestamp': timestamp,
                'station_id': data.get('station_id', 'UNKNOWN'),
                'sensor_id': data.get('sensor_id', 'UNKNOWN'),
                'pH': data.get('pH'),
                'dissolved_oxygen_mg_l': data.get('DO') or data.get('dissolved_oxygen'),
                'temperature_c': data.get('temperature') or data.get('temp'),
                'turbidity_ntu': data.get('turbidity'),
                'electrical_conductivity_us_cm': data.get('EC') or data.get('electrical_conductivity'),
                'tds_mg_l': data.get('TDS') or data.get('tds'),
                'orp_mv': data.get('ORP') or data.get('orp'),
                'water_level_m': data.get('water_level'),
                'battery_voltage': data.get('battery'),
                'source': data.get('source', 'unknown'),
                'processed_at': datetime.utcnow().isoformat(),
            }
            
            # ===== VALIDATION: Gán quality_flag =====
            quality_flag = 'VALID'
            warnings = []
            
            if record['pH'] is not None:
                if not (0 <= record['pH'] <= 14):
                    quality_flag = 'INVALID'
                    warnings.append('pH out of range (0-14)')
            else:
                quality_flag = 'SUSPECT'
                warnings.append('pH missing')
            
            if record['dissolved_oxygen_mg_l'] is not None:
                if not (0 <= record['dissolved_oxygen_mg_l'] <= 20):
                    quality_flag = 'INVALID'
                    warnings.append('DO out of range (0-20)')
            else:
                quality_flag = 'SUSPECT'
                warnings.append('DO missing')
            
            record['quality_flag'] = quality_flag
            
            if warnings:
                logging.warning(f"Data quality warnings for {record.get('observation_id')}: {', '.join(warnings)}")
                
            yield record
            
        except json.JSONDecodeError as e:
            logging.error(f"JSON parse error: {e}")
            yield {
                'error': 'JSON_PARSE_ERROR',
                'raw': element.decode('utf-8')[:100],
                'processed_at': datetime.utcnow().isoformat()
            }


# ============================================================
# 3. DoFn: GHI VÀO MONGODB ATLAS (Job 2)
# ============================================================

class WriteToMongoDB(beam.DoFn):
    """Ghi/Upsert current state vào MongoDB Atlas.
    
    Chỉ cập nhật nếu bản ghi mới có timestamp >= bản ghi hiện tại
    để tránh dữ liệu batch cũ ghi đè lên dữ liệu mới.
    """
    
    def __init__(self, mongodb_uri, db_name, collection_name):
        self.mongodb_uri = mongodb_uri
        self.db_name = db_name
        self.collection_name = collection_name
    
    def setup(self):
        """Khởi tạo MongoDB client khi worker start"""
        import pymongo
        self.client = pymongo.MongoClient(self.mongodb_uri)
        self.db = self.client[self.db_name]
        self.collection = self.db[self.collection_name]
        # Tạo index nếu chưa có
        self.collection.create_index("station_id", unique=True)
        self.collection.create_index("last_updated")
        logging.info(f"✅ MongoDB connected: {self.db_name}.{self.collection_name}")
    
    def _parse_timestamp(self, ts_str):
        """Parse ISO timestamp string thành naive UTC datetime để so sánh"""
        if not ts_str:
            return datetime.min
        try:
            ts_str = ts_str.replace('Z', '+00:00')
            dt = datetime.fromisoformat(ts_str)
            if dt.tzinfo is not None:
                dt = (dt - dt.utcoffset()).replace(tzinfo=None)
            return dt
        except Exception:
            return datetime.min
    
    def process(self, record):
        try:
            station_id = record.get('station_id')
            if not station_id:
                return
            
            incoming_ts = record.get('timestamp', '')
            
            # Kiểm tra xem bản ghi hiện có trong DB có mới hơn không
            existing = self.collection.find_one({'station_id': station_id})
            if existing and 'last_updated' in existing:
                existing_ts = existing['last_updated']
                if self._parse_timestamp(incoming_ts) < self._parse_timestamp(existing_ts):
                    logging.info(f"⏭️ Skip older record for MongoDB: {station_id}")
                    return
            
            # Chuẩn bị document cho MongoDB
            doc = {
                'station_id': station_id,
                'sensor_id': record.get('sensor_id'),
                'readings': {
                    'pH': record.get('pH'),
                    'dissolved_oxygen': record.get('dissolved_oxygen_mg_l'),
                    'temperature': record.get('temperature_c'),
                    'turbidity': record.get('turbidity_ntu'),
                    'EC': record.get('electrical_conductivity_us_cm'),
                    'TDS': record.get('tds_mg_l'),
                    'ORP': record.get('orp_mv'),
                    'water_level': record.get('water_level_m'),
                    'battery': record.get('battery_voltage'),
                },
                'quality_flag': record.get('quality_flag', 'UNKNOWN'),
                'source': record.get('source', 'unknown'),
                'last_updated': incoming_ts,
            }
            
            # Lọc bỏ None values trong readings
            doc['readings'] = {k: v for k, v in doc['readings'].items() if v is not None}
            
            # Upsert vào MongoDB
            self.collection.update_one(
                {'station_id': station_id},
                {'$set': doc},
                upsert=True
            )
            
            logging.info(f"✅ MongoDB upsert: {station_id} (ts={incoming_ts})")
            
        except Exception as e:
            logging.error(f"❌ MongoDB write error: {e}")
    
    def teardown(self):
        """Đóng kết nối khi worker dừng"""
        if hasattr(self, 'client'):
            self.client.close()


# ============================================================
# 4. DoFn: GHI VÀO CLOUD STORAGE (Job 3)
# ============================================================

class WriteToCloudStorage(beam.DoFn):
    """Ghi raw data payload vào Cloud Storage (Data Lake)"""
    
    def __init__(self, bucket_name, raw_data_prefix):
        self.bucket_name = bucket_name
        self.raw_data_prefix = raw_data_prefix
    
    def setup(self):
        """Khởi tạo Cloud Storage client khi worker start"""
        from google.cloud import storage
        self.storage_client = storage.Client()
        self.bucket = self.storage_client.bucket(self.bucket_name)
        logging.info(f"✅ Cloud Storage connected: gs://{self.bucket_name}/{self.raw_data_prefix}")
    
    def process(self, record):
        try:
            timestamp = record.get('timestamp', datetime.utcnow().isoformat())
            try:
                dt = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
                date_prefix = dt.strftime('%Y/%m/%d')
            except Exception:
                date_prefix = datetime.utcnow().strftime('%Y/%m/%d')
            
            station_id = record.get('station_id', 'unknown')
            obs_id = record.get('observation_id', uuid.uuid4().hex)
            
            filename = f"{self.raw_data_prefix}/{date_prefix}/{station_id}/{obs_id}.json"
            
            raw_data_with_meta = {
                'raw_payload': record,
                'ingestion_timestamp': datetime.utcnow().isoformat(),
                'source_type': record.get('source', 'unknown'),
            }
            
            blob = self.bucket.blob(filename)
            blob.upload_from_string(
                json.dumps(raw_data_with_meta, indent=2, default=str),
                content_type='application/json'
            )
            
            logging.info(f"✅ Cloud Storage: {filename}")
            
        except Exception as e:
            logging.error(f"❌ Cloud Storage write error: {e}")


# ============================================================
# 5. PIPELINE: 3 JOB OUTPUTS
# ============================================================

def run_pipeline(project_id, subscription_id, dataset_id, table_id, region,
                 mongodb_uri, mongodb_db, mongodb_collection,
                 bucket_name, raw_data_prefix):
    """
    Dataflow Streaming Pipeline với 3 job outputs:
    
    Pub/Sub → Parse & Validate → ┬→ Job 1: BigQuery (Historical Analytics)
                                  ├→ Job 2: MongoDB Atlas (Current State)
                                  └→ Job 3: Cloud Storage (Raw Data Lake)
    """
    
    options = PipelineOptions([
        '--project', project_id,
        '--region', region,
        '--runner', 'DataflowRunner',
        '--streaming', 'true',
        '--temp_location', f'gs://etl-pipeline-temp/temp',
        '--staging_location', f'gs://etl-pipeline-staging-123/staging',
        '--experiments', 'use_runner_v2',
        '--job_name', f'sensor-data-etl-3tiers',
    ])
    
    with beam.Pipeline(options=options) as p:
        
        # ============ Read from Pub/Sub ============
        messages = (
            p
            | "Read from Pub/Sub" >> beam.io.ReadFromPubSub(
                subscription=f'projects/{project_id}/subscriptions/{subscription_id}'
            )
        )
        
        # ============ Parse & Validate (bước chung) ============
        parsed = (
            messages
            | "Parse and Validate" >> beam.ParDo(ParseAndValidate())
            | "Filter errors" >> beam.Filter(lambda x: 'error' not in x)
        )
        
        # ============ Job 1: Write to BigQuery ============
        parsed | "Job1 - Write to BigQuery" >> beam.io.WriteToBigQuery(
            table=f'{project_id}:{dataset_id}.{table_id}',
            schema=BIGQUERY_SCHEMA,
            write_disposition=beam.io.BigQueryDisposition.WRITE_APPEND,
            create_disposition=beam.io.BigQueryDisposition.CREATE_IF_NEEDED,
        )
        
        # ============ Job 2: Write to MongoDB Atlas ============
        parsed | "Job2 - Write to MongoDB" >> beam.ParDo(
            WriteToMongoDB(
                mongodb_uri=mongodb_uri,
                db_name=mongodb_db,
                collection_name=mongodb_collection
            )
        )
        
        # ============ Job 3: Write to Cloud Storage ============
        parsed | "Job3 - Write to Cloud Storage" >> beam.ParDo(
            WriteToCloudStorage(
                bucket_name=bucket_name,
                raw_data_prefix=raw_data_prefix
            )
        )
    
    logging.info("🚀 Pipeline with 3 output jobs started successfully!")


# ============================================================
# 6. ENTRYPOINT
# ============================================================

if __name__ == '__main__':
    logging.basicConfig(level=logging.INFO)
    
    from config import (
        PROJECT_ID, DATASET_ID, TABLE_ID, REGION,
        MONGODB_URI, MONGODB_DB, MONGODB_COLLECTION,
        BUCKET_NAME, RAW_DATA_PREFIX
    )
    
    # Subscription name (tạo từ topic sensor-data)
    SUBSCRIPTION_ID = 'sensor-data-sub'
    
    run_pipeline(
        project_id=PROJECT_ID,
        subscription_id=SUBSCRIPTION_ID,
        dataset_id=DATASET_ID,
        table_id=TABLE_ID,
        region=REGION,
        mongodb_uri=MONGODB_URI,
        mongodb_db=MONGODB_DB,
        mongodb_collection=MONGODB_COLLECTION,
        bucket_name=BUCKET_NAME,
        raw_data_prefix=RAW_DATA_PREFIX
    )