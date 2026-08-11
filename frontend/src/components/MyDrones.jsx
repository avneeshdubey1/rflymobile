import React, { useState, useEffect, useMemo } from 'react';
import { Archive, Plus, Pencil, Search } from 'lucide-react';
import axios from "axios";
import { SkeletonRow } from '../components/Skeleton';
import { API_URL } from '../config';
import { csrfHeaders } from '../utils/csrf';

const CERTIFIED_OPTIONS = ['Yes', 'No'];
const PAGE_SIZE = 15;

const emptyForm = {
  name: '',
  type: '',
  model: '',
  manufacturer: '',
  serialNumber: '',
  uin: '',
  homeCenterId: '',
  tankCapacity: '',
  batteryCapacity: '',
  endurance: '',
  certified: '',
  service: '',
};

function Field({ label, name, value, onChange, placeholder, required = true, type = 'text', min, maxLength, step }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-gray-500">{label}</span>
      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        min={min}
        maxLength={maxLength}
        step={step}
        onKeyDown={type === 'number' ? (e) => { if (e.key === '-' || e.key === 'e') e.preventDefault(); } : undefined}
        onWheel={type === 'number' ? (e) => e.target.blur() : undefined}
        className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
      />
    </label>
  );
}

function Select({ label, name, value, onChange, options, required = true, placeholder = 'Select…' }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-gray-500">{label}</span>
      <select
        name={name}
        value={value}
        onChange={onChange}
        required={required}
        className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
      >
        <option value="" disabled>{placeholder}</option>
        {options.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
      </select>
    </label>
  );
}

export default function MyDrones() {
  const [drones, setDrones] = useState([]);
  const [centers, setCenters] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [loadingDrones, setLoadingDrones] = useState(true);

  const handleChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  const closeModal = () => { setShowAdd(false); setEditingId(null); setForm(emptyForm); };

  useEffect(() => {
    const fetchDrones = async () => {
      try {
        const response = await axios.get(`${API_URL}/api/drones/all`, { withCredentials: true });
        setDrones(response.data.drones || []);
      } catch (error) {
        console.error(error);
      } finally {
        setLoadingDrones(false);
      }
    };
    fetchDrones();
  }, []);

  useEffect(() => {
    const fetchCenters = async () => {
      try {
        const response = await axios.get(`${API_URL}/api/centers/all`, { withCredentials: true });
        setCenters(response.data.centers || []);
      } catch (error) { console.error(error); }
    };
    fetchCenters();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    const cleaned = {
      ...form,
      name: String(form.name || '').trim(),
      type: String(form.type || '').trim(),
      model: String(form.model || '').trim(),
      manufacturer: String(form.manufacturer || '').trim(),
      serialNumber: String(form.serialNumber || '').trim(),
      uin: String(form.uin || '').trim(),
      tankCapacity: form.tankCapacity ? String(Number(form.tankCapacity)) : '',
      batteryCapacity: form.batteryCapacity ? String(Number(form.batteryCapacity)) : '',
      endurance: form.endurance ? String(Number(form.endurance)) : '',
      service: String(form.service || '').trim(),
    };
    if (!cleaned.name || !cleaned.type || !cleaned.model || !cleaned.manufacturer || !cleaned.serialNumber) {
      alert('Name, type, model, manufacturer, and serial number are required.');
      setSubmitting(false);
      return;
    }
    if (!Number.isFinite(Number(cleaned.tankCapacity)) || Number(cleaned.tankCapacity) <= 0) {
      alert('Tank capacity must be a positive number.');
      setSubmitting(false);
      return;
    }
    try {
      if (editingId) {
        const response = await axios.patch(
          `${API_URL}/api/drones/${editingId}`,
          cleaned,
          { withCredentials: true, headers: csrfHeaders() }
        );
        setDrones((prev) => prev.map((dr) => (dr.id === editingId ? response.data.drone : dr)));
      } else {
        const response = await axios.post(
          `${API_URL}/api/drones/add`,
          cleaned,
          { withCredentials: true, headers: csrfHeaders() }
        );
        setDrones((prev) => [response.data.drone, ...prev]);
      }
      closeModal();
    } catch (error) {
      console.error(error);
      alert(error.response?.data?.error || error.response?.data?.message || "Failed to save drone.");
    } finally {
      setSubmitting(false);
    }
  };

  const startEdit = (drone) => {
    setForm({
      ...emptyForm,
      ...drone,
      name: drone.name || '',
      type: drone.type || drone.category || '',
      model: drone.model || '',
      manufacturer: drone.manufacturer || '',
      serialNumber: drone.serialNumber || '',
      uin: drone.uin || '',
      homeCenterId: drone.homeCenterId || '',
      tankCapacity: drone.tankCapacity ?? drone.tankCapacityLitres ?? '',
      batteryCapacity: drone.batteryCapacity ?? drone.batteryCapacityMah ?? '',
      endurance: drone.endurance ?? drone.enduranceMinutes ?? '',
      certified: drone.certified ? 'Yes' : 'No',
      service: drone.serviceType || '',
    });
    setEditingId(drone.id);
    setShowAdd(true);
  };

  const retireDrone = async (id) => {
    if (!window.confirm('Retire this drone? It will remain in fleet history and cannot be scheduled.')) return;
    try {
      const response = await axios.delete(
        `${API_URL}/api/drones/${id}`,
        { withCredentials: true, headers: csrfHeaders() }
      );
      setDrones((prev) => prev.map((drone) => {
        if (drone.id !== id) return drone;
        return {
          ...drone,
          ...(response.data?.drone || {}),
          status: response.data?.drone?.status || 'OUT_OF_SERVICE',
          archivedAt: response.data?.drone?.archivedAt || new Date().toISOString(),
        };
      }));
    } catch (error) {
      console.error(error);
      alert(error.response?.data?.error || 'Failed to retire drone');
    }
  };


  // filtered + paginated list
  const filteredDrones = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return drones;
    return drones.filter((d) =>
      [d.name, d.serialNumber, d.uin, d.model, d.manufacturer, d.homeCenter?.name]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(term))
    );
  }, [drones, search]);

  const totalPages = Math.max(1, Math.ceil(filteredDrones.length / PAGE_SIZE));
  const paginatedDrones = filteredDrones.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  useEffect(() => { setCurrentPage(1); }, [search]);

  return (
    <div className="min-h-screen bg-gray-100 p-4 sm:p-5">
      {/* Header */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <iframe
            src="/drone-3d.html"
            title="3D Drone"
            style={{ width: '95px', height: '95px', border: 'none', background: 'transparent' }}
          />
          <h1 className="text-2xl font-semibold text-gray-800">
            My Drones<span className="text-gray-500"> ({drones.length})</span>
          </h1>
        </div>
        <div className="flex gap-3">

          <div style={{ position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', pointerEvents: 'none' }} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, serial, UIN, model, center…"
              style={{ borderRadius: '8px', border: '1px solid #d1d5db', background: '#fff', padding: '8px 12px 8px 40px', fontSize: '14px', outline: 'none', width: '100%' }}
            />
          </div>
          <button
            onClick={() => { setForm(emptyForm); setEditingId(null); setShowAdd(true); }}
            className="submit-btn"
            style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', padding: '0.5rem 1rem', fontSize: '0.875rem', fontWeight: 500, borderRadius: '0.5rem' }}
          >
            <Plus size={16} strokeWidth={2.5} />
            Add New
          </button>
        </div>
      </div>

      {/* Table */}
      {loadingDrones ? (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-base font-bold text-gray-700">Name</th>
                <th className="px-4 py-3 text-left text-base font-bold text-gray-700">Type</th>
                <th className="px-4 py-3 text-left text-base font-bold text-gray-700">Model</th>
                <th className="px-4 py-3 text-left text-base font-bold text-gray-700">Manufacturer</th>
                <th className="px-4 py-3 text-left text-base font-bold text-gray-700">Serial / UIN</th>
                <th className="px-4 py-3 text-left text-base font-bold text-gray-700">Location</th>
                <th className="px-4 py-3 text-left text-base font-bold text-gray-700">Tank Capacity</th>
                <th className="px-4 py-3 text-left text-base font-bold text-gray-700">Battery Capacity</th>
                <th className="px-4 py-3 text-left text-base font-bold text-gray-700">Endurance</th>
                <th className="px-4 py-3 text-left text-base font-bold text-gray-700">Certified</th>
                <th className="px-4 py-3 text-left text-base font-bold text-gray-700">Services</th>
                <th className="px-4 py-3 text-right text-base font-bold text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              <SkeletonRow rows={8} columns={12} />
            </tbody>
          </table>
        </div>
      ) : drones.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-12 text-center">
          <p className="text-gray-500">No drones registered yet.</p>
          <button
            onClick={() => { setForm(emptyForm); setEditingId(null); setShowAdd(true); }}
            className="mt-3 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Add your first drone
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-base font-bold text-gray-700">Name</th>
                <th className="px-4 py-3 text-left text-base font-bold text-gray-700">Type</th>
                <th className="px-4 py-3 text-left text-base font-bold text-gray-700">Model</th>
                <th className="px-4 py-3 text-left text-base font-bold text-gray-700">Manufacturer</th>
                <th className="px-4 py-3 text-left text-base font-bold text-gray-700">Serial / UIN</th>
                <th className="px-4 py-3 text-left text-base font-bold text-gray-700">Location</th>
                <th className="px-4 py-3 text-left text-base font-bold text-gray-700">Tank Capacity</th>
                <th className="px-4 py-3 text-left text-base font-bold text-gray-700">Battery Capacity</th>
                <th className="px-4 py-3 text-left text-base font-bold text-gray-700">Endurance</th>
                <th className="px-4 py-3 text-left text-base font-bold text-gray-700">Certified</th>
                <th className="px-4 py-3 text-left text-base font-bold text-gray-700">Services</th>
                <th className="px-4 py-3 text-right text-base font-bold text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {paginatedDrones.map((drone) => (
                <tr key={drone.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-blue-600">
                    <div>{drone.name || '—'}</div>
                    {drone.archivedAt && <span className="mt-1 inline-block rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">Retired</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-700">{drone.type || '—'}</td>
                  <td className="px-4 py-3 text-gray-700">{drone.model || '—'}</td>
                  <td className="px-4 py-3 text-gray-700">{drone.manufacturer || '—'}</td>
                  <td className="px-4 py-3 text-gray-700">
                    <div>{drone.serialNumber}</div>
                    <div className="text-xs text-gray-500">{drone.uin || 'No UIN recorded'}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-700">{drone.homeCenter?.name || '—'}</td>
                  <td className="px-4 py-3 text-gray-700">{drone.tankCapacity ? `${drone.tankCapacity} ltr` : '—'}</td>
                  <td className="px-4 py-3 text-gray-700">{drone.batteryCapacity ? `${drone.batteryCapacity} mAh` : '—'}</td>
                  <td className="px-4 py-3 text-gray-700">{drone.endurance ? `${drone.endurance} min` : '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${drone.certified ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                      {drone.certified ? 'Certified' : 'Not certified'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-700">{drone.serviceType || '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => startEdit(drone)} disabled={Boolean(drone.archivedAt)} className="rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-40" title={drone.archivedAt ? 'Retired drones cannot be edited' : 'Edit'}>
                        <Pencil size={16} />
                      </button>
                      {!drone.archivedAt && (
                        <button onClick={() => retireDrone(drone.id)} className="rounded p-1.5 text-gray-500 hover:bg-amber-50 hover:text-amber-700" title="Retire">
                          <Archive size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination */}
          <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3 text-sm text-gray-600">
            <span>
              Showing {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filteredDrones.length)} of {filteredDrones.length}
            </span>
            <div className="flex items-center gap-2">
              <button disabled={currentPage === 1} onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} className="rounded border border-gray-300 px-2 py-1 disabled:opacity-40">Prev</button>
              <span>Page {currentPage} of {totalPages}</span>
              <button disabled={currentPage === totalPages} onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} className="rounded border border-gray-300 px-2 py-1 disabled:opacity-40">Next</button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Drone modal */}
      {showAdd && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-800">{editingId ? 'Edit Drone' : 'Add New Drone'}</h2>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Name" name="name" value={form.name} onChange={handleChange} placeholder="e.g. Falcon 1" maxLength={120} />
                <Field label="Type" name="type" value={form.type} onChange={handleChange} placeholder="e.g. Hexacopter" maxLength={60} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Model Name" name="model" value={form.model} onChange={handleChange} placeholder="e.g. XL10" maxLength={120} />
                <Field label="Manufacturer" name="manufacturer" value={form.manufacturer} onChange={handleChange} placeholder="Manufacturer name" maxLength={120} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Serial Number" name="serialNumber" value={form.serialNumber} onChange={handleChange} placeholder="RFLY-DRONE-001" />
                <Field label="Drone UIN" name="uin" value={form.uin} onChange={handleChange} placeholder="UA00T1DS0TC" required={false} />
              </div>

              <div>
                <label className="block">
                  <span className="text-xs font-medium text-gray-500">Location</span>
                  <select
                    name="homeCenterId"
                    value={form.homeCenterId}
                    onChange={handleChange}
                    required
                    className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  >
                    <option value="" disabled>Select center…</option>
                    {centers.filter((center) => center.active).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Tank Capacity (ltr)" name="tankCapacity" value={form.tankCapacity} onChange={handleChange} placeholder="e.g. 10" type="number" min="0.1" step="any" />
                <Field label="Battery Capacity (mAh)" name="batteryCapacity" value={form.batteryCapacity} onChange={handleChange} placeholder="e.g. 22000" type="number" min="1" step="1" required={false} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Endurance (Minutes)" name="endurance" value={form.endurance} onChange={handleChange} placeholder="e.g. 25" type="number" min="1" step="1" required={false} />
                <Select label="Certified" name="certified" value={form.certified} onChange={handleChange} options={CERTIFIED_OPTIONS} required={false} />
              </div>

              <Field label="Services" name="service" value={form.service} onChange={handleChange} placeholder="Spraying service" required={false} />

              <div className="mt-5 flex justify-end gap-2">
                <button type="button" onClick={closeModal} className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100">Cancel</button>
                <button type="submit" className="submit-btn" disabled={submitting}>
                  {submitting ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{
                        width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.4)',
                        borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block',
                        animation: 'spin 0.6s linear infinite'
                      }} />
                      {editingId ? 'Saving…' : 'Saving…'}
                    </span>
                  ) : (
                    editingId ? 'Save Changes' : 'Save Drone'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
