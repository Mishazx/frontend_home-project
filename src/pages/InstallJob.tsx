import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

export default function InstallJob() {
  const params = useParams();
  const jobId = params.jobId || '';
  const [job, setJob] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!jobId) return;
    let mounted = true;
    async function poll() {
      setLoading(true);
      try {
        const res = await fetch(`/api/registry/plugins/install/${encodeURIComponent(jobId)}`);
        if (!res.ok) throw new Error(await res.text());
        const j = await res.json();
        if (mounted) setJob(j);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    poll();
    const t = setInterval(poll, 3000);
    return () => { mounted = false; clearInterval(t); };
  }, [jobId]);

  if (!jobId) return <div style={{ padding: 16 }}>Job id required in path</div>;

  return (
    <div style={{ padding: 16, textAlign: 'left' }}>
      <h2>Install Job: {jobId}</h2>
      {loading && <div>Loading...</div>}
      {!job && !loading && <div>Not found or loading...</div>}
      {job && (
        <div>
          <div><b>Plugin:</b> {job.plugin_name}@{job.version}</div>
          <div><b>Target agent:</b> {job.target_agent}</div>
          <div><b>Status:</b> {job.status}</div>
          <div><b>Created:</b> {job.created_at}</div>
          <div><b>Started:</b> {job.started_at}</div>
          <div><b>Finished:</b> {job.finished_at}</div>
          <div style={{ marginTop: 12 }}>
            <h4>Logs</h4>
            <pre style={{ whiteSpace: 'pre-wrap', background: '#f6f8fa', padding: 12, borderRadius: 6 }}>{job.logs || '—'}</pre>
          </div>
        </div>
      )}
    </div>
  );
}
