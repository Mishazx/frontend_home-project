import React, { useEffect, useState } from 'react';

export default function Registry() {
  const [plugins, setPlugins] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(false);
  const [agentId, setAgentId] = useState<string>("");
  const [lastJob, setLastJob] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch('/api/plugins');
      const j = await res.json();
      setPlugins(j || {});
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function install(name: string, version: string) {
    const aid = agentId || prompt('Enter agent id to install to (client id)') || '';
    if (!aid) return alert('agent id required');
    try {
      const body = { agent_id: aid, options: {} };
      const res = await fetch(`/api/registry/plugins/${encodeURIComponent(name)}/${encodeURIComponent(version)}/install`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
      });
      const j = await res.json();
      if (res.ok) {
        setLastJob(j.job_id || null);
        alert('Install job created: ' + (j.job_id || JSON.stringify(j)));
      } else {
        alert('Install failed: ' + JSON.stringify(j));
      }
    } catch (e: any) {
      alert('Request failed: ' + String(e.message || e));
    }
  }

  return (
    <div style={{ padding: 16 }}>
      <h2>Plugin Registry</h2>
      <div style={{ marginBottom: 8 }}>
        <label>Agent id (optional):&nbsp;</label>
        <input value={agentId} onChange={e => setAgentId(e.target.value)} placeholder="client id" />
        <button onClick={() => setAgentId('')}>Clear</button>
      </div>
      {loading && <div>Loading...</div>}
      <div>
        {Object.keys(plugins).length === 0 && !loading && <div>No plugins found</div>}
        {Object.entries(plugins).map(([k, p]) => (
          <div key={k} style={{ border: '1px solid #eee', padding: 12, marginBottom: 8 }}>
            <h3>{p.name}</h3>
            <div>{p.description}</div>
            <div style={{ marginTop: 8 }}>
              Versions:
              <ul>
                {(p.versions || []).map((v: any) => (
                  <li key={v.version}>
                    {v.version} — <button onClick={() => install(p.name, v.version)}>Install</button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 16 }}>
        <h4>Last created job</h4>
        {lastJob ? <div><a href={`/install-jobs/${lastJob}`}>{lastJob}</a></div> : <div>—</div>}
      </div>
    </div>
  );
}
