import React, { useState, useEffect } from 'react';
import './App.css'; 

// Import components
import Dashboard from './components/Dashboard';
import IoTDataForm from './components/IoTDataForm';
import ManualEntryForm from './components/ManualEntryForm';
import BatchUploadForm from './components/BatchUploadForm';

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchStats = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('http://localhost:8000/api/stats');
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error('Error fetching stats:', error);
      setError(error.message);
      setStats({
        tiers: {
          mongodb: { status: 'offline', stations_count: 0 },
          bigquery: { status: 'offline', count: 0 },
          cloud_storage: { status: 'offline', prefix: 'N/A' }
        }
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard stats={stats} fetchStats={fetchStats} error={error} />;
      case 'iot':
        return <IoTDataForm fetchStats={fetchStats} />;
      case 'manual':
        return <ManualEntryForm fetchStats={fetchStats} />;
      case 'batch':
        return <BatchUploadForm fetchStats={fetchStats} />;
      default:
        return <Dashboard stats={stats} fetchStats={fetchStats} error={error} />;
    }
  };

  return (
    <div className="app">
      {/* Sidebar */}
      <nav className="sidebar">
        <div className="sidebar-logo">
          <svg className="logo-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
          </svg>
          <span className="logo-text">ETL<span>Pipeline</span></span>
        </div>
        
        <div className="sidebar-nav">
          <button 
            className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >
            <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="7" height="7" rx="1" />
            </svg>
            <span className="nav-label">Dashboard</span>
          </button>
          <button 
            className={`nav-item ${activeTab === 'iot' ? 'active' : ''}`}
            onClick={() => setActiveTab('iot')}
          >
            <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="2" />
              <path d="M16.24 7.76a6 6 0 0 1 0 8.49m-8.48-.01a6 6 0 0 1 0-8.49m11.31-2.82a10 10 0 0 1 0 14.14m-14.14 0a10 10 0 0 1 0-14.14" />
            </svg>
            <span className="nav-label">IoT Data</span>
          </button>
          <button 
            className={`nav-item ${activeTab === 'manual' ? 'active' : ''}`}
            onClick={() => setActiveTab('manual')}
          >
            <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
            <span className="nav-label">Manual Entry</span>
          </button>
          <button 
            className={`nav-item ${activeTab === 'batch' ? 'active' : ''}`}
            onClick={() => setActiveTab('batch')}
          >
            <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
              <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
            </svg>
            <span className="nav-label">Batch Upload</span>
          </button>
        </div>

        <div className="sidebar-footer">
          <div className={`status-badge-sidebar ${error ? 'offline' : 'online'}`}>
            <svg className="badge-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {error ? (
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              ) : (
                <circle cx="12" cy="12" r="10" />
              )}
            </svg>
            <span className="status-text">{error ? 'API Error' : 'System Online'}</span>
          </div>
          <div className="records-badge-sidebar">
            <svg className="badge-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="20" x2="18" y2="10" />
              <line x1="12" y1="20" x2="12" y2="4" />
              <line x1="6" y1="20" x2="6" y2="14" />
            </svg>
            <span className="status-text">Records: {stats?.tiers?.bigquery?.count || 0}</span>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="main-content">
        <header className="main-header">
          <div className="header-left">
            <h1>{activeTab === 'iot' ? 'IoT Data Simulator' : activeTab === 'manual' ? 'Manual Data Entry' : activeTab === 'batch' ? 'Batch Upload' : 'Dashboard'}</h1>
            <span className="header-subtitle">ETL Pipeline • Real-time Data Processing</span>
          </div>
          <div className="header-right">
            <button className="btn-refresh-outline" onClick={fetchStats} disabled={loading}>
              <svg className={`btn-icon ${loading ? 'spinning' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 4v6h-6" />
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
              </svg>
              {loading ? 'Loading...' : 'Refresh'}
            </button>
          </div>
        </header>
        <div className="main-body">
          {error && (
            <div className="error-banner">
              <div className="error-message-content">
                <svg className="error-banner-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
                <span>Cannot connect to backend. Please make sure the server is running on port 8000.</span>
              </div>
              <button onClick={fetchStats} className="btn-retry-outline">Retry</button>
            </div>
          )}
          {renderContent()}
        </div>
      </main>
    </div>
  );
}

export default App;