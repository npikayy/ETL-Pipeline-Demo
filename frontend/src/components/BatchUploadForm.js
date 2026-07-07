import React, { useState } from 'react';

const BatchUploadForm = ({ fetchStats }) => {
  const [stationId, setStationId] = useState('CT_CANAL_001');
  const [sensorId, setSensorId] = useState('SENSOR_CT_001');
  const [recordCount, setRecordCount] = useState(10);
  const [startDate, setStartDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  const generateBatchData = () => {
    const data = [];
    const start = startDate ? new Date(startDate) : new Date();
    
    for (let i = 0; i < recordCount; i++) {
      const timestamp = new Date(start.getTime() - i * 60000);
      data.push({
        station_id: stationId,
        sensor_id: sensorId,
        timestamp: timestamp.toISOString(),
        pH: parseFloat((7 + Math.random() * 1.5).toFixed(2)),
        DO: parseFloat((5 + Math.random() * 3).toFixed(2)),
        temperature: parseFloat((25 + Math.random() * 8).toFixed(1)),
        turbidity: parseFloat((5 + Math.random() * 20).toFixed(1)),
        EC: parseFloat((700 + Math.random() * 300).toFixed(0)),
        TDS: parseFloat((350 + Math.random() * 150).toFixed(0)),
        water_level: parseFloat((1.5 + Math.random() * 0.8).toFixed(2)),
        ORP: parseFloat((200 + Math.random() * 100).toFixed(0)),
        battery: parseFloat((3.5 + Math.random() * 0.8).toFixed(2)),
      });
    }
    return data;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    setProgress({ current: 0, total: recordCount });

    try {
      const data = generateBatchData();
      
      const response = await fetch('http://localhost:8000/api/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data }),
      });

      const resultData = await response.json();
      setResult({ success: true, data: resultData });
      
      // Update progress
      setProgress({ current: resultData.success || 0, total: recordCount });
      
      fetchStats();
    } catch (error) {
      setResult({ success: false, error: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="form-container">
      <div className="form-header">
        <svg className="form-title-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
          <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
        </svg>
        <h2>Batch Upload (Historical Data)</h2>
      </div>
      <p className="form-description">
        Tạo và upload một batch dữ liệu lịch sử. Mỗi record sẽ được gửi vào Pub/Sub
        và xử lý qua Dataflow trước khi lưu vào BigQuery.
      </p>

      <form onSubmit={handleSubmit}>
        <div className="form-grid">
          <div className="form-group">
            <label>Station ID</label>
            <input
              value={stationId}
              onChange={(e) => setStationId(e.target.value)}
              placeholder="e.g., CT_CANAL_001"
            />
          </div>
          <div className="form-group">
            <label>Sensor ID</label>
            <input
              value={sensorId}
              onChange={(e) => setSensorId(e.target.value)}
              placeholder="e.g., SENSOR_CT_001"
            />
          </div>
          <div className="form-group">
            <label>Number of Records</label>
            <input
              type="number"
              min="1"
              max="1000"
              value={recordCount}
              onChange={(e) => setRecordCount(parseInt(e.target.value) || 1)}
            />
          </div>
          <div className="form-group">
            <label>Start Date (going backward)</label>
            <input
              type="datetime-local"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
        </div>

        <div className="batch-info">
          <div className="batch-info-item">
            <svg className="batch-icon-small" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="20" x2="18" y2="10" />
              <line x1="12" y1="20" x2="12" y2="4" />
              <line x1="6" y1="20" x2="6" y2="14" />
            </svg>
            <span>Records to upload:</span>
            <strong>{recordCount}</strong>
          </div>
          <div className="batch-info-item">
            <svg className="batch-icon-small" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            <span>Station:</span>
            <strong>{stationId}</strong>
          </div>
        </div>

        <button type="submit" disabled={loading} className="btn-primary-outline submit-full">
          <svg className="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="16 16 12 12 8 16" />
            <line x1="12" y1="12" x2="12" y2="21" />
            <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" />
          </svg>
          {loading ? 'Uploading...' : 'Upload Batch'}
        </button>
      </form>

      {loading && progress.total > 0 && (
        <div className="progress-container">
          <div className="progress-bar">
            <div 
              className="progress-fill" 
              style={{ width: `${(progress.current / progress.total) * 100}%` }}
            />
          </div>
          <div className="progress-text">
            {progress.current} / {progress.total} records processed
          </div>
        </div>
      )}

      {result && (
        <div className={`result-panel ${result.success ? 'success' : 'error'}`}>
          <div className="result-header">
            {result.success ? (
              <svg className="result-icon success" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            ) : (
              <svg className="result-icon error" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            )}
            <strong>{result.success ? 'Upload Complete' : 'Upload Failed'}</strong>
          </div>
          {result.success && result.data && (
            <div className="batch-result-summary">
              <div>Total: <strong>{result.data.total}</strong></div>
              <div>Success: <strong>{result.data.success}</strong></div>
              <div>Failed: <strong style={{ color: result.data.failed > 0 ? 'var(--color-danger)' : 'inherit' }}>{result.data.failed}</strong></div>
            </div>
          )}
          <pre>{JSON.stringify(result.success ? result.data : result.error, null, 2)}</pre>
        </div>
      )}
    </div>
  );
};

export default BatchUploadForm;