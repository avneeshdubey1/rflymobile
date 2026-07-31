import React, { useState } from 'react';
import { Plus, MoreVertical, X, Settings2, Pencil, Trash2 } from 'lucide-react';

// Simple quadcopter glyph, drawn to resemble the icon in the reference design
function DroneIcon({ size = 36 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <line x1="10" y1="10" x2="20" y2="20" stroke="#1f2937" strokeWidth="2" strokeLinecap="round" />
      <line x1="38" y1="10" x2="28" y2="20" stroke="#1f2937" strokeWidth="2" strokeLinecap="round" />
      <line x1="10" y1="38" x2="20" y2="28" stroke="#1f2937" strokeWidth="2" strokeLinecap="round" />
      <line x1="38" y1="38" x2="28" y2="28" stroke="#1f2937" strokeWidth="2" strokeLinecap="round" />
      <circle cx="9" cy="9" r="4" fill="none" stroke="#1f2937" strokeWidth="2" />
      <circle cx="39" cy="9" r="4" fill="none" stroke="#1f2937" strokeWidth="2" />
      <circle cx="9" cy="39" r="4" fill="none" stroke="#1f2937" strokeWidth="2" />
      <circle cx="39" cy="39" r="4" fill="none" stroke="#1f2937" strokeWidth="2" />
      <rect x="18" y="17" width="12" height="14" rx="3" fill="#1f2937" />
    </svg>
  );
}

// ---- Option lists (edit these to change what shows up in the dropdowns) ----
const MODEL_OPTIONS = ['XL10'];
const MANUFACTURER_OPTIONS = [
  'Idea Forge Technology Limited',
  'CBAI Technologies Private Limited',
  'Asteria Aerospace Limited',
  'General Aeronautics Private Limited',
  'RFLY Innovations Private Limited'
];
const TYPE_OPTIONS = ['eVTOLs', 'Hexacopter', 'Quadcopters'];
const TANK_CAPACITY_OPTIONS = ['5', '6', '8', '10', '16', '20'];
const CERTIFIED_OPTIONS = ['Yes', 'No'];
const LOCATION_OPTIONS = ['Vijayawada, Andhra Pradesh, India', 'Kankipadu', 'Baddipadaga'];

const emptyForm = {
  name: '',
  type: '',
  model: '',
  manufacturer: '',
  uin: '',
  location: '',
  tankCapacity: '',
  batteryCapacity: '',
  endurance: '',
  certified: '',
  service: '',
};

function Field({ label, name, value, onChange, placeholder, required = true, type = 'text', min }) {
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
        // for number inputs, block the minus key / scroll-wheel decrement below 0
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
        <option value="" disabled>
          {placeholder}
        </option>
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </label>
  );
}

export default function MyDrones() {
  // const [drones, setDrones] = useState([]);
  const [drones, setDrones] = useState(() => {
  const saved = localStorage.getItem("drones");
  return saved ? JSON.parse(saved) : [];
});
  const [showAdd, setShowAdd] = useState(false);
  const [showManage, setShowManage] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [editingId, setEditingId] = useState(null); // null = adding a new drone, otherwise editing this id

  const handleChange = (e) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  };

  const closeModal = () => {
    setShowAdd(false);
    setEditingId(null);
    setForm(emptyForm);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const cleaned = {
      ...form,
      batteryCapacity: form.batteryCapacity ? String(Math.max(0, Number(form.batteryCapacity))) : '',
      endurance: form.endurance ? String(Math.max(0, Number(form.endurance))) : '',
    };

    if (editingId) {
      // update the existing drone in place
      setDrones((d) => d.map((dr) => (dr.id === editingId ? { id: editingId, ...cleaned } : dr)));
    } else {
      // create a new drone
      // setDrones((d) => [{ id: Date.now(), ...cleaned }, ...d]);
      const newDrone = {
  id: Date.now(),
  ...cleaned,
};

setDrones((d) => {
  const updated = [newDrone, ...d];
  localStorage.setItem("drones", JSON.stringify(updated));
  return updated;
});
    }
    closeModal();
  };

  const startEdit = (drone) => {
    setForm({ ...emptyForm, ...drone });
    setEditingId(drone.id);
    setShowAdd(true);
    setOpenMenuId(null);
  };

  // const removeDrone = (id) => {
  //   setDrones((d) => d.filter((dr) => dr.id !== id));
  //   setOpenMenuId(null);
  // };

  const removeDrone = (id) => {
  setDrones((d) => {
    const updated = d.filter((dr) => dr.id !== id);
    localStorage.setItem("drones", JSON.stringify(updated));
    return updated;
  });

  setOpenMenuId(null);
};
  // distinct model names currently in the fleet, for the "Manage Models" view
  const models = Array.from(new Set(drones.map((d) => d.model).filter(Boolean)));

  return (
    <div className="min-h-screen bg-gray-100 p-6 sm:p-8">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-gray-800">
          My Drones<span className="text-gray-500">({drones.length})</span>
        </h1>
        <div className="flex gap-3">
          <button
            onClick={() => setShowManage(true)}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
          >
            Manage Models
          </button>
          <button
            onClick={() => {
              setForm(emptyForm);
              setEditingId(null);
              setShowAdd(true);
            }}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
          >
            <Plus size={16} strokeWidth={2.5} />
            Add New
          </button>
        </div>
      </div>

      {/* Grid */}
      {drones.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-12 text-center">
          <p className="text-gray-500">No drones registered yet.</p>
          <button
            onClick={() => {
              setForm(emptyForm);
              setEditingId(null);
              setShowAdd(true);
            }}
            className="mt-3 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Add your first drone
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {drones.map((drone) => (
            <div
              key={drone.id}
              className="relative rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
            >
              <button
                onClick={() => setOpenMenuId(openMenuId === drone.id ? null : drone.id)}
                className="absolute right-3 top-3 rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <MoreVertical size={18} />
              </button>
              {openMenuId === drone.id && (
                <div className="absolute right-3 top-9 z-10 w-36 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                  <button
                    onClick={() => startEdit(drone)}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-gray-700 hover:bg-gray-50"
                  >
                    <Pencil size={14} />
                    Edit
                  </button>
                  <button
                    onClick={() => removeDrone(drone.id)}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-red-600 hover:bg-red-50"
                  >
                    <Trash2 size={14} />
                    Remove
                  </button>
                </div>
              )}

              <div className="mb-4 flex items-start gap-3">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-gray-200">
                  <DroneIcon />
                </div>
                <div>
                  <div className="font-semibold text-blue-600">{drone.name || drone.type || 'Unnamed drone'}</div>
                  <div className="text-sm text-gray-500">{drone.location || '—'}</div>
                  {drone.type && <div className="text-xs text-gray-400">{drone.type}</div>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-y-3 text-sm">
                <div>
                  <div className="text-gray-800">{drone.manufacturer || '—'}</div>
                  <div className="text-xs text-gray-400">(Manufacturer)</div>
                </div>
                <div>
                  <div className="text-gray-800">{drone.uin || '—'}</div>
                  <div className="text-xs text-gray-400">(UIN)</div>
                </div>
                <div>
                  <div className="text-gray-800">{drone.model || '—'}</div>
                  <div className="text-xs text-gray-400">(Model)</div>
                </div>
                <div>
                  <div className="text-gray-800">{drone.tankCapacity ? `${drone.tankCapacity} ltr` : '—'}</div>
                  <div className="text-xs text-gray-400">(Tank Capacity)</div>
                </div>
                <div>
                  <div className="text-gray-800">{drone.batteryCapacity ? `${drone.batteryCapacity} mAh` : '—'}</div>
                  <div className="text-xs text-gray-400">(Battery Capacity)</div>
                </div>
                <div>
                  <div className="text-gray-800">{drone.endurance ? `${drone.endurance} min` : '—'}</div>
                  <div className="text-xs text-gray-400">(Endurance)</div>
                </div>
                <div>
                  <div className="text-gray-800">{drone.service || '—'}</div>
                  <div className="text-xs text-gray-400">(Services)</div>
                </div>
              </div>

              {drone.certified && (
                <div className="mt-3">
                  <span
                    className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      drone.certified === 'Yes'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {drone.certified === 'Yes' ? 'Certified' : 'Not certified'}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add New Drone modal */}
      {showAdd && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-800">{editingId ? 'Edit Drone' : 'Add New Drone'}</h2>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3">
              <Field label="Name" name="name" value={form.name} onChange={handleChange} placeholder="e.g. Falcon 1" />
              <Select label="Type" name="type" value={form.type} onChange={handleChange} options={TYPE_OPTIONS} />
              <Select label="Model Name" name="model" value={form.model} onChange={handleChange} options={MODEL_OPTIONS} />
              <Select
                label="Manufacturer"
                name="manufacturer"
                value={form.manufacturer}
                onChange={handleChange}
                options={MANUFACTURER_OPTIONS}
              />
              <Field label="Drone UIN" name="uin" value={form.uin} onChange={handleChange} placeholder="UA00T1DS0TC" />
              <Select label="Location" name="location" value={form.location} onChange={handleChange} options={LOCATION_OPTIONS} />
              <Select
                label="Tank Capacity"
                name="tankCapacity"
                value={form.tankCapacity}
                onChange={handleChange}
                options={TANK_CAPACITY_OPTIONS}
                placeholder="Select capacity (ltr)…"
              />
              <Field
                label="Battery Capacity (mAh)"
                name="batteryCapacity"
                value={form.batteryCapacity}
                onChange={handleChange}
                placeholder="e.g. 22000"
                type="number"
                min="0"
                required={false}
              />
              <Field
                label="Endurance (Minutes)"
                name="endurance"
                value={form.endurance}
                onChange={handleChange}
                placeholder="e.g. 25"
                type="number"
                min="0"
                required={false}
              />
              <Select label="Certified" name="certified" value={form.certified} onChange={handleChange} options={CERTIFIED_OPTIONS} required={false} />
              <Field
                label="Services"
                name="service"
                value={form.service}
                onChange={handleChange}
                placeholder="Spraying service"
                required={false}
              />

              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                >
                  {editingId ? 'Save Changes' : 'Save Drone'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Manage Models modal */}
      {showManage && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-800">
                <Settings2 size={18} /> Manage Models
              </h2>
              <button onClick={() => setShowManage(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            {models.length === 0 ? (
              <p className="text-sm text-gray-500">No models registered yet.</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {models.map((m) => {
                  const count = drones.filter((d) => d.model === m).length;
                  return (
                    <li key={m} className="flex items-center justify-between py-2 text-sm">
                      <span className="font-medium text-gray-800">{m}</span>
                      <span className="text-gray-500">{count} drone{count !== 1 ? 's' : ''}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}