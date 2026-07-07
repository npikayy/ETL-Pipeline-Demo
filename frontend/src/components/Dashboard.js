import React, { useState, useEffect } from 'react';

const Dashboard = ({ stats, fetchStats, error }) => {
  const [recentData, setRecentData] = useState([]);
  const [currentState, setCurrentState] = useState({});
  const [loading, setLoading] = useState(false);
  const [dataError, setDataError] = useState(null);
  
  // ===== PAGINATION & FILTERS =====
  const [currentPage, setCurrentPage] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [stationFilter, setStationFilter] = useState('');
  const [qualityFilter, setQualityFilter] = useState('');

  useEffect(() => {
    if (!error) {
      fetchCurrentState();
    }
  }, [error]);

  useEffect(() => {
    if (!error) {
      fetchRecentData(currentPage);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [error, currentPage, pageSize, stationFilter, qualityFilter]);

  const fetchRecentData = async (page = 1) => {
    setLoading(true);
    setDataError(null);
    try {
      const offset = (page - 1) * pageSize;
      let url = `http://localhost:8000/api/data?limit=${pageSize}&offset=${offset}`;
      
      if (stationFilter) {
        url += `&station_id=${encodeURIComponent(stationFilter)}`;
      }
      if (qualityFilter) {
        url += `&quality_flag=${encodeURIComponent(qualityFilter)}`;
      }

      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      setRecentData(data.data || []);
      setTotalRecords(data.total || 0);
      setTotalPages(Math.ceil((data.total || 0) / pageSize) || 1);
      setCurrentPage(page);
    } catch (error) {
      console.error('Error fetching data:', error);
      setDataError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchCurrentState = async () => {
    try {
      const response = await fetch('http://localhost:8000/api/current');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setCurrentState(data);
    } catch (error) {
      console.error('Error fetching current state:', error);
    }
  };

  // ===== FILTER HANDLERS =====
  const handleStationFilterChange = (val) => {
    setStationFilter(val);
    setCurrentPage(1);
  };

  const handleQualityFilterChange = (val) => {
    setQualityFilter(val);
    setCurrentPage(1);
  };

  const handlePageSizeChange = (val) => {
    setPageSize(val);
    setCurrentPage(1);
  };

  const handlePageChange = (page) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  // Extract unique station IDs from currentState for dynamic filters
  const availableStations = currentState.stations
    ? [...new Set(currentState.stations.map(s => s.station_id))].filter(Boolean)
    : [];

  const getTierStatus = (status) => {
    return status === 'online' ? 'online' : 'offline';
  };

  // ===== PAGE NUMBER GENERATOR =====
  const getPageNumbers = () => {
    const pages = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (currentPage <= 4) {
        for (let i = 1; i <= 5; i++) {
          pages.push(i);
        }
        pages.push('ellipsis');
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 3) {
        pages.push(1);
        pages.push('ellipsis');
        for (let i = totalPages - 4; i <= totalPages; i++) {
          pages.push(i);
        }
      } else {
        pages.push(1);
        pages.push('ellipsis');
        for (let i = currentPage - 1; i <= currentPage + 1; i++) {
          pages.push(i);
        }
        pages.push('ellipsis');
        pages.push(totalPages);
      }
    }
    return pages;
  };

  // ===== RENDER PAGINATION =====
  const renderPagination = () => {
    const startRecord = totalRecords === 0 ? 0 : (currentPage - 1) * pageSize + 1;
    const endRecord = Math.min(currentPage * pageSize, totalRecords);

    return (
      <div className="pagination-container">
        <div className="pagination-summary">
          Showing <span>{startRecord}</span> - <span>{endRecord}</span> of <span>{totalRecords}</span> records
        </div>
        
        <div className="pagination-controls">
          <button 
            onClick={() => handlePageChange(1)} 
            disabled={currentPage === 1}
            className="pagination-btn"
            title="First Page"
          >
            <svg className="page-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="11 17 6 12 11 7" />
              <polyline points="18 17 13 12 18 7" />
            </svg>
          </button>
          <button 
            onClick={() => handlePageChange(currentPage - 1)} 
            disabled={currentPage === 1}
            className="pagination-btn"
            title="Previous Page"
          >
            <svg className="page-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          
          {getPageNumbers().map((page, idx) => {
            if (page === 'ellipsis') {
              return <span key={`ellipsis-${idx}`} className="pagination-ellipsis">•••</span>;
            }
            return (
              <button
                key={page}
                onClick={() => handlePageChange(page)}
                className={`pagination-btn ${page === currentPage ? 'active' : ''}`}
              >
                {page}
              </button>
            );
          })}
          
          <button 
            onClick={() => handlePageChange(currentPage + 1)} 
            disabled={currentPage === totalPages || totalPages === 0}
            className="pagination-btn"
            title="Next Page"
          >
            <svg className="page-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
          <button 
            onClick={() => handlePageChange(totalPages)} 
            disabled={currentPage === totalPages || totalPages === 0}
            className="pagination-btn"
            title="Last Page"
          >
            <svg className="page-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="13 17 18 12 13 7" />
              <polyline points="6 17 11 12 6 7" />
            </svg>
          </button>
        </div>
      </div>
    );
  };

  // Nếu có lỗi kết nối backend chính
  if (error) {
    return (
      <div className="empty-state connection-error">
        <svg className="empty-icon-svg error-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18.36 6.64a9 9 0 1 1-12.73 0M12 2v10" />
        </svg>
        <h3>Backend Disconnected</h3>
        <p>Please start the backend server on port 8000</p>
        <button onClick={fetchStats} className="btn-primary-outline" style={{ marginTop: 16 }}>
          <svg className="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M23 4v6h-6" />
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
          </svg>
          Retry Connection
        </button>
      </div>
    );
  }

  return (
    <div className="dashboard">
      {/* ===== 3 TIERS OVERVIEW ===== */}
      <div className="tiers-overview">
        <div className="section-header">
          <svg className="section-title-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          </svg>
          <h3>3 Storage Tiers</h3>
        </div>
        <div className="tiers-grid">
          {/* MongoDB card */}
          <div className="tier-card mongodb">
            <div className="tier-card-header-row">
              <svg className="tier-card-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <ellipse cx="12" cy="5" rx="9" ry="3" />
                <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
                <path d="M3 12c0 1.66 4 3 9 3s9-1.34 9-3" />
              </svg>
              <div className={`tier-status ${getTierStatus(stats?.tiers?.mongodb?.status)}`}>
                <span className="status-indicator-dot"></span>
                {stats?.tiers?.mongodb?.status === 'online' ? 'Online' : 'Offline'}
              </div>
            </div>
            <div className="tier-name">MongoDB Atlas</div>
            <div className="tier-desc">Operational Store (Current State)</div>
            <div className="tier-stats">
              Stations count: <strong>{stats?.tiers?.mongodb?.stations_count || 0}</strong>
            </div>
          </div>
          
          {/* BigQuery card */}
          <div className="tier-card bigquery">
            <div className="tier-card-header-row">
              <svg className="tier-card-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="20" x2="18" y2="10" />
                <line x1="12" y1="20" x2="12" y2="4" />
                <line x1="6" y1="20" x2="6" y2="14" />
              </svg>
              <div className={`tier-status ${getTierStatus(stats?.tiers?.bigquery?.status)}`}>
                <span className="status-indicator-dot"></span>
                {stats?.tiers?.bigquery?.status === 'online' ? 'Online' : 'Offline'}
              </div>
            </div>
            <div className="tier-name">BigQuery</div>
            <div className="tier-desc">Historical Analytics Store</div>
            <div className="tier-stats">
              Total records: <strong>{stats?.tiers?.bigquery?.count || 0}</strong>
            </div>
          </div>
          
          {/* Cloud Storage card */}
          <div className="tier-card storage">
            <div className="tier-card-header-row">
              <svg className="tier-card-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17.5 19A3.5 3.5 0 0 0 21 15.5c0-2.79-2.54-4.5-5-4.5-.42-1.89-1.89-3.5-4-3.5a5.5 5.5 0 0 0-5.5 5.5c0 .35.03.68.08 1A4 4 0 0 0 3 18.5 3.5 3.5 0 0 0 6.5 22h11" />
              </svg>
              <div className={`tier-status ${getTierStatus(stats?.tiers?.cloud_storage?.status)}`}>
                <span className="status-indicator-dot"></span>
                {stats?.tiers?.cloud_storage?.status === 'online' ? 'Online' : 'Offline'}
              </div>
            </div>
            <div className="tier-name">Cloud Storage</div>
            <div className="tier-desc">Raw Data Lake (JSON Payloads)</div>
            <div className="tier-stats">
              Bucket prefix: <strong>{stats?.tiers?.cloud_storage?.prefix || 'N/A'}</strong>
            </div>
          </div>
        </div>
      </div>

      {/* ===== CURRENT STATE FROM MONGODB ===== */}
      <div className="current-state">
        <div className="section-header">
          <svg className="section-title-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2L2 7l10 5 10-5-10-5z" />
            <path d="M2 17l10 5 10-5" />
            <path d="M2 12l10 5 10-5" />
          </svg>
          <h3>Current State (MongoDB Atlas)</h3>
        </div>
        <div className="state-grid">
          {currentState.stations?.map((station, idx) => (
            <div key={idx} className="state-card">
              <div className="state-card-header">
                <svg className="station-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
                <span className="state-station">{station.station_id}</span>
              </div>
              <div className="state-values">
                <div className="state-value-item">
                  <span className="val-label">pH</span>
                  <span className="val-num">{station.readings?.pH !== undefined && station.readings?.pH !== null ? station.readings.pH.toFixed(2) : '--'}</span>
                </div>
                <div className="state-value-item">
                  <span className="val-label">DO</span>
                  <span className="val-num">{station.readings?.dissolved_oxygen !== undefined && station.readings?.dissolved_oxygen !== null ? station.readings.dissolved_oxygen.toFixed(1) : '--'}</span>
                </div>
                <div className="state-value-item">
                  <span className="val-label">Temp</span>
                  <span className="val-num">{station.readings?.temperature !== undefined && station.readings?.temperature !== null ? `${station.readings.temperature.toFixed(1)}°C` : '--'}</span>
                </div>
              </div>
              <div className="state-meta">
                <span className={`quality-badge ${station.quality_flag || 'UNKNOWN'}`}>
                  {station.quality_flag || 'UNKNOWN'}
                </span>
                <span className="time-text">
                  {station.last_updated ? new Date(station.last_updated).toLocaleTimeString() : '--'}
                </span>
              </div>
            </div>
          ))}
          {(!currentState.stations || currentState.stations.length === 0) && (
            <div className="empty-state">
              <svg className="empty-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="8" y1="12" x2="16" y2="12" />
              </svg>
              <p>No stations in MongoDB yet</p>
              <span>Send some data to get started</span>
            </div>
          )}
        </div>
      </div>

      {/* ===== RECENT DATA FROM BIGQUERY ===== */}
      <div className="recent-data">
        <div className="recent-header">
          <div className="recent-header-left">
            <svg className="section-title-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            <h3>Recent Data (BigQuery)</h3>
          </div>
          
          <button onClick={() => fetchRecentData(currentPage)} className="btn-refresh-outline" disabled={loading}>
            <svg className={`btn-icon ${loading ? 'spinning' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 4v6h-6" />
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
            Refresh
          </button>
        </div>

        {/* ===== FILTERS TOOLBAR ===== */}
        <div className="filters-toolbar">
          <div className="filter-group">
            <label htmlFor="station-filter">Station:</label>
            <select
              id="station-filter"
              value={stationFilter}
              onChange={(e) => handleStationFilterChange(e.target.value)}
              className="filter-select"
            >
              <option value="">All Stations</option>
              {availableStations.map(station => (
                <option key={station} value={station}>{station}</option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label htmlFor="quality-filter">Quality:</label>
            <select
              id="quality-filter"
              value={qualityFilter}
              onChange={(e) => handleQualityFilterChange(e.target.value)}
              className="filter-select"
            >
              <option value="">All Qualities</option>
              <option value="VALID">VALID</option>
              <option value="SUSPECT">SUSPECT</option>
              <option value="INVALID">INVALID</option>
            </select>
          </div>

          <div className="filter-group">
            <label htmlFor="page-size-select">Rows per page:</label>
            <select
              id="page-size-select"
              value={pageSize}
              onChange={(e) => handlePageSizeChange(parseInt(e.target.value))}
              className="filter-select"
            >
              <option value={5}>5 rows</option>
              <option value={10}>10 rows</option>
              <option value={20}>20 rows</option>
              <option value={50}>50 rows</option>
            </select>
          </div>

          {(stationFilter || qualityFilter) && (
            <button 
              onClick={() => {
                setStationFilter('');
                setQualityFilter('');
                setCurrentPage(1);
              }}
              className="btn-clear-filters"
              title="Clear all filters"
            >
              <svg className="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
              Clear Filters
            </button>
          )}
        </div>
        
        {loading ? (
          <div className="loading-state">
            <div className="loading-spinner"></div>
            <p>Fetching records from BigQuery...</p>
          </div>
        ) : dataError ? (
          <div className="empty-state error">
            <svg className="empty-icon-svg error-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <h3>Error Loading Data</h3>
            <p>{dataError}</p>
          </div>
        ) : recentData.length === 0 ? (
          <div className="empty-state">
            <svg className="empty-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
            </svg>
            <p>No records found matching current criteria</p>
            <span>Send IoT data, manual entries, or batch uploads to populate the database</span>
          </div>
        ) : (
          <>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Station</th>
                  <th>pH</th>
                  <th>DO (mg/L)</th>
                  <th>Temp (°C)</th>
                  <th>Quality</th>
                  <th>Source</th>
                </tr>
              </thead>
              <tbody>
                {recentData.map((row, idx) => (
                  <tr key={idx}>
                    <td>{new Date(row.timestamp).toLocaleString()}</td>
                    <td>{row.station_id}</td>
                    <td>{row.pH !== null && row.pH !== undefined ? row.pH.toFixed(2) : '--'}</td>
                    <td>{row.dissolved_oxygen_mg_l !== null && row.dissolved_oxygen_mg_l !== undefined ? row.dissolved_oxygen_mg_l.toFixed(1) : '--'}</td>
                    <td>{row.temperature_c !== null && row.temperature_c !== undefined ? row.temperature_c.toFixed(1) : '--'}</td>
                    <td>
                      <span className={`quality-badge ${row.quality_flag || 'UNKNOWN'}`}>
                        {row.quality_flag || 'UNKNOWN'}
                      </span>
                    </td>
                    <td className="source-cell">
                      <span className={`source-tag ${row.source}`}>
                        {row.source}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            
            {/* ===== PAGINATION ===== */}
            {renderPagination()}
          </>
        )}
      </div>
    </div>
  );
};

export default Dashboard;