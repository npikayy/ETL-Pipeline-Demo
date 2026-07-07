import React, { useState } from 'react';

const IoTDataForm = ({ fetchStats }) => {
  const [formData, setFormData] = useState({
    station_id: 'CT_CANAL_001',
    sensor_id: 'SENSOR_CT_001',
    pH: '7.35',
    DO: '6.8',
    temperature: '28.4',
    turbidity: '12.5',
    EC: '850',
    TDS: '425',
    water_level: '1.85',
    battery: '3.85',
    ORP: '245',
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
      const payload = {
        ...formData,
        pH: formData.pH !== '' ? parseFloat(formData.pH) : null,
        DO: formData.DO !== '' ? parseFloat(formData.DO) : null,
        temperature: formData.temperature !== '' ? parseFloat(formData.temperature) : null,
        turbidity: formData.turbidity !== '' ? parseFloat(formData.turbidity) : null,
        EC: formData.EC !== '' ? parseFloat(formData.EC) : null,
        TDS: formData.TDS !== '' ? parseFloat(formData.TDS) : null,
        water_level: formData.water_level !== '' ? parseFloat(formData.water_level) : null,
        battery: formData.battery !== '' ? parseFloat(formData.battery) : null,
        ORP: formData.ORP !== '' ? parseFloat(formData.ORP) : null,
      };

      const response = await fetch('http://localhost:8000/api/iot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      setResult({ success: true, data });
      fetchStats();
    } catch (error) {
      setResult({ success: false, error: error.message });
    } finally {
      setLoading(false);
    }
  };

  const generateRandomData = () => {
    setFormData({
      ...formData,
      pH: (7 + Math.random() * 1.5).toFixed(2),
      DO: (5 + Math.random() * 3).toFixed(2),
      temperature: (25 + Math.random() * 8).toFixed(1),
      turbidity: (5 + Math.random() * 20).toFixed(1),
      EC: (700 + Math.random() * 300).toFixed(0),
      TDS: (350 + Math.random() * 150).toFixed(0),
      water_level: (1.5 + Math.random() * 0.8).toFixed(2),
      ORP: (200 + Math.random() * 100).toFixed(0),
      battery: (3.5 + Math.random() * 0.7).toFixed(2),
    });
  };

  return (
    <div className="form-container">
      <div className="form-header">
        <svg className="form-title-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="2" />
          <path d="M16.24 7.76a6 6 0 0 1 0 8.49m-8.48-.01a6 6 0 0 1 0-8.49m11.31-2.82a10 10 0 0 1 0 14.14m-14.14 0a10 10 0 0 1 0-14.14" />
        </svg>
        <h2>IoT Data Simulator</h2>
      </div>
      <p className="form-description">
        Mô phỏng dữ liệu từ cảm biến IoT được gửi về mỗi 1-5 phút.
        Dữ liệu sẽ đi qua Pub/Sub → Dataflow → BigQuery.
      </p>

      <div className="form-controls">
        <button onClick={generateRandomData} className="btn-secondary-outline">
          <svg className="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <circle cx="15.5" cy="15.5" r="1.5" />
            <circle cx="15.5" cy="8.5" r="1.5" />
            <circle cx="8.5" cy="15.5" r="1.5" />
            <circle cx="12" cy="12" r="1.5" />
          </svg>
          Generate Random
        </button>
        <button onClick={handleSubmit} disabled={loading} className="btn-primary-outline">
          <svg className="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="16 16 12 12 8 16" />
            <line x1="12" y1="12" x2="12" y2="21" />
            <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" />
          </svg>
          {loading ? 'Sending...' : 'Send to Pub/Sub'}
        </button>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="form-grid">
          <div className="form-group">
            <label>Station ID</label>
            <input
              name="station_id"
              value={formData.station_id}
              onChange={handleChange}
              placeholder="e.g., CT_CANAL_001"
            />
          </div>
          <div className="form-group">
            <label>Sensor ID</label>
            <input
              name="sensor_id"
              value={formData.sensor_id}
              onChange={handleChange}
              placeholder="e.g., SENSOR_CT_001"
            />
          </div>
          <div className="form-group">
            <label>pH (0-14)</label>
            <input
              name="pH"
              type="number"
              step="0.01"
              value={formData.pH}
              onChange={handleChange}
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
            />
          </div>
        </div>
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

export default IoTDataForm;