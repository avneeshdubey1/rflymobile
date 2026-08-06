import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Pencil, Trash2, Search } from 'lucide-react';
import axios from "axios";

const PAGE_SIZE = 15;

const emptyForm = {
    name: '',
    email: '',
    phone: '',
    assignedDroneId: '',
    //   password: '',
    homeCenterId: '',
    idProof: '',
    licenseId: '',
    addressLine1: '',
    addressLine2: '',
    state: '',
    city: '',
    pincode: '',
    active: true,
};

function Field({ label, name, value, onChange, placeholder, required = true, type = 'text' }) {
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
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
        </label>
    );
}

export default function ManagePilots() {
    const [pilots, setPilots] = useState([]);
    const [centers, setCenters] = useState([]);
    const [loadingPilots, setLoadingPilots] = useState(true);
    const [showAdd, setShowAdd] = useState(false);
    const [form, setForm] = useState(emptyForm);
    const [editingId, setEditingId] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [search, setSearch] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [deleteError, setDeleteError] = useState('');
    const [drones, setDrones] = useState([]);

    const handleChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
    const closeModal = () => { setShowAdd(false); setEditingId(null); setForm(emptyForm); };

    function getCsrfToken() {
        const match = document.cookie.match(/(?:^|;\s*)daas_csrf=([^;]+)/);
        return match ? decodeURIComponent(match[1]) : null;
    }

    useEffect(() => {
        const fetchDrones = async () => {
            try {
                const response = await axios.get("http://localhost:5000/api/drones/all", { withCredentials: true });
                setDrones(response.data.drones || []);
            } catch (error) { console.error(error); }
        };
        fetchDrones();
    }, []);

    const fetchPilots = async () => {
        try {
            const response = await axios.get("http://localhost:5000/api/users/pilots", { withCredentials: true });
            setPilots(response.data.pilots || []);
        } catch (error) {
            console.error(error);
        } finally {
            setLoadingPilots(false);
        }
    };

    useEffect(() => { fetchPilots(); }, []);

    useEffect(() => {
        const fetchCenters = async () => {
            try {
                const response = await axios.get("http://localhost:5000/api/centers/all", { withCredentials: true });
                setCenters(response.data.centers || []);
            } catch (error) { console.error(error); }
        };
        fetchCenters();
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            if (editingId) {
                const response = await axios.patch(
                    `http://localhost:5000/api/users/${editingId}`,
                    form,
                    { withCredentials: true, headers: { 'x-csrf-token': getCsrfToken() } }
                );
                setPilots((prev) => prev.map((p) => (p.id === editingId ? response.data.user : p)));
            } else {
                const response = await axios.post(
                    "http://localhost:5000/api/users/add",
                    { ...form, role: 'PILOT' },
                    { withCredentials: true, headers: { 'x-csrf-token': getCsrfToken() } }
                );
                setPilots((prev) => [response.data.user, ...prev]);
                if (response.data.temporaryPassword) {
                    alert(`Pilot created successfully.\n\nTemporary password: ${response.data.temporaryPassword}\n\nShare this with the pilot through an approved channel — it will not be shown again.`);
                }
            }
            closeModal();
        } catch (error) {
            console.error(error);
            alert(error.response?.data?.error || "Failed to save pilot.");
        } finally {
            setSubmitting(false);
        }
    };

    //   const startEdit = (pilot) => {
    //     setForm({ ...emptyForm, ...pilot, password: '' });
    //     setEditingId(pilot.id);
    //     setShowAdd(true);
    //   };

    const startEdit = (pilot) => {
        setForm({
            ...emptyForm,
            ...Object.fromEntries(Object.entries(pilot).map(([k, v]) => [k, v ?? ''])),
        });
        setEditingId(pilot.id);
        setShowAdd(true);
    };

    const toggleActive = async (pilotId) => {
        try {
            const response = await axios.post(
                "http://localhost:5000/api/users/toggle-active",
                { userId: pilotId },
                { withCredentials: true, headers: { 'x-csrf-token': getCsrfToken() } }
            );
            setPilots((prev) => prev.map((p) => (p.id === pilotId ? response.data.user : p)));
        } catch (error) {
            console.error(error);
            alert(error.response?.data?.error || "Failed to update status.");
        }
    };

    const confirmDelete = async () => {
        if (!deleteTarget) return;
        try {
            await axios.delete(
                `http://localhost:5000/api/users/delete/${deleteTarget.id}`,
                { withCredentials: true, headers: { 'x-csrf-token': getCsrfToken() } }
            );
            setPilots((prev) => prev.filter((p) => p.id !== deleteTarget.id));
            setDeleteTarget(null);
            setDeleteError('');
        } catch (error) {
            setDeleteError(error.response?.data?.error || "The pilot could not be deleted.");
        }
    };

    const filteredPilots = useMemo(() => {
        const term = search.trim().toLowerCase();
        if (!term) return pilots;
        return pilots.filter((p) =>
            [p.name, p.email, p.phone, p.licenseId, p.homeCenter?.name]
                .filter(Boolean)
                .some((field) => String(field).toLowerCase().includes(term))
        );
    }, [pilots, search]);

    const totalPages = Math.max(1, Math.ceil(filteredPilots.length / PAGE_SIZE));
    const paginatedPilots = filteredPilots.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

    useEffect(() => { setCurrentPage(1); }, [search]);

    return (
        <div className="min-h-screen bg-gray-100 p-4 sm:p-5">
            {/* Header */}
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <h1 className="text-2xl font-semibold text-gray-800">
                    Pilots<span className="text-gray-500"> ({pilots.length})</span>
                </h1>
                <div className="flex gap-3">
                    <div style={{ position: 'relative' }}>
                        <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', pointerEvents: 'none' }} />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search name, email, phone, license…"
                            style={{ borderRadius: '8px', border: '1px solid #d1d5db', background: '#fff', padding: '8px 12px 8px 40px', fontSize: '14px', outline: 'none', width: '260px' }}
                        />
                    </div>
                    <button
                        onClick={() => { setForm(emptyForm); setEditingId(null); setShowAdd(true); }}
                        className="submit-btn"
                        style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', padding: '0.5rem 1rem', fontSize: '0.875rem', fontWeight: 500, borderRadius: '0.5rem' }}
                    >
                        <Plus size={16} strokeWidth={2.5} />
                        Add New Pilot
                    </button>
                </div>
            </div>

            {/* Table */}
            {loadingPilots ? (
                <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
                    <table className="min-w-full divide-y divide-gray-200 text-sm">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-4 py-3 text-left text-base font-bold text-gray-700">Name</th>
                                <th className="px-4 py-3 text-left text-base font-bold text-gray-700">Email</th>
                                <th className="px-4 py-3 text-left text-base font-bold text-gray-700">Phone</th>
                                <th className="px-4 py-3 text-left text-base font-bold text-gray-700">Location</th>
                                <th className="px-4 py-3 text-left text-base font-bold text-gray-700">License ID</th>
                                <th className="px-4 py-3 text-left text-base font-bold text-gray-700">Status</th>
                                <th className="px-4 py-3 text-right text-base font-bold text-gray-700">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">Loading pilots…</td></tr>
                        </tbody>
                    </table>
                </div>
            ) : pilots.length === 0 ? (
                <div className="rounded-xl border border-dashed border-gray-300 bg-white p-12 text-center">
                    <p className="text-gray-500">No pilots registered yet.</p>
                    <button
                        onClick={() => { setForm(emptyForm); setEditingId(null); setShowAdd(true); }}
                        className="mt-3 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                    >
                        Add your first pilot
                    </button>
                </div>
            ) : (
                <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
                    <table className="min-w-full divide-y divide-gray-200 text-sm">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-4 py-3 text-left text-base font-bold text-gray-700">Name</th>
                                <th className="px-4 py-3 text-left text-base font-bold text-gray-700">Email</th>
                                <th className="px-4 py-3 text-left text-base font-bold text-gray-700">Phone</th>
                                <th className="px-4 py-3 text-left text-base font-bold text-gray-700">Location</th>
                                <th className="px-4 py-3 text-left text-base font-bold text-gray-700">Assign Drone</th>
                                <th className="px-4 py-3 text-left text-base font-bold text-gray-700">License ID</th>
                                <th className="px-4 py-3 text-left text-base font-bold text-gray-700">Status</th>
                                <th className="px-4 py-3 text-right text-base font-bold text-gray-700">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {paginatedPilots.map((pilot) => (
                                <tr key={pilot.id} className="hover:bg-gray-50">
                                    <td className="px-4 py-3 font-medium text-blue-600">{pilot.name}</td>
                                    <td className="px-4 py-3 text-gray-700">{pilot.email}</td>
                                    <td className="px-4 py-3 text-gray-700">{pilot.phone || '—'}</td>
                                    <td className="px-4 py-3 text-gray-700">
                                        <select
                                            value={pilot.homeCenterId || ''}
                                            onChange={async (e) => {
                                                try {
                                                    const response = await axios.patch(
                                                        `http://localhost:5000/api/users/${pilot.id}/operating-center`,
                                                        { homeCenterId: e.target.value },
                                                        { withCredentials: true, headers: { 'x-csrf-token': getCsrfToken() } }
                                                    );
                                                    setPilots((prev) => prev.map((p) => (p.id === pilot.id ? response.data.user : p)));
                                                } catch (error) {
                                                    alert(error.response?.data?.error || "Failed to update center.");
                                                }
                                            }}
                                            className="rounded border border-gray-300 px-2 py-1 text-sm"
                                        >
                                            <option value="" disabled>Select center…</option>
                                            {centers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                                        </select>
                                    </td>
                                    <td className="px-4 py-3 text-gray-700">
                                        {drones.find((d) => d.id === pilot.assignedDroneId)?.uin
                                            || drones.find((d) => d.id === pilot.assignedDroneId)?.model
                                            || '—'}
                                    </td>
                                    <td className="px-4 py-3 text-gray-700">{pilot.licenseId || '—'}</td>
                                    <td className="px-4 py-3">
                                        <button
                                            onClick={() => toggleActive(pilot.id)}
                                            className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${pilot.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}
                                        >
                                            {pilot.active ? 'Active' : 'Inactive'}
                                        </button>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex justify-end gap-2">
                                            <button onClick={() => startEdit(pilot)} className="rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-blue-600" title="Edit">
                                                <Pencil size={16} />
                                            </button>
                                            <button onClick={() => { setDeleteError(''); setDeleteTarget(pilot); }} className="rounded p-1.5 text-gray-500 hover:bg-red-50 hover:text-red-600" title="Remove">
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {/* Pagination */}
                    <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3 text-sm text-gray-600">
                        <span>
                            Showing {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filteredPilots.length)} of {filteredPilots.length}
                        </span>
                        <div className="flex items-center gap-2">
                            <button disabled={currentPage === 1} onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} className="rounded border border-gray-300 px-2 py-1 disabled:opacity-40">Prev</button>
                            <span>Page {currentPage} of {totalPages}</span>
                            <button disabled={currentPage === totalPages} onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} className="rounded border border-gray-300 px-2 py-1 disabled:opacity-40">Next</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Add/Edit Pilot modal */}
            {showAdd && (
                <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40 p-4">
                    <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
                        <div className="mb-4 flex items-center justify-between">
                            <h2 className="text-lg font-semibold text-gray-800">{editingId ? 'Edit Pilot' : 'Add New Pilot'}</h2>
                            <button onClick={closeModal} className="text-gray-400 hover:text-gray-600">✕</button>
                        </div>
                        <form onSubmit={handleSubmit} className="space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                                <Field label="Full Name" name="name" value={form.name} onChange={handleChange} />
                                <Field label="Work Email" name="email" value={form.email} onChange={handleChange} type="email" />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <Field label="Mobile Number" name="phone" value={form.phone} onChange={handleChange} placeholder="10-digit number" />
                                <Field label="License ID" name="licenseId" value={form.licenseId} onChange={handleChange} placeholder="Remote Pilot License No." />
                            </div>
                            <Field label="ID Proof" name="idProof" value={form.idProof} onChange={handleChange} placeholder="Aadhaar / Passport / Voter ID No." />
                            <div className="grid grid-cols-2 gap-3">
                                <label className="block">
                                    <span className="text-xs font-medium text-gray-500">Location</span>
                                    <select
                                        name="homeCenterId"
                                        value={form.homeCenterId}
                                        onChange={handleChange}
                                        required
                                        className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                    >
                                        <option value="" disabled>Select location…</option>
                                        {centers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                </label>
                                <label className="block">
                                    <span className="text-xs font-medium text-gray-500">Assign Drone</span>
                                    <select
                                        name="assignedDroneId"
                                        value={form.assignedDroneId}
                                        onChange={handleChange}
                                        className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                    >
                                        {/* <option value="">Unassigned</option> */}
                                        {drones.map((d) => <option key={d.id} value={d.id}>{d.name || d.model} · {d.uin}</option>)}
                                    </select>
                                </label>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <Field label="First Line Address" name="addressLine1" value={form.addressLine1} onChange={handleChange} />
                                <Field label="Second Line Address" name="addressLine2" value={form.addressLine2} onChange={handleChange} required={false} />
                            </div>

                            <div className="grid grid-cols-3 gap-3">
                                <Field label="State" name="state" value={form.state} onChange={handleChange} />
                                <Field label="City" name="city" value={form.city} onChange={handleChange} />
                                <Field label="Pincode" name="pincode" value={form.pincode} onChange={handleChange} />
                            </div>


                            <div className="input-group">
                                <label htmlFor="pilot-status">Status</label>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
                                    <button
                                        type="button"
                                        id="pilot-status"
                                        onClick={() => setForm({ ...form, active: !form.active })}
                                        style={{
                                            width: '44px', height: '24px', borderRadius: '999px', border: 'none', cursor: 'pointer',
                                            background: form.active ? 'var(--primary, #2e6b4d)' : '#d1d5db',
                                            position: 'relative', transition: 'background 0.2s',
                                        }}
                                    >
                                        <span style={{
                                            position: 'absolute', top: '2px', left: form.active ? '22px' : '2px',
                                            width: '20px', height: '20px', borderRadius: '50%', background: '#fff',
                                            transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                                        }} />
                                    </button>
                                    <span style={{ fontSize: '0.875rem', color: '#374151' }}>{form.active ? 'Active' : 'Inactive'}</span>
                                </div>
                            </div>

                            <div className="mt-5 flex justify-end gap-2">
                                <button type="button" onClick={closeModal} className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100">Cancel</button>
                                <button type="submit" className="submit-btn" disabled={submitting}>
                                    {submitting ? 'Saving…' : editingId ? 'Save Changes' : 'Add Pilot'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Delete confirmation */}
            {deleteTarget && (
                <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40 p-4">
                    <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
                        <h2 className="mb-2 text-lg font-semibold text-gray-800">Delete {deleteTarget.name}?</h2>
                        <p className="mb-4 text-sm text-gray-500">This can only be done if the pilot has no linked operational records. Otherwise, deactivate instead.</p>
                        {deleteError && <div className="mb-3 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{deleteError}</div>}
                        <div className="flex justify-end gap-2">
                            <button onClick={() => { setDeleteTarget(null); setDeleteError(''); }} className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100">Cancel</button>
                            <button onClick={confirmDelete} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700">Delete permanently</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}