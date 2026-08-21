import { useCallback, useEffect, useState } from 'react';
import { API_URL as API } from '../config';
import { csrfHeaders } from '../utils/csrf';

const categories = ['SPRAY_PURPOSE', 'B2B_SUBCATEGORY', 'LEAD_SOURCE', 'REPORTING_ADMIN'];
const blankValue = { category: 'SPRAY_PURPOSE', code: '', displayName: '', sortOrder: 0 };
const blankCluster = { code: '', displayName: '', type: 'HUB', sortOrder: 0 };
const blankCrop = { code: '', displayName: '' };

export default function MasterDataManagement() {
  const [data, setData] = useState({ clusters: [], values: [] });
  const [value, setValue] = useState(blankValue);
  const [cluster, setCluster] = useState(blankCluster);
  const [crop, setCrop] = useState(blankCrop);
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    const response = await fetch(`${API}/api/master-data/admin`, { credentials: 'include' });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || 'Failed to load master data');
    setData(body.data);
  }, []);
  useEffect(() => { load().catch(error => setNotice(error.message)); }, [load]);

  async function send(path, method, body) {
    const response = await fetch(`${API}${path}`, { method, credentials: 'include', headers: { 'Content-Type': 'application/json', ...csrfHeaders() }, body: JSON.stringify(body) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Master data update failed');
    await load();
  }
  async function createValue(event) {
    event.preventDefault();
    try { await send('/api/master-data/values', 'POST', value); setValue(blankValue); setNotice('Master value created.'); } catch (error) { setNotice(error.message); }
  }
  async function createCluster(event) {
    event.preventDefault();
    try { await send('/api/master-data/clusters', 'POST', cluster); setCluster(blankCluster); setNotice('Cluster created.'); } catch (error) { setNotice(error.message); }
  }
  async function createCrop(event) {
    event.preventDefault();
    try { await send('/api/master-data/crops', 'POST', crop); setCrop(blankCrop); setNotice('Crop created.'); } catch (error) { setNotice(error.message); }
  }

  return <div className="section-gap">
    {notice && <div className="panel panel-body">{notice}</div>}
    <section className="user-admin-grid">
      <div className="panel panel--raised"><div className="panel-header"><div className="panel-header__title"><h2>Clusters</h2><p>Cluster Type is defined once here and derived in customer/lead forms.</p></div></div>
        <form className="panel-body form-stack" onSubmit={createCluster}>
          <div className="input-group"><label>Code</label><input value={cluster.code} onChange={e => setCluster({ ...cluster, code: e.target.value })} required /></div>
          <div className="input-group"><label>Name</label><input value={cluster.displayName} onChange={e => setCluster({ ...cluster, displayName: e.target.value })} required /></div>
          <div className="input-group"><label>Type</label><select value={cluster.type} onChange={e => setCluster({ ...cluster, type: e.target.value })}><option>HUB</option><option>SPOKE</option><option>MINIHUB</option></select></div>
          <button className="submit-btn">Add Cluster</button>
        </form>
        <div className="data-stack">{data.clusters.map(item => <div className="data-row" key={item.id}><div className="data-row__main"><b>{item.displayName}</b><span className="data-row__meta">{item.code} · {item.type} · {item.active ? 'Active' : 'Inactive'}</span></div><button type="button" onClick={() => send(`/api/master-data/clusters/${item.id}`, 'PATCH', { active: !item.active }).catch(error => setNotice(error.message))}>{item.active ? 'Disable' : 'Enable'}</button></div>)}</div>
      </div>
      <div className="panel panel--raised"><div className="panel-header"><div className="panel-header__title"><h2>Operational dropdowns</h2><p>Spray Purpose, B2B list and Lead Source values.</p></div></div>
        <form className="panel-body form-stack" onSubmit={createValue}>
          <div className="input-group"><label>Category</label><select value={value.category} onChange={e => setValue({ ...value, category: e.target.value })}>{categories.map(item => <option key={item}>{item}</option>)}</select></div>
          <div className="input-group"><label>Code</label><input value={value.code} onChange={e => setValue({ ...value, code: e.target.value })} required /></div>
          <div className="input-group"><label>Name</label><input value={value.displayName} onChange={e => setValue({ ...value, displayName: e.target.value })} required /></div>
          <button className="submit-btn">Add Value</button>
        </form>
        <div className="data-stack">{data.values.map(item => <div className="data-row" key={item.id}><div className="data-row__main"><b>{item.displayName}</b><span className="data-row__meta">{item.category} · {item.code} · {item.active ? 'Active' : 'Inactive'}</span></div><button type="button" onClick={() => send(`/api/master-data/values/${item.id}`, 'PATCH', { active: !item.active }).catch(error => setNotice(error.message))}>{item.active ? 'Disable' : 'Enable'}</button></div>)}</div>
      </div>
    </section>
    <section className="panel panel--raised"><div className="panel-header"><div className="panel-header__title"><h2>Crop Types</h2><p>The single Crop Type dropdown uses these approved values.</p></div></div>
      <form className="panel-body form-stack" onSubmit={createCrop}><div className="row-group"><div className="input-group"><label>Code</label><input value={crop.code} onChange={e => setCrop({ ...crop, code: e.target.value })} required /></div><div className="input-group"><label>Name</label><input value={crop.displayName} onChange={e => setCrop({ ...crop, displayName: e.target.value })} required /></div></div><button className="submit-btn">Add Crop</button></form>
      <div className="data-stack">{(data.crops || []).map(item => <div className="data-row" key={item.id}><div className="data-row__main"><b>{item.displayName}</b><span className="data-row__meta">{item.code} · {item.active ? 'Active' : 'Inactive'}</span></div><button type="button" onClick={() => send(`/api/master-data/crops/${item.id}`, 'PATCH', { active: !item.active }).catch(error => setNotice(error.message))}>{item.active ? 'Disable' : 'Enable'}</button></div>)}</div>
    </section>
  </div>;
}
