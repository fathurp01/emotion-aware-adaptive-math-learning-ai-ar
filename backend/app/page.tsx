export default function ApiStatusPage() {
  return (
    <div style={{
      fontFamily: 'system-ui, sans-serif',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      backgroundColor: '#f3f4f6',
      color: '#1f2937'
    }}>
      <div style={{
        padding: '2rem',
        borderRadius: '8px',
        backgroundColor: '#ffffff',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
      }}>
        <h1 style={{ color: '#10b981', margin: '0 0 1rem 0' }}>✓ Backend API Server</h1>
        <p style={{ margin: 0 }}>The EmotionLearn backend API server is running successfully.</p>
        <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.875rem', color: '#6b7280' }}>
          Endpoints: <code>/api/health</code>, <code>/api/quiz/generate</code>, etc.
        </p>
      </div>
    </div>
  );
}
