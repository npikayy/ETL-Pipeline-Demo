import React, { useState } from 'react';

const ManualEntryForm = ({ fetchStats }) => {
  const [formData, setFormData] = useState({
    station_id: '',
    sensor_id: '',
    pH: '',
    DO: '',
    temperature: '',
    turbidity: '',
    EC: '',
    TDS: '',
    water_level: '',
    battery: '',
    ORP: '',
    timestamp: '',
  });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);

    try {
      const payload = {};
      for (const [key, value] of Object.entries(formData)) {
        if (value !== '' && value !== null && value !== undefined) {
          if (key === 'station_id' || key === 'sensor_id' || key === 'timestamp') {
            payload[key] = value;
          } else {
            payload[key] = parseFloat(value);
          }
        }
      }

      const response = await fetch('http://localhost:8000/api/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      setResult({ success: true, data });
      fetchStats();
      
      // Reset form
      setFormData({
        station_id: '',
        sensor_id: '',
        pH: '',
        DO: '',
        temperature: '',
        turbidity: '',
        EC: '',
        TDS: '',
        water_level: '',
        battery: '',
        ORP: '',
        timestamp: '',
      });
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
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
          <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
        </svg>
        <h2>Manual Data Entry</h2>
      </div>
      <p className="form-description">
        Nhập dữ liệu thủ công từ người dùng. Dữ liệu sẽ được gửi vào Pub/Sub 
        và xử lý qua Dataflow trước khi lưu vào BigQuery.
      </p>

      <form onSubmit={handleSubmit}>
        <div className="form-grid">
          <div className="form-group">
            <label>Station ID <span className="required">*</span></label>
            <input
              name="station_id"
              value={formData.station_id}
              onChange={handleChange}
              placeholder="e.g., CT_CANAL_001"
              required
            />
          </div>
          <div className="form-group">
            <label>Sensor ID <span className="required">*</span></label>
            <input
              name="sensor_id"
              value={formData.sensor_id}
              onChange={handleChange}
              placeholder="e.g., SENSOR_CT_001"
              required
            />
          </div>
          <div className="form-group">
            <label>Timestamp</label>
            <input
              name="timestamp"
              type="datetime-local"
              value={formData.timestamp}
              onChange={handleChange}
            />
          </div>
          <div className="form-group">
            <label>pH</label>
            <input
              name="pH"
              type="number"
              step="0.01"
              value={formData.pH}
              onChange={handleChange}
              placeholder="e.g., 7.35"
            />
          </div>
          <div className="form-group">
            <label>DO (mg/L)</label>
            <input
              name="DO"
              type="number"
              step="0.1"
              value={formData.DO}
              onChange={handleChange}
              placeholder="e.g., 6.8"
            />
          </div>
          <div className="form-group">
            <label>Temperature (°C)</label>
            <input
              name="temperature"
              type="number"
              step="0.1"
              value={formData.temperature}
              onChange={handleChange}
              placeholder="e.g., 28.4"
            />
          </div>
          <div className="form-group">
            <label>Turbidity (NTU)</label>
            <input
              name="turbidity"
              type="number"
              step="0.1"
              value={formData.turbidity}
              onChange={handleChange}
              placeholder="e.g., 12.5"
            />
          </div>
          <div className="form-group">
            <label>EC (μS/cm)</label>
            <input
              name="EC"
              type="number"
              step="1"
              value={formData.EC}
              onChange={handleChange}
              placeholder="e.g., 850"
            />
          </div>
          <div className="form-group">
            <label>TDS (mg/L)</label>
            <input
              name="TDS"
              type="number"
              step="1"
              value={formData.TDS}
              onChange={handleChange}
              placeholder="e.g., 425"
            />
          </div>
          <div className="form-group">
            <label>Water Level (m)</label>
            <input
              name="water_level"
              type="number"
              step="0.01"
              value={formData.water_level}
              onChange={handleChange}
              placeholder="e.g., 1.85"
            />
          </div>
          <div className="form-group">
            <label>ORP (mV)</label>
            <input
              name="ORP"
              type="number"
              step="1"
              value={formData.ORP}
              onChange={handleChange}
              placeholder="e.g., 245"
            />
          </div>
          <div className="form-group">
            <label>Battery (V)</label>
            <input
              name="battery"
              type="number"
              step="0.01"
              value={formData.battery}
              onChange={handleChange}
              placeholder="e.g., 3.85"
            />
          </div>
        </div>

        <button type="submit" disabled={loading} className="btn-primary-outline submit-full">
          <svg className="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="16 16 12 12 8 16" />
            <line x1="12" y1="12" x2="12" y2="21" />
            <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" />
          </svg>
          {loading ? 'Sending...' : 'Submit to Pub/Sub'}
        </button>
      </form>

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
            <strong>{result.success ? 'Success' : 'Error'}</strong>
          </div>
          <pre>{JSON.stringify(result.success ? result.data : result.error, null, 2)}</pre>
        </div>
      )}
    </div>
  );
};

export default ManualEntryForm;