# ETL Pipeline Demo

Dự án này là một demo pipeline ETL thời gian gần thực cho dữ liệu cảm biến chất lượng nước. Hệ thống mô phỏng việc thu thập dữ liệu từ trạm quan trắc, đưa dữ liệu vào Google Pub/Sub, xử lý bằng Apache Beam chạy trên Google Cloud Dataflow, sau đó lưu cùng một dòng dữ liệu vào 3 tầng lưu trữ khác nhau:

- BigQuery: lưu dữ liệu đã chuẩn hóa để phân tích lịch sử.
- MongoDB Atlas: lưu trạng thái mới nhất của từng trạm quan trắc.
- Cloud Storage: lưu payload JSON làm raw data lake.

Frontend React cung cấp giao diện để gửi dữ liệu IoT giả lập, nhập dữ liệu thủ công, upload batch dữ liệu lịch sử và xem dashboard tổng quan. Backend FastAPI đóng vai trò API gateway, nhận dữ liệu từ frontend và publish vào Pub/Sub. Dataflow là thành phần chính thực hiện parse, validate, chuẩn hóa và ghi dữ liệu sang các storage tier.

## Kiến trúc tổng quan

```text
React Frontend
    |
    | POST /api/iot
    | POST /api/manual
    | POST /api/batch
    v
FastAPI Backend
    |
    | Publish JSON message
    v
Google Pub/Sub topic: sensor-data
    |
    | Streaming subscription: sensor-data-sub
    v
Apache Beam / Dataflow
    |
    | Parse, validate, normalize, quality flag
    |
    +--> BigQuery: historical analytics
    |
    +--> MongoDB Atlas: current state by station
    |
    +--> Cloud Storage: raw JSON data lake
```

## Thành phần chính

### Frontend

Thư mục: `frontend/`

Ứng dụng React gồm các màn hình:

- `Dashboard`: hiển thị trạng thái 3 storage tier, dữ liệu mới nhất từ MongoDB và dữ liệu lịch sử từ BigQuery.
- `IoT Data Simulator`: tạo dữ liệu cảm biến giả lập và gửi vào API `/api/iot`.
- `Manual Data Entry`: nhập dữ liệu thủ công và gửi vào API `/api/manual`.
- `Batch Upload`: tạo nhiều record dữ liệu lịch sử và gửi vào API `/api/batch`.

Frontend đang gọi backend tại:

```text
http://localhost:8000
```

### Backend API

Thư mục: `backend/`

Backend dùng FastAPI, có nhiệm vụ:

- Nhận dữ liệu từ frontend.
- Gắn thêm `observation_id`, `timestamp`, `source` cho từng record.
- Publish message vào Google Pub/Sub.
- Query dữ liệu từ BigQuery, MongoDB Atlas và Cloud Storage để phục vụ dashboard.

Các endpoint chính:

| Endpoint | Mục đích |
| --- | --- |
| `GET /` | Kiểm tra API đang chạy |
| `POST /api/iot` | Nhận dữ liệu IoT giả lập |
| `POST /api/manual` | Nhận dữ liệu nhập thủ công |
| `POST /api/batch` | Nhận batch dữ liệu lịch sử, tối đa 1000 record |
| `GET /api/data` | Query dữ liệu lịch sử từ BigQuery |
| `GET /api/current` | Query trạng thái hiện tại từ MongoDB Atlas |
| `GET /api/raw` | Query raw payload từ Cloud Storage |
| `GET /api/stats` | Lấy thống kê trạng thái của 3 storage tier |

### Dataflow Pipeline

File chính: `backend/dataflow_pipeline.py`

Pipeline chạy dạng streaming:

1. Đọc message từ Pub/Sub subscription `sensor-data-sub`.
2. Parse JSON payload.
3. Chuẩn hóa schema dữ liệu cảm biến.
4. Validate các chỉ số quan trọng.
5. Gắn `quality_flag`.
6. Ghi dữ liệu ra 3 đích: BigQuery, MongoDB Atlas và Cloud Storage.

## Luồng dữ liệu chi tiết

### 1. Ingestion từ frontend

Dữ liệu có thể đi vào hệ thống theo 3 cách:

- IoT simulator: mô phỏng cảm biến gửi dữ liệu mới.
- Manual entry: người dùng nhập một record cụ thể.
- Batch upload: tạo nhiều record lịch sử theo timestamp lùi dần.

Payload đầu vào có các trường như:

```json
{
  "station_id": "CT_CANAL_001",
  "sensor_id": "SENSOR_CT_001",
  "pH": 7.35,
  "DO": 6.8,
  "temperature": 28.4,
  "turbidity": 12.5,
  "EC": 850,
  "TDS": 425,
  "ORP": 245,
  "water_level": 1.85,
  "battery": 3.85,
  "timestamp": "2026-07-02T10:00:00"
}
```

Backend bổ sung:

- `observation_id`: mã định danh duy nhất cho record.
- `source`: `iot`, `manual` hoặc `batch`.
- `timestamp`: thời điểm dữ liệu được ghi nhận nếu client chưa gửi.

Sau đó backend publish payload vào Pub/Sub topic.

### 2. Pub/Sub làm message broker

Pub/Sub là điểm trung gian giữa API và Dataflow. Backend không ghi trực tiếp vào BigQuery, MongoDB hoặc Cloud Storage. Điều này giúp pipeline tách biệt ingestion với xử lý dữ liệu:

- API chỉ cần nhận request và publish message.
- Dataflow chịu trách nhiệm xử lý, validate và lưu trữ.
- Khi lượng dữ liệu tăng, Dataflow có thể scale độc lập.

### 3. Parse, validate và chuẩn hóa trong Dataflow

Dataflow dùng transform `ParseAndValidate` để chuyển payload thô thành schema chuẩn:

| Input | Output chuẩn |
| --- | --- |
| `DO` hoặc `dissolved_oxygen` | `dissolved_oxygen_mg_l` |
| `temperature` hoặc `temp` | `temperature_c` |
| `EC` hoặc `electrical_conductivity` | `electrical_conductivity_us_cm` |
| `TDS` hoặc `tds` | `tds_mg_l` |
| `ORP` hoặc `orp` | `orp_mv` |
| `battery` | `battery_voltage` |

Pipeline gắn `quality_flag` theo logic:

- `VALID`: pH nằm trong khoảng 0-14 và DO nằm trong khoảng 0-20.
- `INVALID`: pH hoặc DO vượt khoảng hợp lệ.
- `SUSPECT`: thiếu pH hoặc thiếu DO.

Các message lỗi JSON sẽ bị đánh dấu lỗi và không ghi vào các storage tier.

### 4. Ghi vào BigQuery

BigQuery lưu toàn bộ dữ liệu đã chuẩn hóa để phục vụ phân tích lịch sử.

Dataset và table mặc định:

```text
water_quality.sensor_data_cleaned
```

Schema BigQuery gồm:

- `observation_id`
- `timestamp`
- `station_id`
- `sensor_id`
- `pH`
- `dissolved_oxygen_mg_l`
- `temperature_c`
- `turbidity_ntu`
- `electrical_conductivity_us_cm`
- `tds_mg_l`
- `orp_mv`
- `water_level_m`
- `battery_voltage`
- `quality_flag`
- `source`
- `processed_at`

Dashboard sử dụng endpoint `/api/data` để query BigQuery với phân trang và filter theo `station_id`, `quality_flag`, `start_date`, `end_date`.

### 5. Ghi vào MongoDB Atlas

MongoDB Atlas lưu current state của từng `station_id`. Mỗi trạm chỉ có một document mới nhất.

Khi Dataflow nhận record mới, pipeline sẽ:

- Tìm document theo `station_id`.
- So sánh timestamp mới với `last_updated` hiện có.
- Chỉ update nếu record mới hơn hoặc bằng record hiện tại.
- Bỏ qua record batch cũ để tránh ghi đè trạng thái mới.

Document MongoDB có dạng:

```json
{
  "station_id": "CT_CANAL_001",
  "sensor_id": "SENSOR_CT_001",
  "readings": {
    "pH": 7.35,
    "dissolved_oxygen": 6.8,
    "temperature": 28.4,
    "turbidity": 12.5,
    "EC": 850,
    "TDS": 425,
    "ORP": 245,
    "water_level": 1.85,
    "battery": 3.85
  },
  "quality_flag": "VALID",
  "source": "iot",
  "last_updated": "2026-07-02T10:00:00"
}
```

Dashboard sử dụng endpoint `/api/current` để hiển thị trạng thái hiện tại của các station.

### 6. Ghi vào Cloud Storage

Cloud Storage lưu raw payload theo cấu trúc thư mục:

```text
raw/water-quality/YYYY/MM/DD/{station_id}/{observation_id}.json
```

Mỗi file JSON chứa:

- `raw_payload`: record sau parse và chuẩn hóa.
- `ingestion_timestamp`: thời điểm ghi vào data lake.
- `source_type`: nguồn dữ liệu ban đầu.

Storage tier này phù hợp cho audit, replay pipeline hoặc xử lý lại dữ liệu trong tương lai.

## Cấu hình môi trường

Backend đọc cấu hình từ biến môi trường hoặc file `.env` trong thư mục `backend/`.

Các biến chính:

```env
GOOGLE_CLOUD_PROJECT=your-project-id
PUBSUB_TOPIC=sensor-data
BIGQUERY_DATASET=water_quality
BIGQUERY_TABLE=sensor_data_cleaned
REGION=us-central1

MONGODB_URI=mongodb+srv://...
MONGODB_DB=water_quality
MONGODB_COLLECTION=stations

BUCKET_NAME=your-raw-data-bucket
RAW_DATA_PREFIX=raw/water-quality
```

Google Cloud client cũng cần credentials hợp lệ, ví dụ qua biến:

```env
GOOGLE_APPLICATION_CREDENTIALS=credentials.json
```

Lưu ý: không nên commit file `.env` hoặc `credentials.json` chứa thông tin thật lên repository public.

## Cách chạy dự án

### 1. Chạy backend

```bash
cd backend
pip install -r requirement.txt
uvicorn app:app --reload --host 0.0.0.0 --port 8000
```

API sẽ chạy tại:

```text
http://localhost:8000
```

### 2. Chạy frontend

```bash
cd frontend
npm install
npm start
```

Frontend mặc định chạy tại:

```text
http://localhost:3000
```

### 3. Chạy Dataflow pipeline

Trước khi chạy pipeline, cần đảm bảo đã có:

- Pub/Sub topic `sensor-data`.
- Pub/Sub subscription `sensor-data-sub`.
- BigQuery dataset hoặc quyền để pipeline tự tạo table.
- Cloud Storage bucket cho temp/staging và raw data.
- MongoDB Atlas URI hợp lệ.
- Google Cloud credentials có quyền Pub/Sub, Dataflow, BigQuery và Cloud Storage.

Chạy pipeline:

```bash
cd backend
python dataflow_pipeline.py
```

Pipeline hiện dùng `DataflowRunner` và streaming mode, nên job sẽ chạy liên tục trên Google Cloud Dataflow.

## Mục tiêu của demo

Dự án minh họa một kiến trúc ETL phổ biến cho dữ liệu sensor/IoT:

- Ingestion realtime bằng API và Pub/Sub.
- Xử lý streaming bằng Dataflow.
- Tách storage theo mục đích sử dụng.
- BigQuery cho analytics.
- MongoDB cho trạng thái vận hành mới nhất.
- Cloud Storage cho raw data lake.
- Dashboard để quan sát dữ liệu và tình trạng pipeline.

Thiết kế này giúp hệ thống dễ mở rộng: frontend/backend có thể thay đổi mà không ảnh hưởng trực tiếp tới các storage tier, còn Dataflow có thể scale độc lập khi khối lượng message tăng.
