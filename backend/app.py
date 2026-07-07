from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timedelta
import uuid
import json
import logging
from google.cloud import pubsub_v1
from google.cloud import bigquery
from motor.motor_asyncio import AsyncIOMotorClient
from google.cloud import storage
import os

from config import (
    PROJECT_ID, TOPIC_ID, DATASET_ID, TABLE_ID,
    MONGODB_URI, MONGODB_DB, MONGODB_COLLECTION,
    BUCKET_NAME, RAW_DATA_PREFIX
)

app = FastAPI(title="ETL Pipeline Demo API - 3 Storage Tiers")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================================
# 1. CLIENTS (Chỉ dùng để ĐỌC dữ liệu cho API query)
# ============================================================

# MongoDB Atlas client (chỉ dùng để đọc current state)
mongo_client = AsyncIOMotorClient(MONGODB_URI)
db = mongo_client[MONGODB_DB]
stations_collection = db[MONGODB_COLLECTION]

# BigQuery client (chỉ dùng để đọc/query dữ liệu)
bq_client = bigquery.Client()

# Cloud Storage client (chỉ dùng để đọc raw data)
storage_client = storage.Client()
bucket = storage_client.bucket(BUCKET_NAME)

# ============================================================
# 2. ĐỊNH NGHĨA MODELS
# ============================================================

class SensorData(BaseModel):
    station_id: str
    sensor_id: str
    pH: Optional[float] = None
    DO: Optional[float] = None
    temperature: Optional[float] = None
    turbidity: Optional[float] = None
    EC: Optional[float] = None
    TDS: Optional[float] = None
    ORP: Optional[float] = None
    water_level: Optional[float] = None
    battery: Optional[float] = None
    source: str = "manual"
    timestamp: Optional[str] = None

class BatchUploadRequest(BaseModel):
    data: List[SensorData]

# ============================================================
# 3. HELPER FUNCTIONS
# ============================================================

def publish_to_pubsub(data: dict) -> str:
    """Publish dữ liệu lên Pub/Sub — điểm vào duy nhất cho toàn bộ ETL pipeline"""
    publisher = pubsub_v1.PublisherClient()
    topic_path = publisher.topic_path(PROJECT_ID, TOPIC_ID)
    
    if 'observation_id' not in data:
        data['observation_id'] = f"obs_{datetime.utcnow().timestamp()}_{uuid.uuid4().hex[:8]}"
    if 'timestamp' not in data:
        data['timestamp'] = datetime.utcnow().isoformat()
    if 'source' not in data:
        data['source'] = 'unknown'
    
    message = json.dumps(data).encode('utf-8')
    future = publisher.publish(topic_path, message)
    return future.result()


# ============================================================
# 4. API ENDPOINTS
# ============================================================

@app.on_event("startup")
async def startup_event():
    """Khởi tạo indexes cho MongoDB khi server start"""
    try:
        await stations_collection.create_index("station_id", unique=True)
        await stations_collection.create_index("last_updated")
        logging.info("✅ MongoDB indexes created")
    except Exception as e:
        logging.error(f"❌ MongoDB index creation error: {e}")
    logging.info("🚀 ETL Pipeline Demo started (API → Pub/Sub only, Dataflow handles all writes)")


@app.get("/")
async def root():
    return {"message": "ETL Pipeline Demo - 3 Storage Tiers", "status": "running"}


# ---------- 1. IoT Data ----------
@app.post("/api/iot")
async def iot_data(data: SensorData):
    """Mô phỏng dữ liệu từ IoT sensor → Pub/Sub → Dataflow xử lý"""
    payload = data.dict()
    payload['source'] = 'iot'
    payload['observation_id'] = f"iot_{datetime.utcnow().timestamp()}_{uuid.uuid4().hex[:8]}"
    payload['timestamp'] = datetime.utcnow().isoformat()
    
    message_id = publish_to_pubsub(payload)
    
    return {
        "status": "success",
        "message": "IoT data published to Pub/Sub → Dataflow will process and save to 3 tiers",
        "message_id": message_id,
        "data": payload
    }


# ---------- 2. Manual Entry ----------
@app.post("/api/manual")
async def manual_entry(data: SensorData):
    """Dữ liệu nhập bằng tay → Pub/Sub → Dataflow xử lý"""
    payload = data.dict()
    payload['source'] = 'manual'
    payload['observation_id'] = f"manual_{datetime.utcnow().timestamp()}_{uuid.uuid4().hex[:8]}"
    if not payload.get('timestamp'):
        payload['timestamp'] = datetime.utcnow().isoformat()
    
    message_id = publish_to_pubsub(payload)
    
    return {
        "status": "success",
        "message": "Manual data published to Pub/Sub → Dataflow will process and save to 3 tiers",
        "message_id": message_id,
        "data": payload
    }


# ---------- 3. Batch Upload ----------
@app.post("/api/batch")
async def batch_upload(request: BatchUploadRequest):
    """Upload dữ liệu lịch sử theo batch → Pub/Sub → Dataflow xử lý"""
    if len(request.data) == 0:
        raise HTTPException(status_code=400, detail="No data provided")
    
    if len(request.data) > 1000:
        raise HTTPException(status_code=400, detail="Maximum 1000 records per batch")
    
    results = []
    failed = []
    
    for idx, item in enumerate(request.data):
        try:
            payload = item.dict()
            payload['source'] = 'batch'
            payload['observation_id'] = f"batch_{datetime.utcnow().timestamp()}_{idx}_{uuid.uuid4().hex[:4]}"
            if not payload.get('timestamp'):
                payload['timestamp'] = (datetime.utcnow() - timedelta(seconds=idx * 60)).isoformat()
            
            message_id = publish_to_pubsub(payload)
            
            results.append({
                "index": idx,
                "status": "success",
                "message_id": message_id
            })
        except Exception as e:
            failed.append({
                "index": idx,
                "error": str(e)
            })
    
    return {
        "status": "completed",
        "total": len(request.data),
        "success": len(results),
        "failed": len(failed),
        "results": results,
        "failed_records": failed if failed else None
    }


# ---------- 4. Query from BigQuery ----------
@app.get("/api/data")
async def get_data(
    limit: int = 10,
    offset: int = 0,
    station_id: Optional[str] = None,
    quality_flag: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
):
    """Lấy dữ liệu từ BigQuery với phân trang"""
    client = bigquery.Client()
    
    # Xây dựng điều kiện WHERE
    where_conditions = []
    if station_id:
        where_conditions.append(f"station_id = '{station_id}'")
    if quality_flag:
        where_conditions.append(f"quality_flag = '{quality_flag}'")
    if start_date:
        where_conditions.append(f"timestamp >= '{start_date}'")
    if end_date:
        where_conditions.append(f"timestamp <= '{end_date}'")
    
    where_clause = " AND ".join(where_conditions) if where_conditions else "1=1"
    
    # ===== ĐẾM TỔNG SỐ RECORDS =====
    count_query = f"""
    SELECT COUNT(*) as total 
    FROM `{PROJECT_ID}.{DATASET_ID}.{TABLE_ID}`
    WHERE {where_clause}
    """
    
    try:
        count_result = client.query(count_query).result()
        total_records = list(count_result)[0].total
    except Exception as e:
        print(f"Count error: {e}")
        total_records = 0
    
    # ===== QUERY DỮ LIỆU VỚI OFFSET =====
    query = f"""
    SELECT 
        observation_id,
        timestamp,
        station_id,
        sensor_id,
        pH,
        dissolved_oxygen_mg_l,
        temperature_c,
        turbidity_ntu,
        electrical_conductivity_us_cm,
        tds_mg_l,
        orp_mv,
        water_level_m,
        quality_flag,
        source,
        processed_at
    FROM `{PROJECT_ID}.{DATASET_ID}.{TABLE_ID}`
    WHERE {where_clause}
    ORDER BY timestamp DESC 
    LIMIT {limit} OFFSET {offset}
    """
    
    try:
        results = client.query(query).result()
        data = []
        for row in results:
            data.append({
                "observation_id": row.observation_id,
                "timestamp": row.timestamp.isoformat() if row.timestamp else None,
                "station_id": row.station_id,
                "sensor_id": row.sensor_id,
                "pH": row.pH,
                "dissolved_oxygen_mg_l": row.dissolved_oxygen_mg_l,
                "temperature_c": row.temperature_c,
                "turbidity_ntu": row.turbidity_ntu,
                "electrical_conductivity_us_cm": row.electrical_conductivity_us_cm,
                "tds_mg_l": row.tds_mg_l,
                "orp_mv": row.orp_mv,
                "water_level_m": row.water_level_m,
                "quality_flag": row.quality_flag,
                "source": row.source,
                "processed_at": row.processed_at.isoformat() if row.processed_at else None,
            })
        
        return {
            "total": total_records,
            "limit": limit,
            "offset": offset,
            "data": data
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ---------- 5. Query from MongoDB (Current State) ----------
@app.get("/api/current")
async def get_current_state(station_id: Optional[str] = None):
    """Lấy trạng thái hiện tại từ MongoDB Atlas"""
    try:
        if station_id:
            doc = await stations_collection.find_one(
                {'station_id': station_id},
                {'_id': 0}
            )
            return {"station_id": station_id, "data": doc, "source": "mongodb"}
        else:
            # Lấy tất cả stations
            cursor = stations_collection.find({}, {'_id': 0})
            stations = await cursor.to_list(length=100)
            return {
                "stations": stations,
                "count": len(stations),
                "source": "mongodb"
            }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ---------- 6. Query from Cloud Storage (Raw Data) ----------
@app.get("/api/raw")
async def get_raw_data(
    station_id: Optional[str] = None,
    date_prefix: Optional[str] = None,
    limit: int = 10
):
    """Lấy raw data từ Cloud Storage"""
    try:
        prefix = RAW_DATA_PREFIX
        if date_prefix:
            prefix = f"{RAW_DATA_PREFIX}/{date_prefix}"
        if station_id:
            prefix = f"{prefix}/{station_id}"
        
        blobs = list(bucket.list_blobs(prefix=prefix, max_results=limit))
        
        data = []
        for blob in blobs:
            content = blob.download_as_string()
            data.append({
                "filename": blob.name,
                "size": blob.size,
                "updated": blob.updated.isoformat() if blob.updated else None,
                "content": json.loads(content.decode('utf-8'))
            })
        
        return {
            "total": len(data),
            "data": data,
            "source": "cloud_storage"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ---------- 7. Statistics across all tiers ----------
@app.get("/api/stats")
async def get_stats():
    """Thống kê từ cả 3 tiers"""
    results = {
        "tiers": {
            "mongodb": {"status": "checking", "type": "Current State"},
            "bigquery": {"status": "checking", "type": "Historical Analytics"},
            "cloud_storage": {"status": "checking", "type": "Raw Data Lake"}
        }
    }
    
    # MongoDB stats
    try:
        count = await stations_collection.count_documents({})
        results["tiers"]["mongodb"]["stations_count"] = count
        results["tiers"]["mongodb"]["status"] = "online"
        
        # Lấy sample stations
        cursor = stations_collection.find({}, {'_id': 0}).limit(5)
        stations = await cursor.to_list(length=5)
        results["tiers"]["mongodb"]["sample_stations"] = [
            {
                "station_id": s.get('station_id'),
                "last_updated": s.get('last_updated')
            }
            for s in stations
        ]
    except Exception as e:
        results["tiers"]["mongodb"]["error"] = str(e)
    
    # BigQuery stats
    try:
        query = f"SELECT COUNT(*) as count FROM `{PROJECT_ID}.{DATASET_ID}.{TABLE_ID}`"
        rows = list(bq_client.query(query).result())
        results["tiers"]["bigquery"]["count"] = rows[0].count if rows else 0
        results["tiers"]["bigquery"]["status"] = "online"
        
        query_by_source = f"""
            SELECT source, COUNT(*) as count 
            FROM `{PROJECT_ID}.{DATASET_ID}.{TABLE_ID}` 
            GROUP BY source
        """
        rows = list(bq_client.query(query_by_source).result())
        results["tiers"]["bigquery"]["by_source"] = [
            {"source": row.source, "count": row.count} for row in rows
        ]
        
        query_by_quality = f"""
            SELECT quality_flag, COUNT(*) as count 
            FROM `{PROJECT_ID}.{DATASET_ID}.{TABLE_ID}` 
            GROUP BY quality_flag
        """
        rows = list(bq_client.query(query_by_quality).result())
        results["tiers"]["bigquery"]["by_quality"] = [
            {"quality_flag": row.quality_flag, "count": row.count} for row in rows
        ]
    except Exception as e:
        results["tiers"]["bigquery"]["error"] = str(e)
    
    # Cloud Storage stats
    try:
        blobs = list(bucket.list_blobs(prefix=RAW_DATA_PREFIX, max_results=1))
        results["tiers"]["cloud_storage"]["status"] = "online"
        results["tiers"]["cloud_storage"]["prefix"] = RAW_DATA_PREFIX
    except Exception as e:
        results["tiers"]["cloud_storage"]["error"] = str(e)
    
    return results


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)