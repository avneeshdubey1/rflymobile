import React, { useCallback, useState, useEffect, useMemo } from 'react';
import { Plus, Pencil, Trash2, Search } from 'lucide-react';
import axios from "axios";
import { io } from 'socket.io-client';
import { API_URL } from '../config';
import { csrfHeaders } from '../utils/csrf';

const PAGE_SIZE = 15;

const emptyForm = {
    name: '',
    email: '',
    phone: '',
    assignedDroneId: '',
    assignedLmvId: '',
    password: '',
    confirmPassword: '',
    homeCenterId: '',
    idProof: '',
    licenseId: '',
    addressLine1: '',
    addressLine2: '',
    state: '',
    city: '',
    pincode: '',
};

function Field({ label, name, value, onChange, placeholder, required = true, type = 'text', minLength, maxLength }) {
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
                minLength={minLength}
                maxLength={maxLength}
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
    const [lmvs, setLmvs] = useState([]);

    const activeCenters = useMemo(() => centers.filter((center) => center.active), [centers]);
    const eligibleDrones = useMemo(() => drones.filter((drone) => (
        drone.id === form.assignedDroneId || (
            !drone.archivedAt &&
            drone.homeCenterId === form.homeCenterId &&
            drone.status === 'AVAILABLE' &&
            drone.operationalState === 'IN_SERVICE' &&
            drone.availabilityState === 'AVAILABLE'
        )
    )), [drones, form.assignedDroneId, form.homeCenterId]);
    const eligibleLmvs = useMemo(() => lmvs.filter((lmv) => (
        lmv.id === form.assignedLmvId || (
            lmv.homeCenterId === form.homeCenterId && lmv.status === 'AVAILABLE'
            && lmv.operationalState === 'IN_SERVICE' && lmv.availabilityState === 'AVAILABLE'
        )
    )), [lmvs, form.assignedLmvId, form.homeCenterId]);

    const handleChange = (e) => setForm((current) => ({
        ...current,
        [e.target.name]: e.target.value,
        ...(e.target.name === 'homeCenterId' ? { assignedDroneId: '', assignedLmvId: '' } : {}),
    }));
    const closeModal = () => { setShowAdd(false); setEditingId(null); setForm(emptyForm); };

    useEffect(() => {
        const fetchDrones = async () => {
            try {
                const response = await axios.get(`${API_URL}/api/drones/all`, { withCredentials: true });
                setDrones(response.data.drones || []);
            } catch (error) { console.error(error); }
        };
        fetchDrones();
    }, []);

    useEffect(() => {
        axios.get(`${API_URL}/api/lmvs/all`, { withCredentials: true })
            .then((response) => setLmvs(response.data.lmvs || []))
            .catch(console.error);
    }, []);

    const fetchPilots = useCallback(async () => {
        try {
            const response = await axios.get(`${API_URL}/api/users/pilots`, { withCredentials: true });
            setPilots(response.data.pilots || []);
        } catch (error) {
            console.error(error);
        } finally {
            setLoadingPilots(false);
        }
    }, []);

    useEffect(() => { void fetchPilots(); }, [fetchPilots]);

    useEffect(() => {
        const socket = io(API_URL, { transports: ['websocket'], withCredentials: true });
        const refresh = (event) => {
            if (event?.resource === 'pilots') void fetchPilots();
        };
        const refreshOnFocus = () => void fetchPilots();
        socket.on('operations:data-changed', refresh);
        window.addEventListener('focus', refreshOnFocus);
        return () => {
            socket.off('operations:data-changed', refresh);
            socket.disconnect();
            window.removeEventListener('focus', refreshOnFocus);
        };
    }, [fetchPilots]);

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
        try {
            if (editingId) {
                const profileChanges = { ...form };
                delete profileChanges.active;
                delete profileChanges.password;
                delete profileChanges.confirmPassword;
                const response = await axios.patch(
                    `${API_URL}/api/users/${editingId}`,
                    profileChanges,
                    { withCredentials: true, headers: csrfHeaders() }
                );
                setPilots((prev) => prev.map((p) => (p.id === editingId ? response.data.user : p)));
            } else {
                if (form.password !== form.confirmPassword) {
                    alert('Temporary password and confirmation must match.');
                    return;
                }
                const payload = { ...form };
                delete payload.confirmPassword;
                const response = await axios.post(
                    `${API_URL}/api/users/add`,
                    { ...payload, role: 'PILOT' },
                    { withCredentials: true, headers: csrfHeaders() }
                );
                setPilots((prev) => [response.data.user, ...prev]);
            }
            closeModal();
        } catch (error) {
            console.error(error);
            alert(error.response?.data?.error || "Failed to save pilot.");
        } finally {
            setSubmitting(false);
        }
    };

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
                `${API_URL}/api/users/toggle-active`,
                { userId: pilotId },
                { withCredentials: true, headers: csrfHeaders() }
            );
            setPilots((prev) => prev.map((pilot) => (pilot.id === pilotId ? response.data.user : pilot)));
        } catch (error) {
            console.error(error);
            alert(error.response?.data?.error || 'Failed to update status.');
        }
    };

    const confirmDelete = async () => {
        if (!deleteTarget) return;
        try {
            await axios.delete(
                `${API_URL}/api/users/delete/${deleteTarget.id}`,
                { withCredentials: true, headers: csrfHeaders() }
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
                                <th className="px-4 py-3 text-left text-base font-bold text-gray-700">Preferred Drone</th>
                                <th className="px-4 py-3 text-left text-base font-bold text-gray-700">Preferred Vehicle</th>
                                <th className="px-4 py-3 text-left text-base font-bold text-gray-700">License ID</th>
                                <th className="px-4 py-3 text-left text-base font-bold text-gray-700">Status</th>
                                <th className="px-4 py-3 text-right text-base font-bold text-gray-700">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-400">Loading pilots…</td></tr>
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
                                <th className="px-4 py-3 text-left text-base font-bold text-gray-700">Preferred Drone</th>
                                <th className="px-4 py-3 text-left text-base font-bold text-gray-700">Preferred Vehicle</th>
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
                                                        `${API_URL}/api/users/${pilot.id}/operating-center`,
                                                        { homeCenterId: e.target.value },
                                                        { withCredentials: true, headers: csrfHeaders() }
                                                    );
                                                    setPilots((prev) => prev.map((p) => (p.id === pilot.id ? response.data.user : p)));
                                                } catch (error) {
                                                    alert(error.response?.data?.error || "Failed to update center.");
                                                }
                                            }}
                                            className="rounded border border-gray-300 px-2 py-1 text-sm"
                                        >
                                            <option value="" disabled>Select center…</option>
                                            {activeCenters.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                                        </select>
                                    </td>
                                    <td className="px-4 py-3 text-gray-700">
                                        {drones.find((d) => d.id === pilot.assignedDroneId)?.uin
                                            || drones.find((d) => d.id === pilot.assignedDroneId)?.model
                                            || '—'}
                                    </td>
                                    <td className="px-4 py-3 text-gray-700">
                                        {lmvs.find((lmv) => lmv.id === pilot.assignedLmvId)?.registrationNo || '—'}
                                    </td>
                                    <td className="px-4 py-3 text-gray-700">{pilot.licenseId || '—'}</td>
                                    <td className="px-4 py-3">
                                        <button
                                            type="button"
                                            onClick={() => toggleActive(pilot.id)}
                                            className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${pilot.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}
                                            title={pilot.active ? 'Deactivate pilot account' : 'Activate pilot account'}
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
                            {!editingId && <div className="grid grid-cols-2 gap-3">
                                <Field label="Temporary Password" name="password" value={form.password} onChange={handleChange} type="password" minLength={12} maxLength={72} placeholder="12 to 72 UTF-8 bytes" />
                                <Field label="Confirm Temporary Password" name="confirmPassword" value={form.confirmPassword} onChange={handleChange} type="password" minLength={12} maxLength={72} placeholder="Repeat temporary password" />
                            </div>}
                            {!editingId && <p className="text-xs text-gray-500">Enter a temporary password deliberately and share it only through an approved channel. It will not be returned or shown after account creation.</p>}
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
                                        {activeCenters.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
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
                                        <option value="">No preferred drone</option>
                                        {eligibleDrones.map((d) => <option key={d.id} value={d.id}>{d.name || d.model} · {d.uin || d.serialNumber}{d.status !== 'AVAILABLE' || d.operationalState !== 'IN_SERVICE' || d.availabilityState !== 'AVAILABLE' ? ' · currently unavailable' : ''}</option>)}
                                    </select>
                                    {form.homeCenterId && eligibleDrones.length === 0 && <span className="mt-1 block text-xs text-amber-700">No available drone at this center. Return an imported drone to service from Fleet Overview, or register one.</span>}
                                </label>
                            </div>
                            <label className="block">
                                <span className="text-xs font-medium text-gray-500">Assign Vehicle</span>
                                <select name="assignedLmvId" value={form.assignedLmvId} onChange={handleChange}
                                    className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100">
                                    <option value="">No preferred vehicle</option>
                                    {eligibleLmvs.map((lmv) => <option key={lmv.id} value={lmv.id}>{lmv.registrationNo}{lmv.label ? ` · ${lmv.label}` : ''}{lmv.status !== 'AVAILABLE' || lmv.operationalState !== 'IN_SERVICE' || lmv.availabilityState !== 'AVAILABLE' ? ' · currently unavailable' : ''}</option>)}
                                </select>
                                {form.homeCenterId && eligibleLmvs.length === 0 && <span className="mt-1 block text-xs text-amber-700">No available vehicle at this center. Return an imported LMV to service from Fleet Overview, or register one.</span>}
                                <span className="mt-1 block text-xs text-gray-500">Scheduling prefers this vehicle when it is safe and available; it never bypasses centre, maintenance, or conflict checks.</span>
                            </label>

                            <div className="grid grid-cols-2 gap-3">
                                <Field label="First Line Address" name="addressLine1" value={form.addressLine1} onChange={handleChange} />
                                <Field label="Second Line Address" name="addressLine2" value={form.addressLine2} onChange={handleChange} required={false} />
                            </div>

                            <div className="grid grid-cols-3 gap-3">
                                <Field label="State" name="state" value={form.state} onChange={handleChange} />
                                <Field label="City" name="city" value={form.city} onChange={handleChange} />
                                <Field label="Pincode" name="pincode" value={form.pincode} onChange={handleChange} />
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
