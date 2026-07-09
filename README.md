# Water Quality ETL Pipeline Demo

This project demonstrates a near-real-time ETL pipeline for water-quality sensor data. It combines a React user interface, a FastAPI ingestion API, Google Pub/Sub, and an Apache Beam streaming pipeline running on Google Cloud Dataflow.

Each validated observation is written to three storage tiers:

- **BigQuery** for historical analytics and Looker Studio reporting.
- **MongoDB Atlas** for the latest operational state of each monitoring station.
- **Google Cloud Storage** for JSON records that can be audited or reprocessed.

The application supports simulated IoT readings, manual data entry, historical batch uploads, and a dashboard for viewing the resulting data.

## Data Flow

```mermaid
flowchart LR
    UI["React Frontend<br/>IoT, Manual, Batch"]
    API["FastAPI Backend<br/>Enrich and publish"]
    TOPIC["Pub/Sub Topic<br/>sensor-data"]
    SUB["Pub/Sub Subscription<br/>sensor-data-sub"]
    DF["Apache Beam / Dataflow<br/>Parse, normalize, validate"]
    BQ[("BigQuery<br/>Historical analytics")]
    MDB[("MongoDB Atlas<br/>Current station state")]
    GCS[("Cloud Storage<br/>JSON data lake")]
    LS["Looker Studio<br/>Charts and reports"]
    DASH["React Dashboard"]

    UI -->|"POST /api/iot<br/>POST /api/manual<br/>POST /api/batch"| API
    API -->|"JSON message"| TOPIC
    TOPIC --> SUB
    SUB --> DF
    DF -->|"Append all valid records"| BQ
    DF -->|"Upsert latest timestamp"| MDB
    DF -->|"Write partitioned JSON"| GCS
    BQ --> LS
    BQ -->|"GET /api/data"| DASH
    MDB -->|"GET /api/current"| DASH
    GCS -->|"GET /api/raw"| DASH
```

## Architecture

### React Frontend

The `frontend/` application provides:

- An IoT data simulator.
- A manual observation form.
- Historical batch generation and upload.
- A dashboard for historical, current-state, and storage-tier statistics.

The frontend connects to the backend at `http://localhost:8000`.

### FastAPI Backend

The backend in `backend/app.py` acts as the ingestion and query API. For incoming observations, it adds metadata such as `observation_id`, `timestamp`, and `source`, then publishes the JSON payload to Pub/Sub. Dataflow, rather than the API, performs all writes to the three storage tiers.

The backend also reads from BigQuery, MongoDB Atlas, and Cloud Storage to serve the dashboard.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/` | API health check |
| `POST` | `/api/iot` | Publish a simulated IoT observation |
| `POST` | `/api/manual` | Publish a manually entered observation |
| `POST` | `/api/batch` | Publish up to 1,000 historical observations |
| `GET` | `/api/data` | Query paginated BigQuery history |
| `GET` | `/api/current` | Read the latest station states from MongoDB |
| `GET` | `/api/raw` | Read JSON records from Cloud Storage |
| `GET` | `/api/stats` | Check statistics for all storage tiers |

### Dataflow Streaming Pipeline

The pipeline is defined in `backend/dataflow_pipeline.py` and runs continuously with `DataflowRunner`.

1. Read messages from `sensor-data-sub`.
2. Decode and parse each JSON message.
3. Normalize sensor field names into a common schema.
4. Validate pH and dissolved oxygen values.
5. Filter malformed JSON records.
6. Fan out each accepted record to all three storage destinations.

The normalization rules include:

| Input field | Normalized field |
| --- | --- |
| `DO` or `dissolved_oxygen` | `dissolved_oxygen_mg_l` |
| `temperature` or `temp` | `temperature_c` |
| `EC` or `electrical_conductivity` | `electrical_conductivity_us_cm` |
| `TDS` or `tds` | `tds_mg_l` |
| `ORP` or `orp` | `orp_mv` |
| `battery` | `battery_voltage` |

Quality flags are assigned as follows:

- `VALID`: pH is between 0 and 14, and dissolved oxygen is between 0 and 20 mg/L.
- `INVALID`: pH or dissolved oxygen is outside its accepted range.
- `SUSPECT`: pH or dissolved oxygen is missing.

## Storage Model

### BigQuery

The default destination is:

```text
water_quality.sensor_data_cleaned
```

BigQuery stores normalized observations using append-only writes. This tier supports time-series analysis, filtering by station and quality flag, and visualization in Looker Studio.

### MongoDB Atlas

MongoDB stores one current-state document per `station_id`. Dataflow compares timestamps and only updates a station when an incoming observation is at least as recent as the stored document. This prevents historical batch records from replacing live station state.

### Cloud Storage

Cloud Storage records are written using the following object structure:

```text
raw/water-quality/YYYY/MM/DD/{station_id}/{observation_id}.json
```

Each object contains the normalized payload, ingestion timestamp, and source type.

## Project Structure

```text
.
|-- backend/
|   |-- app.py
|   |-- config.py
|   |-- dataflow_pipeline.py
|   |-- requirement.txt
|   `-- credentials.json       # Local only; ignored by Git
|-- frontend/
|   |-- public/
|   |-- src/
|   `-- package.json
|-- start-dev.ps1
|-- .gitignore
`-- README.md
```

## Prerequisites

- Python with a virtual environment at `venv/`.
- Node.js and npm.
- A Google Cloud project with Pub/Sub, BigQuery, Cloud Storage, and Dataflow enabled.
- A MongoDB Atlas deployment or another compatible MongoDB instance.
- A Google Cloud service-account key at `backend/credentials.json`.

The Google Cloud account used by the application and pipeline must have access to the required Pub/Sub, BigQuery, Cloud Storage, and Dataflow resources.

## Configuration

Create `backend/.env` and provide the environment-specific values:

```env
GOOGLE_CLOUD_PROJECT=your-project-id
PUBSUB_TOPIC=sensor-data
BIGQUERY_DATASET=water_quality
BIGQUERY_TABLE=sensor_data_cleaned
REGION=us-central1

MONGODB_URI=mongodb+srv://username:password@cluster.example/
MONGODB_DB=water_quality
MONGODB_COLLECTION=stations

BUCKET_NAME=your-raw-data-bucket
RAW_DATA_PREFIX=raw/water-quality
```

Do not commit `.env`, `credentials.json`, or other service-account keys.

## Installation

Create the virtual environment and install backend dependencies:

```powershell
python -m venv venv
.\venv\Scripts\Activate.ps1
python -m pip install -r .\backend\requirement.txt
```

Install frontend dependencies:

```powershell
Set-Location .\frontend
npm install
Set-Location ..
```

If PowerShell blocks virtual-environment scripts, allow them for the current terminal session:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy RemoteSigned
```

## Run Locally

From the project root, start both the backend and frontend in the current VS Code terminal:

```powershell
.\start-dev.ps1
```

The script:

- Verifies that `venv`, npm, and `backend/credentials.json` are available.
- Sets `GOOGLE_APPLICATION_CREDENTIALS` for the backend process.
- Starts FastAPI at `http://localhost:8000`.
- Starts React at `http://localhost:3000`.
- Keeps both logs in the same terminal.

Press `Ctrl+C` to stop both services.

To run the services separately:

```powershell
Set-Location .\backend
$env:GOOGLE_APPLICATION_CREDENTIALS = "$PWD\credentials.json"
..\venv\Scripts\python.exe -m uvicorn app:app --host 0.0.0.0 --port 8000 --reload
```

```powershell
Set-Location .\frontend
npm start
```

## Run the Dataflow Job

Before submitting the pipeline, ensure that the following resources exist and match the values in `backend/config.py` and `backend/.env`:

- Pub/Sub topic: `sensor-data`.
- Pub/Sub subscription: `sensor-data-sub`.
- BigQuery dataset: `water_quality`.
- Cloud Storage buckets used for raw data, Dataflow staging, and temporary files.
- MongoDB database and collection.

Then run:

```powershell
Set-Location .\backend
$env:GOOGLE_APPLICATION_CREDENTIALS = "$PWD\credentials.json"
..\venv\Scripts\python.exe dataflow_pipeline.py
```

The submitted streaming job is named `sensor-data-etl-3tiers`. Its worker logs show validation warnings, MongoDB upserts or skipped older records, Cloud Storage writes, and processing errors.

## Looker Studio

The BigQuery table can be used directly as a Looker Studio data source. In the BigQuery console, select `water_quality.sensor_data_cleaned`, then choose **Explore data** and **Explore with Looker Studio**.

Useful visualizations include:

- Time-series charts for pH, dissolved oxygen, and temperature.
- Scorecards for observation count and average measurements.
- Quality-flag distribution charts.
- Tables and filters grouped by station and time range.

Looker Studio queries BigQuery when the report refreshes, so BigQuery query costs and data freshness settings should be considered for larger datasets.

## Demo Scope

This project demonstrates:

- Decoupled ingestion with FastAPI and Pub/Sub.
- Near-real-time transformation with Apache Beam and Dataflow.
- Schema normalization and basic data-quality classification.
- Purpose-specific storage for analytics, operational state, and archival data.
- Dashboard APIs and BigQuery reporting through Looker Studio.
