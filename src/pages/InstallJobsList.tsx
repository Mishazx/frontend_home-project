import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function InstallJobsList() {
  const [jobId, setJobId] = useState('');
  const navigate = useNavigate();

  return (
    <div style={{ padding: 16 }}>
      <h2>Install Jobs</h2>
      <p>Enter install job id to view status:</p>
      <div>
        <input value={jobId} onChange={e => setJobId(e.target.value)} placeholder="job id" />
        <button onClick={() => { if (jobId) navigate(`/install-jobs/${jobId}`); else alert('enter job id') }}>View</button>
      </div>
      <p style={{ marginTop: 12 }}>When you create an install job from Registry page you'll get a job id link here.</p>
    </div>
  );
}
