import { useEffect, useState } from "react";
import { useAuth } from "../context/useAuth";
import { useTranslation } from "react-i18next";
import { API_URL as API } from "../config";
import { csrfHeaders } from "../utils/csrf";

import OpsIcon from "../components/OpsIcon";
import TerrainMap from "../components/TerrainMap";

const SUBSCRIPTION_YEARS = ['2026-27', '2027-28'];
const localMobileNumber = (value) => String(value || '').replace(/\D/g, '').slice(-10);

const initialForm = {
    farmerName: "",
    phone: "",
    acreage: "",
    cropType: "",
    cropTypeOther: "",
    village: "",
    district: "",
    mapsLink: "",
    soilType: "",
    cropAgeWeeks: "",
    sprayPurpose: [],
    expectedDate: "",
    expectedTime: "",
    waterBodyNearby: false,
    terrainType: "",

    // Ownership & acreage
    farmerOwnership: "",
    totalAcres: "",

    // Location extras
    mandal: "",
    state: "",

    // Subscription
    subscriptionCardNumber: "",
    subscriptionYear: "2026-27",

    // Remarks
    remarks: "",
    requestType: "B2C",
    b2bSubcategoryCode: "",
    clusterId: "",
    reportingAdminCode: "",
    leadSourceCode: ""
};


function FarmDetails() {
    const { t } = useTranslation();
    const { user, logout } = useAuth();
    const [busy, setBusy] = useState(false);
    const [farmerFound, setFarmerFound] = useState(false);
    const [customerId, setCustomerId] = useState(null);
    const [farmerMessage, setFarmerMessage] = useState("");
    const [notice, setNotice] = useState(null);
    const [mapKey, setMapKey] = useState(0); // forces TerrainMap to remount/reset
    const [masters, setMasters] = useState({ clusters: [], crops: [], sprayPurposes: [], b2bSubcategories: [], leadSources: [], reportingAdmins: [] });

    const [form, setForm] = useState(initialForm);
    useEffect(() => {
        fetch(`${API}/api/master-data/choices`, { credentials: 'include' })
            .then(async (response) => {
                const body = await response.json();
                if (!response.ok) throw new Error(body.error || 'Failed to load intake master data');
                setMasters(body.data);
            })
            .catch((error) => setNotice({ kind: 'error', message: error.message }));
    }, []);
    const showNotice = (kind, message, duration = 6000) => {
        setNotice({ kind, message });
        setTimeout(() => setNotice(null), duration);
    };

    const submitRequest = async (e) => {
        e.preventDefault();
        const normalizedPhone = localMobileNumber(form.phone);
        if (normalizedPhone.length !== 10) {
            showNotice("error", "Mobile number must be exactly 10 digits.");
            return;
        }
        if (!farmerFound || !customerId) {
            showNotice("error", "Select a registered customer by entering their mobile number first.");
            return;
        }
        const selectedCrop = form.cropType;
        if (!selectedCrop) {
            showNotice("error", "Please select a crop type.");
            return;
        }
        if (!form.totalAcres || Number(form.totalAcres) <= 0) {
            showNotice("error", "Total acres must be greater than zero.");
            return;
        }
        setBusy(true);
        setNotice(null);
        try {
            if (!form.mapsLink) {
                showNotice("error", "Please share a GPS location so we can confirm service availability.");
                setBusy(false);
                return;
            }

            const payload = {
                farmerName: form.farmerName,
                farmerPhone: normalizedPhone,
                acreage: form.totalAcres ? parseFloat(form.totalAcres) : undefined,
                cropType: selectedCrop,
                village: `${form.village}, ${form.district}`,
                mapsLink: form.mapsLink,
                soilType: form.soilType,
                cropAgeWeeks: form.cropAgeWeeks
                    ? parseInt(form.cropAgeWeeks)
                    : undefined,
                sprayPurpose: form.sprayPurpose,
                expectedDate: form.expectedDate,
                expectedTime: form.expectedTime,
                waterBodyNearby: form.waterBodyNearby,
                terrainType: form.terrainType,

                farmerOwnership: form.farmerOwnership,
                totalAcres: form.totalAcres ? parseFloat(form.totalAcres) : undefined,

                mandal: form.mandal,
                state: form.state,

                subscriptionCardNumber: form.subscriptionCardNumber,
                subscriptionYear: form.subscriptionYear,

                notes: form.remarks,
                requestType: form.requestType,
                b2bSubcategoryCode: form.requestType === 'B2B' ? form.b2bSubcategoryCode : null,
                clusterId: form.clusterId,
                reportingAdminCode: form.reportingAdminCode,
                leadSourceCode: form.leadSourceCode
            };
            const response = await fetch(`${API}/api/customers/sales/${encodeURIComponent(customerId)}/leads`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...csrfHeaders()
                },
                credentials: 'include',
                body: JSON.stringify(payload)
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(
                    data.error || 'Failed to submit request.'
                );
            }
            showNotice("success", "Your Spraying service request has been submitted successfully!");
            setForm(initialForm);
            setFarmerFound(false);
            setCustomerId(null);
            setFarmerMessage("");
            setMapKey((prev) => prev + 1);
        } catch (err) {
            showNotice("error", err.message);
        } finally {
            setBusy(false);
        }
    };



    const searchFarmer = async (phone) => {
        if (phone.length !== 10) {
            setFarmerFound(false);
            setCustomerId(null);
            setFarmerMessage("");
            return;
        }
        try {
            const response = await fetch(`${API}/api/customers/sales?q=${encodeURIComponent(phone)}`, { credentials: 'include' });
            const data = await response.json().catch(() => ({}));
            if (!response.ok || !data.success) throw new Error(data.error || "Customer lookup failed");
            const normalizedPhone = phone.replace(/\D/g, "").slice(-10);
            const farmer = (data.customers || []).find(
                (customer) => String(customer.phone || "").replace(/\D/g, "").slice(-10) === normalizedPhone
            );
            if (farmer) {
                setFarmerFound(true);
                setCustomerId(farmer.id);
                setFarmerMessage("");

                setForm((prev) => ({
                    ...prev,

                    // Basic Details
                    phone: localMobileNumber(farmer.phone),
                    farmerName: farmer.displayName || "",
                    farmerOwnership: farmer.ownership === "OWNER" ? "Owner" : farmer.ownership === "TENANT" ? "Tenant" : "",
                    totalAcres: farmer.totalAcres?.toString() || "",

                    // Location
                    village: farmer.village || "",
                    mandal: farmer.mandal || "",
                    district: farmer.district || "",
                    state: farmer.state || "",
                    clusterId: farmer.clusterId || "",

                    // Subscription
                    subscriptionCardNumber: farmer.subscriptionCardNumber || "",
                    subscriptionYear:
                        farmer.subscriptionYear || prev.subscriptionYear,

                    // Remarks
                    remarks: farmer.remarks || "",
                }));
            }
            else {
                setFarmerFound(false);
                setCustomerId(null);
                setFarmerMessage("Farmer is not registered.");

                setForm((prev) => ({
                    ...prev,

                    farmerName: "",
                    farmerOwnership: "",
                    totalAcres: "",

                    village: "",
                    mandal: "",
                    district: "",
                    state: "",
                    clusterId: "",

                    subscriptionCardNumber: "",
                    subscriptionYear: "2026-27",

                    remarks: "",
                }));
            }
        }
        catch (error) {
            setFarmerFound(false);
            setCustomerId(null);
            setFarmerMessage(error.message || "Customer lookup failed.");
        }
    };

    return (
        <section className="panel panel--raised" style={{ maxWidth: '900px' }}>
            <div className="panel-header">
                <div className="panel-header__title">
                    <div className="panel-title-row">
                        <span className="panel-title-icon"><OpsIcon name="plus" /></span>
                        <h2>{t('Service Details')}</h2>
                    </div>
                    <p>{t('Fill in the form to book a Spraying.')}</p>
                </div>
            </div>
            <form className="panel-body" style={{ padding: '1.5rem', background: 'var(--canvas)' }} onSubmit={submitRequest}>

                {/* Section 1: Farm Details */}
                <div style={{ background: 'var(--surface-raised)', padding: '1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', marginBottom: '1.2rem', boxShadow: 'var(--shadow-sm)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.6rem' }}>
                        <OpsIcon name="leaf" size={20} style={{ color: 'var(--primary)' }} />
                        <h3 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1.15rem', fontWeight: 750 }}>{t('Farm Details')}</h3>
                    </div>
                    <div className="form-stack">
                        <div className="row-group">
                            <div className="input-group">
                                <label>{t("Farmer Name")}</label>
                                <input
                                    type="text"
                                    value={form.farmerName}
                                    readOnly
                                    placeholder="Automatically filled"
                                />
                            </div>

                            <div className="input-group">
                                <label>{t("Mobile Number")}</label>
                                <input
                                    type="tel"
                                    placeholder="Enter mobile number"
                                    value={form.phone}
                                    maxLength={10}
                                    inputMode="numeric"
                                    disabled={busy}
                                    onChange={(e) => {
                                        const phone = e.target.value.replace(/\D/g, "").slice(0, 10);
                                        setForm({
                                            ...form,
                                            phone,
                                        });

                                        if (phone.length === 10) {
                                            searchFarmer(phone);
                                        }
                                    }}
                                />
                                {form.phone && form.phone.length !== 10 && (
                                    <small style={{ color: "red" }}>
                                        Mobile number must be exactly 10 digits.
                                    </small>
                                )}
                                {farmerMessage && (
                                    <small style={{ color: "red" }}>
                                        {farmerMessage}
                                    </small>
                                )}
                            </div>
                        </div>
                        <div className="row-group">
                            <div className="input-group">
                                <label>{t('Farmer Ownership')}</label>
                                <select disabled={busy} value={form.farmerOwnership} onChange={e => setForm({ ...form, farmerOwnership: e.target.value })}>
                                    <option value="">{t('Select')}</option>
                                    <option value="Owner">{t('Owner')}</option>
                                    <option value="Tenant">{t('Tenant')}</option>
                                </select>
                            </div>
                            <div className="input-group">
                                <label>{t('Total Acres')}</label>
                                <input type="number" step="0.1" min="0.1" required disabled={busy} value={form.totalAcres} onChange={e => setForm({ ...form, totalAcres: e.target.value })} placeholder={t('e.g. 5')} />
                            </div>
                        </div>
                        <div className="row-group">
                            <div className="input-group">
                                <label>{t('Crop Type')}</label>
                                <select required disabled={busy} value={form.cropType} onChange={e => setForm({ ...form, cropType: e.target.value })}>
                                    <option value="">{t('Select crop')}</option>
                                    {masters.crops.map(crop => (
                                        <option key={crop.id} value={crop.displayName}>{crop.displayName}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <div className="row-group">
                            <div className="input-group">
                                <label>{t('Soil Type')}</label>
                                <input type="text" disabled={busy} value={form.soilType} onChange={e => setForm({ ...form, soilType: e.target.value })} placeholder={t('e.g. Black soil, Red soil')} />
                            </div>
                            <div className="input-group">
                                <label>{t('Crop Age (Weeks)')}</label>
                                <input
                                    type="number"
                                    min="0"
                                    disabled={busy}
                                    value={form.cropAgeWeeks}
                                    onChange={(e) => {
                                        const value = e.target.value;
                                        if (value === "" || Number(value) >= 0) {
                                            setForm({
                                                ...form,
                                                cropAgeWeeks: value,
                                            });
                                        }
                                    }}
                                    placeholder={t('e.g. 4')}
                                />
                            </div>
                        </div>

                    </div>
                </div>

                {/* Section 2: Spraying Requirements */}
                <div style={{ background: 'var(--surface-raised)', padding: '1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', marginBottom: '1.25rem', boxShadow: 'var(--shadow-sm)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.6rem' }}>
                        <OpsIcon name="drone" size={20} style={{ color: 'var(--primary)' }} />
                        <h3 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1.15rem', fontWeight: 750 }}>{t('Spraying Requirements')}</h3>
                    </div>
                    <div className="form-stack">
                        <div className="row-group">
                            <div className="input-group">
                                <label>{t('Expected Spraying Date')}</label>
                                <input type="date" disabled={busy} value={form.expectedDate} onChange={e => setForm({ ...form, expectedDate: e.target.value })} />
                            </div>
                            <div className="input-group">
                                <label>{t('Expected Time')}</label>
                                <select disabled={busy} value={form.expectedTime} onChange={e => setForm({ ...form, expectedTime: e.target.value })}>
                                    <option value="">{t('Any time')}</option>
                                    <option value="Morning (6 AM - 11 AM)">
                                        {t('Morning (6 AM - 11 AM)')}
                                    </option>
                                    <option value="Afternoon (11 AM - 4 PM)">
                                        {t('Afternoon (11 AM - 4 PM)')}
                                    </option>
                                    <option value="Evening (4 PM - 7 PM)">
                                        {t('Evening (4 PM - 7 PM)')}
                                    </option>
                                </select>
                            </div>
                        </div>

                        <div className="input-group">
                            <label style={{ marginBottom: '0.2rem' }}>{t('Spray Purpose')}</label>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.65rem' }}>
                                {masters.sprayPurposes.map(purpose => {
                                    const isChecked = Array.isArray(form.sprayPurpose) && form.sprayPurpose.includes(purpose.code);
                                    return (
                                        <label key={purpose.id} style={{
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            padding: '0.85rem 0.5rem',
                                            border: `2px solid ${isChecked ? 'var(--primary)' : 'var(--border)'}`,
                                            borderRadius: 'var(--radius-sm)',
                                            background: isChecked ? 'var(--primary-soft)' : 'var(--surface)',
                                            cursor: busy ? 'not-allowed' : 'pointer',
                                            transition: 'all 0.2s ease',
                                            textAlign: 'center',
                                            fontWeight: isChecked ? '700' : '500',
                                            color: isChecked ? 'var(--primary-hover)' : 'var(--text-primary)',
                                            userSelect: 'none',
                                            lineHeight: '1.2'
                                        }}>
                                            <input
                                                type="checkbox"
                                                style={{ display: 'none' }}
                                                disabled={busy}
                                                checked={isChecked}
                                                onChange={(e) => {
                                                    const current = Array.isArray(form.sprayPurpose) ? form.sprayPurpose : [];
                                                    const newPurposes = e.target.checked
                                                        ? [...current, purpose.code]
                                                        : current.filter(p => p !== purpose.code);
                                                    setForm({ ...form, sprayPurpose: newPurposes });
                                                }}
                                            />
                                            {purpose.displayName}
                                        </label>
                                    );
                                })}
                            </div>
                        </div>

                        <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 1.15rem', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', background: 'var(--surface)', cursor: busy ? 'not-allowed' : 'pointer', marginTop: '0.2rem' }}>
                            <span style={{ fontWeight: 650, color: 'var(--text-primary)' }}>{t('Is there a water body nearby?')}</span>
                            <input type="checkbox" disabled={busy} checked={form.waterBodyNearby} onChange={e => setForm({ ...form, waterBodyNearby: e.target.checked })} style={{ width: '22px', height: '22px', margin: 0, cursor: 'pointer' }} />
                        </label>

                    </div>
                </div>

                {/* Section 3: Location */}
                <div style={{ background: 'var(--surface-raised)', padding: '1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', marginBottom: '1.25rem', boxShadow: 'var(--shadow-sm)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.6rem' }}>
                        <OpsIcon name="location" size={20} style={{ color: 'var(--primary)' }} />
                        <h3 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1.15rem', fontWeight: 750 }}>{t('Location')}</h3>
                    </div>
                    <div className="form-stack">
                        <div className="row-group">
                            <div className="input-group">
                                <label>{t('Request Type')}</label>
                                <select required disabled={busy} value={form.requestType} onChange={e => setForm({ ...form, requestType: e.target.value, b2bSubcategoryCode: '' })}>
                                    <option value="B2C">B2C</option><option value="B2B">B2B</option>
                                </select>
                            </div>
                            {form.requestType === 'B2B' && <div className="input-group">
                                <label>{t('B2B Sub-Category')}</label>
                                <select required disabled={busy} value={form.b2bSubcategoryCode} onChange={e => setForm({ ...form, b2bSubcategoryCode: e.target.value })}>
                                    <option value="">Select B2B category</option>
                                    {masters.b2bSubcategories.map(item => <option key={item.id} value={item.code}>{item.displayName}</option>)}
                                </select>
                            </div>}
                        </div>
                        <div className="row-group">
                            <div className="input-group">
                                <label>{t('Cluster')}</label>
                                <select required disabled={busy} value={form.clusterId} onChange={e => setForm({ ...form, clusterId: e.target.value })}>
                                    <option value="">Select cluster</option>
                                    {masters.clusters.map(item => <option key={item.id} value={item.id}>{item.displayName}</option>)}
                                </select>
                                <span className="field-hint">Cluster Type: {masters.clusters.find(item => item.id === form.clusterId)?.type || '—'}</span>
                            </div>
                            <div className="input-group">
                                <label>{t('Reporting Admin')}</label>
                                <select required disabled={busy} value={form.reportingAdminCode} onChange={e => setForm({ ...form, reportingAdminCode: e.target.value })}>
                                    <option value="">Select reporting Admin</option>
                                    {masters.reportingAdmins.map(item => <option key={item.id} value={item.code}>{item.displayName}</option>)}
                                </select>
                            </div>
                        </div>
                        <div className="input-group">
                            <label>{t('Lead Source')}</label>
                            <select required disabled={busy} value={form.leadSourceCode} onChange={e => setForm({ ...form, leadSourceCode: e.target.value })}>
                                <option value="">Select lead source</option>
                                {masters.leadSources.map(item => <option key={item.id} value={item.code}>{item.displayName}</option>)}
                            </select>
                        </div>
                        <div className="row-group">
                            <div className="input-group">
                                <label>{t('Village Location')}</label>
                                <input type="text" required disabled={busy} value={form.village} onChange={e => setForm({ ...form, village: e.target.value })} placeholder={t('Village name')} />
                            </div>
                            <div className="input-group">
                                <label>{t('Mandal')}</label>
                                <input type="text" disabled={busy} value={form.mandal} onChange={e => setForm({ ...form, mandal: e.target.value })} placeholder={t('Mandal name')} />
                            </div>
                        </div>
                        <div className="row-group">
                            <div className="input-group">
                                <label>{t('District')}</label>
                                <input type="text" required disabled={busy} value={form.district} onChange={e => setForm({ ...form, district: e.target.value })} placeholder={t('District name')} />
                            </div>
                            <div className="input-group">
                                <label>{t('State')}</label>
                                <input type="text" disabled={busy} value={form.state} onChange={e => setForm({ ...form, state: e.target.value })} placeholder={t('State name')} />
                            </div>
                        </div>

                        <div className="input-group">
                            <label>{t('Precise Farm Location')}</label>
                            <span className="field-hint" style={{ marginBottom: '0.8rem', display: 'block' }}>{t('Search your area, fetch GPS, or drag the pin. The terrain will be analyzed automatically.')}</span>
                            <div style={{ borderRadius: 'var(--radius-sm)', overflow: 'hidden', border: '1px solid var(--border)' }}>
                                <TerrainMap
                                    key={mapKey}
                                    onLocationChange={(coords) => {
                                        setForm(prev => ({
                                            ...prev,
                                            mapsLink: coords
                                        }));
                                    }}
                                    onTerrainCalculated={(terrain) =>
                                        setForm(prev => ({
                                            ...prev,
                                            terrainType: terrain
                                        }))
                                    }
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Section 4: Subscription & Remarks */}
                <div style={{ background: 'var(--surface-raised)', padding: '1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', marginBottom: '1.5rem', boxShadow: 'var(--shadow-sm)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.6rem' }}>
                        <OpsIcon name="plus" size={20} style={{ color: 'var(--primary)' }} />
                        <h3 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1.15rem', fontWeight: 750 }}>{t('Subscription & Remarks')}</h3>
                    </div>
                    <div className="form-stack">
                        <div className="row-group">
                            <div className="input-group">
                                <label>{t('Subscription Card Number')}</label>
                                <input type="text" disabled={busy} value={form.subscriptionCardNumber} onChange={e => setForm({ ...form, subscriptionCardNumber: e.target.value })} placeholder={t('Optional')} />
                            </div>
                            <div className="input-group">
                                <label>{t('Subscription Year')}</label>
                                <select disabled={busy} value={form.subscriptionYear} onChange={e => setForm({ ...form, subscriptionYear: e.target.value })}>
                                    {SUBSCRIPTION_YEARS.map(year => (
                                        <option key={year} value={year}>{year}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <div className="input-group">
                            <label>{t('Description / Remarks')}</label>
                            <textarea
                                rows={3}
                                disabled={busy}
                                value={form.remarks}
                                onChange={e => setForm({ ...form, remarks: e.target.value })}
                                placeholder={t('Any additional notes about the request')}
                                style={{ width: '100%', resize: 'vertical', fontFamily: 'inherit' }}
                            />
                        </div>
                    </div>
                </div>

                {notice && (
                    <div
                        style={{
                            marginBottom: "15px",
                            padding: "12px",
                            borderRadius: "8px",
                            backgroundColor: notice.kind === "success" ? "#d4edda" : "#f8d7da",
                            color: notice.kind === "success" ? "#155724" : "#721c24",
                            fontWeight: "600",
                            textAlign: "center"
                        }}
                    >
                        {notice.message}
                    </div>
                )}
                <div className="form-actions">
                    <button type="submit" className="submit-btn" disabled={busy} style={{ width: '100%', padding: '1rem', fontSize: '1.15rem', borderRadius: 'var(--radius-md)', boxShadow: '0 8px 20px rgba(46, 107, 77, 0.25)' }}>
                        {busy ? t('Submitting...') : t('Submit Request')}
                    </button>
                </div>
            </form>
        </section>
    )
}

export default FarmDetails;
