import { useState } from "react";
import { useAuth } from "../context/useAuth";
import { useTranslation } from "react-i18next";
import { API_URL as API } from "../config";

import OpsIcon from "../components/OpsIcon";
import TerrainMap from "../components/TerrainMap";

const SEASON_CROPS = [
    'Paddy', 'Black gram', 'Maize', 'Green gram', 'Red gram', 'Cotton',
    'Chilly', 'Sugar cane', 'Jowar', 'Bengal gram', 'Ground nut', 'Tobacco', 'Others'
];

const SUMMER_CROPS = [
    'Drain', 'Municipality Indents', 'Sugar Cane', 'Paddy', 'Others'
];


const clusterOptions = [
    "NELLORE - AP",
    "KAKINADA - AP",
    "HYDRABAD - TS",
    "KANKIPADU - AP",
    "CHINTALAPUDI - AP",
    "VISSANAPETA - AP",
    "TIRUVURU - AP",
    "MAMILAPALLI - AP",
    "WARANGAL - TS",
    "HAVERI - KA",
    "BELGAVI - KA",
];
const clusterTypeOptions = ["HUB", "SPOKE", "MINIHUB"];
const REQUEST_TYPE_OPTIONS = ["B2B", "B2C"];
const B2B_SUB_CATEGORY_OPTIONS = [
    "CIL-AP",
    "CIL-TS",
    "CIL-TN",
    "CIL-KA",
    "ITC",
];
const REPORTING_ADMIN_OPTIONS = [
    "Davuluri Narayana Rao",
    "Vasa Srikanth",
];

const LEAD_SOURCE_OPTIONS = [
    "OFFICE",
    "CIL",
    "THETA",
    "ITC",
    "PILOT",
    "MARKETING",
    "VBP",
];

const SUBSCRIPTION_YEARS = ['2026-27', '2027-28'];
const localMobileNumber = (value) => String(value || '').replace(/\D/g, '').slice(-10);

const initialForm = {
    farmerName: "",
    phone: "",
    acreage: "",
    cropType: "",
    village: "",
    district: "",
    mapsLink: "",
    soilType: "",
    cropAgeWeeks: "",
    chemicalBrand: "",
    sprayPurpose: "",
    hasChemical: true,
    chemicalProofUrl: "",
    expectedDate: "",
    expectedTime: "",
    waterBodyNearby: false,
    terrainType: "",

    // Which season this lead/spraying is for
    season: "", // "kharif" | "rabi" | "summer"

    // Ownership & acreage
    farmerOwnership: "",
    totalAcres: "",

    // Kharif
    kharifCrop: "",
    kharifCropOther: "",
    kharifAcres: "",
    kharifTanks: "",
    kharifSprayings: "",

    // Rabi
    rabiCrop: "",
    rabiCropOther: "",
    rabiAcres: "",
    rabiTanks: "",
    rabiSprayings: "",

    // Summer
    summerCrop: "",
    summerCropOther: "",
    summerAcres: "",
    summerTanks: "",

    // Location extras
    mandal: "",
    state: "",
    cluster: "",
    clusterType: "",

    // request type
    requestType: "",
    subCategory: "",

    // Assignment
    pilotId: "",
    pilotName: "",
    pilotAssignedDroneId: "",
    pilotAssignedVehicleId: "",

    copilotId: "",
    copilotName: "",
    copilotAssignedDroneId: "",
    copilotAssignedVehicleId: "",

    reportingAdmin: "",
    leadSource: "",

    // Subscription
    subscriptionCardNumber: "",
    subscriptionYear: "2026-27",

    // Remarks
    remarks: ""
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

    const [pilots, setPilots] = useState([]);
    const [drones, setDrones] = useState([]);
    const [vehicles, setVehicles] = useState([]);

    const [form, setForm] = useState(initialForm);
    const showNotice = (kind, message, duration = 6000) => {
        setNotice({ kind, message });
        setTimeout(() => setNotice(null), duration);
    };

    const sprayPurposes = [
        'Pesticides',
        'Insecticides',
        'Fungicides',
        'Herbicides',
        'Micronutrients (e.g., Zinc)',
        'Macronutrients (e.g., Nitrogen)',
        'water body spraying'
    ];

    const [showSprayPurposeDropdown, setShowSprayPurposeDropdown] = useState(false);


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
        if (!form.season) {
            showNotice("error", "Please select a season for this request.");
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

            const isSeasonFilled = (cropField, cropOtherField, acresField) => {
                const cropValue = form[cropField];
                if (!cropValue) return false;
                if (cropValue === 'Others' && !form[cropOtherField].trim()) return false;
                if (!form[acresField] || parseFloat(form[acresField]) <= 0) return false;
                return true;
            };

            const seasonFieldMap = {
                kharif: ['kharifCrop', 'kharifCropOther', 'kharifAcres'],
                rabi: ['rabiCrop', 'rabiCropOther', 'rabiAcres'],
                summer: ['summerCrop', 'summerCropOther', 'summerAcres'],
            };

            const [cropField, cropOtherField, acresField] = seasonFieldMap[form.season];
            if (!isSeasonFilled(cropField, cropOtherField, acresField)) {
                showNotice("error", `Please fill in the crop and acres for the selected season (${form.season}).`);
                setBusy(false);
                return;
            }
            const selectedCrop = form[cropField] === 'Others'
                ? form[cropOtherField].trim()
                : form[cropField];

            const payload = {
                farmerName: form.farmerName,
                farmerPhone: normalizedPhone,
                acreage: form.totalAcres ? parseFloat(form.totalAcres) : undefined,
                cropType: form.cropType,
                village: `${form.village}, ${form.district}`,
                mapsLink: form.mapsLink,
                soilType: form.soilType,
                cropAgeWeeks: form.cropAgeWeeks
                    ? parseInt(form.cropAgeWeeks)
                    : undefined,
                chemicalBrand: form.chemicalBrand,
                sprayPurpose: Array.isArray(form.sprayPurpose)
                    ? form.sprayPurpose.join(', ')
                    : form.sprayPurpose,
                hasChemical: form.hasChemical,
                chemicalProofUrl: form.chemicalProofUrl,
                expectedDate: form.expectedDate,
                expectedTime: form.expectedTime,
                waterBodyNearby: form.waterBodyNearby,
                terrainType: form.terrainType,

                farmerOwnership: form.farmerOwnership,
                totalAcres: form.totalAcres ? parseFloat(form.totalAcres) : undefined,

                // Which season this lead is for
                season: form.season,

                kharifCrop: form.kharifCrop === 'Others' ? form.kharifCropOther : form.kharifCrop,
                kharifAcres: form.kharifAcres ? parseFloat(form.kharifAcres) : undefined,
                kharifTanks: form.kharifTanks ? parseFloat(form.kharifTanks) : undefined,
                kharifSprayings: form.kharifSprayings ? parseInt(form.kharifSprayings) : undefined,

                rabiCrop: form.rabiCrop === 'Others' ? form.rabiCropOther : form.rabiCrop,
                rabiAcres: form.rabiAcres ? parseFloat(form.rabiAcres) : undefined,
                rabiTanks: form.rabiTanks ? parseFloat(form.rabiTanks) : undefined,
                rabiSprayings: form.rabiSprayings ? parseInt(form.rabiSprayings) : undefined,

                summerCrop: form.summerCrop === 'Others' ? form.summerCropOther : form.summerCrop,
                summerAcres: form.summerAcres ? parseFloat(form.summerAcres) : undefined,
                summerTanks: form.summerTanks ? parseFloat(form.summerTanks) : undefined,

                mandal: form.mandal,
                state: form.state,

                subscriptionCardNumber: form.subscriptionCardNumber,
                subscriptionYear: form.subscriptionYear,

                remarks: form.remarks
            };
            const response = await fetch(`${API}/api/customers/sales/${encodeURIComponent(customerId)}/leads`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
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
            const response = await fetch(`${API}/api/customers/sales?q=${encodeURIComponent(phone)}`);
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

                    // Kharif
                    kharifCrop: farmer.kharifCrop || "",
                    kharifCropOther: farmer.kharifOtherCrop || "",
                    kharifAcres: farmer.kharifAcres?.toString() || "",
                    kharifTanks: farmer.kharifTanks?.toString() || "",
                    kharifSprayings: farmer.kharifSprayings?.toString() || "",

                    // Rabi
                    rabiCrop: farmer.rabiCrop || "",
                    rabiCropOther: farmer.rabiOtherCrop || "",
                    rabiAcres: farmer.rabiAcres?.toString() || "",
                    rabiTanks: farmer.rabiTanks?.toString() || "",
                    rabiSprayings: farmer.rabiSprayings?.toString() || "",

                    // Summer
                    summerCrop: farmer.summerCrop || "",
                    summerCropOther: farmer.summerOtherCrop || "",
                    summerAcres: farmer.summerAcres?.toString() || "",
                    summerTanks: farmer.summerTanks?.toString() || "",

                    // Location
                    village: farmer.village || "",
                    mandal: farmer.mandal || "",
                    district: farmer.district || "",
                    state: farmer.state || "",

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

                    kharifCrop: "",
                    kharifCropOther: "",
                    kharifAcres: "",
                    kharifTanks: "",
                    kharifSprayings: "",

                    rabiCrop: "",
                    rabiCropOther: "",
                    rabiAcres: "",
                    rabiTanks: "",
                    rabiSprayings: "",

                    summerCrop: "",
                    summerCropOther: "",
                    summerAcres: "",
                    summerTanks: "",

                    village: "",
                    mandal: "",
                    district: "",
                    state: "",

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

    // Shared renderer for the Kharif / Rabi / Summer crop blocks so the three
    // seasons stay visually and behaviourally consistent.
    const renderSeasonBlock = ({
        label, cropOptions, cropField, cropOtherField, acresField, tanksField, sprayingsField
    }) => (
        <div style={{ padding: '1rem', background: 'var(--surface)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', marginBottom: '1rem' }}>
            <h4 style={{ margin: '0 0 0.85rem', color: 'var(--text-primary)', fontSize: '1rem', fontWeight: 700 }}>{t(label)}</h4>
            <div className="form-stack">
                <div className="row-group">
                    <div className="input-group">
                        <label>{t(`${label} Crop`)}</label>
                        <select
                            disabled={busy}
                            value={form[cropField]}
                            onChange={e => setForm({ ...form, [cropField]: e.target.value })}
                        >
                            <option value="">{t('Select crop')}</option>
                            {cropOptions.map(crop => (
                                <option key={crop} value={crop}>{t(crop)}</option>
                            ))}
                        </select>
                    </div>
                    {form[cropField] === 'Others' && (
                        <div className="input-group">
                            <label>{t('Specify Crop')}</label>
                            <input
                                type="text"
                                disabled={busy}
                                value={form[cropOtherField]}
                                onChange={e => setForm({ ...form, [cropOtherField]: e.target.value })}
                                placeholder={t('Enter crop name')}
                            />
                        </div>
                    )}
                </div>
                <div className="row-group">
                    <div className="input-group">
                        <label>{t(`${label} Acres`)}</label>
                        <input
                            type="number"
                            step="0.1"
                            min="0"
                            disabled={busy}
                            value={form[acresField]}
                            onChange={e => setForm({ ...form, [acresField]: e.target.value })}
                            placeholder={t('e.g. 2.5')}
                        />
                    </div>
                    <div className="input-group">
                        <label>{t(`${label} Tanks`)}</label>
                        <input
                            type="number"
                            step="0.1"
                            min="0"
                            disabled={busy}
                            value={form[tanksField]}
                            onChange={e => setForm({ ...form, [tanksField]: e.target.value })}
                            placeholder={t('e.g. 10')}
                        />
                    </div>
                    {sprayingsField && (
                        <div className="input-group">
                            <label>{t(`${label} Sprayings`)}</label>
                            <input
                                type="number"
                                min="0"
                                disabled={busy}
                                value={form[sprayingsField]}
                                onChange={e => setForm({ ...form, [sprayingsField]: e.target.value })}
                                placeholder={t('Number of sprayings')}
                            />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );




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
                                <input type="number" step="0.1" min="0" disabled={busy} value={form.totalAcres} onChange={e => setForm({ ...form, totalAcres: e.target.value })} placeholder={t('e.g. 5')} />
                            </div>
                        </div>
                        <div className="row-group">
                            <div className="input-group">
                                <label>{t('Soil Type')}</label>
                                <input type="text" disabled={busy} value={form.soilType} onChange={e => setForm({ ...form, soilType: e.target.value })} placeholder={t('e.g. Black soil, Red soil')} />
                            </div>
                            <div className="input-group">
                                <label>{t('Crop Type')}</label>
                                <select
                                    disabled={busy}
                                    value={form.cropType}
                                    onChange={e =>
                                        setForm({
                                            ...form,
                                            cropType: e.target.value
                                        })
                                    }
                                >
                                    <option value="">{t('Select Crop Type')}</option>
                                    <option value="Paddy">{t('Paddy')}</option>
                                    <option value="Maize">{t('Maize')}</option>
                                    <option value="Wheat">{t('Wheat')}</option>
                                    <option value="Barley">{t('Barley')}</option>
                                    <option value="Millets">{t('Millets')}</option>
                                    <option value="Black gram">{t('Black gram')}</option>
                                    <option value="Sugarcane">{t('Sugarcane')}</option>
                                    <option value="Cotton">{t('Cotton')}</option>
                                    <option value="Oats">{t('Oats')}</option>
                                    <option value="Rye">{t('Rye')}</option>
                                    <option value="Soybeans">{t('Soybeans')}</option>
                                    <option value="Groundnuts">{t('Groundnuts')}</option>
                                    <option value="Mustard">{t('Mustard')}</option>
                                    <option value="Sunflower">{t('Sunflower')}</option>
                                    <option value="Pulses">{t('Pulses')}</option>
                                    <option value="Chickpeas">{t('Chickpeas')}</option>
                                    <option value="Gurrapudekka">{t('Gurrapudekka')}</option>
                                    <option value="MANGO">{t('MANGO')}</option>
                                    <option value="FRUIT">{t('FRUIT')}</option>
                                </select>
                            </div>
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

                {/* Section 3: Spraying Requirements */}
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

                        {/* <div className="input-group">
                            <label style={{ marginBottom: '0.2rem' }}>{t('Spray Purpose')}</label>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.65rem' }}>
                                {['Pesticides', 'Insecticides', 'Fungicides', 'Herbicides','Micronutrients (e.g., Zinc)','Macronutrients (e.g., Nitrogen)','water body spraying'].map(purpose => {
                                    const isChecked = Array.isArray(form.sprayPurpose) && form.sprayPurpose.includes(purpose);
                                    return (
                                        <label key={purpose} style={{
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
                                                        ? [...current, purpose]
                                                        : current.filter(p => p !== purpose);
                                                    setForm({ ...form, sprayPurpose: newPurposes });
                                                }}
                                            />
                                            {t(purpose)}
                                        </label>
                                    );
                                })}
                            </div>
                        </div> */}
                        <div className="row-group">
                            {/* Spray Purpose */}
                            <div className="input-group">
                                <label style={{ marginBottom: '0.35rem' }}>
                                    {t('Spray Purpose')}
                                </label>

                                <select
                                    className="spray-purpose-select"
                                    value={form.sprayPurpose || ''}
                                    disabled={busy}
                                    onChange={(e) =>
                                        setForm({
                                            ...form,
                                            sprayPurpose: e.target.value
                                        })
                                    }
                                >
                                    <option value="">
                                        {t('Select spray purpose')}
                                    </option>

                                    {sprayPurposes.map((purpose) => (
                                        <option key={purpose} value={purpose}>
                                            {t(purpose)}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Water Body Nearby */}
                            <div className="input-group">
                                <label style={{ marginBottom: '0.35rem' }}>
                                    {t('Is there a water body nearby?')}
                                </label>

                                <div
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        minHeight: '42px',
                                        padding: '0.55rem 1rem',
                                        border: '1px solid var(--border)',
                                        borderRadius: 'var(--radius-sm)',
                                        background: 'var(--surface)',
                                        cursor: busy ? 'not-allowed' : 'pointer'
                                    }}
                                >
                                    <span style={{
                                        fontWeight: 650,
                                        color: 'var(--text-primary)'
                                    }}>
                                        {form.waterBodyNearby ? 'Yes' : 'No'}
                                    </span>

                                    <input
                                        type="checkbox"
                                        disabled={busy}
                                        checked={form.waterBodyNearby}
                                        onChange={(e) =>
                                            setForm({
                                                ...form,
                                                waterBodyNearby: e.target.checked
                                            })
                                        }
                                        style={{
                                            width: '22px',
                                            height: '22px',
                                            margin: 0,
                                            cursor: 'pointer'
                                        }}
                                    />
                                </div>
                            </div>
                        </div>

                    </div>
                </div>

                {/* Request Type */}
                <div
                    style={{
                        background: 'var(--surface-raised)',
                        padding: '1.25rem',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--border)',
                        marginBottom: '1.25rem',
                        boxShadow: 'var(--shadow-sm)'
                    }}
                >
                    {/* Card Header */}
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            marginBottom: '1.1rem',
                            borderBottom: '1px solid var(--border)',
                            paddingBottom: '0.6rem'
                        }}
                    >
                        <OpsIcon
                            name="document"
                            size={20}
                            style={{ color: 'var(--primary)' }}
                        />

                        <h3
                            style={{
                                margin: 0,
                                color: 'var(--text-primary)',
                                fontSize: '1.15rem',
                                fontWeight: 750
                            }}
                        >
                            Request Type
                        </h3>
                    </div>

                    {/* Card Content */}
                    <div className="form-stack">
                        <div className="row-group">

                            {/* Request Type */}
                            <div className="input-group">
                                <label>Request Type</label>

                                <select
                                    value={form.requestType || ""}
                                    onChange={(e) => {
                                        const value = e.target.value;

                                        setForm(prev => ({
                                            ...prev,
                                            requestType: value,
                                            subCategory: value === "B2B"
                                                ? prev.subCategory
                                                : ""
                                        }));
                                    }}
                                    disabled={busy}
                                    required
                                >
                                    <option value="">Select Request Type</option>

                                    {REQUEST_TYPE_OPTIONS.map((type) => (
                                        <option key={type} value={type}>
                                            {type}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Sub-category - only for B2B */}
                            {form.requestType === "B2B" && (
                                <div className="input-group">
                                    <label>Sub-category</label>

                                    <select
                                        value={form.subCategory || ""}
                                        onChange={(e) =>
                                            setForm(prev => ({
                                                ...prev,
                                                subCategory: e.target.value
                                            }))
                                        }
                                        disabled={busy}
                                        required
                                    >
                                        <option value="">
                                            Select Sub-category
                                        </option>

                                        {B2B_SUB_CATEGORY_OPTIONS.map((category) => (
                                            <option key={category} value={category}>
                                                {category}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}

                        </div>
                    </div>
                </div>

                {/* Assignment */}
                <div
                    style={{
                        background: 'var(--surface-raised)',
                        padding: '1.25rem',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--border)',
                        marginBottom: '1.25rem',
                        boxShadow: 'var(--shadow-sm)'
                    }}
                >
                    {/* Card Header */}
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            marginBottom: '1.1rem',
                            borderBottom: '1px solid var(--border)',
                            paddingBottom: '0.6rem'
                        }}
                    >
                        <OpsIcon
                            name="user"
                            size={20}
                            style={{ color: 'var(--primary)' }}
                        />

                        <h3
                            style={{
                                margin: 0,
                                color: 'var(--text-primary)',
                                fontSize: '1.15rem',
                                fontWeight: 750
                            }}
                        >
                            Assignment
                        </h3>
                    </div>

                    <div className="form-stack">

                        {/* PILOT */}
                        <div className="row-group">

                            <div className="input-group">
                                <label>Pilot</label>

                                <select
                                    value={form.pilotId || ""}
                                    disabled={busy}
                                    required
                                    onChange={(e) => {
                                        const pilotId = e.target.value;

                                        const selectedPilot = pilots.find(
                                            (pilot) => String(pilot.id) === String(pilotId)
                                        );

                                        setForm(prev => ({
                                            ...prev,
                                            pilotId,
                                            pilotName: selectedPilot?.name || "",

                                            // Automatically use existing assignment
                                            pilotAssignedDroneId:
                                                selectedPilot?.droneId || "",

                                            pilotAssignedVehicleId:
                                                selectedPilot?.vehicleId || ""
                                        }));
                                    }}
                                >
                                    <option value="">Select Pilot</option>

                                    {pilots.map((pilot) => (
                                        <option key={pilot.id} value={pilot.id}>
                                            {pilot.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Pilot Drone */}
                            <div className="input-group">
                                <label>
                                    Drone
                                    {form.pilotAssignedDroneId && (
                                        <span
                                            style={{
                                                marginLeft: '0.5rem',
                                                fontSize: '0.75rem',
                                                color: 'var(--primary)'
                                            }}
                                        >
                                            Auto Assigned
                                        </span>
                                    )}
                                </label>

                                <select
                                    value={form.pilotAssignedDroneId || ""}
                                    disabled={busy || Boolean(form.pilotAssignedDroneId)}
                                    required
                                    onChange={(e) =>
                                        setForm(prev => ({
                                            ...prev,
                                            pilotAssignedDroneId: e.target.value
                                        }))
                                    }
                                >
                                    <option value="">Select Drone</option>

                                    {drones.map((drone) => (
                                        <option key={drone.id} value={drone.id}>
                                            {drone.serialNumber}
                                        </option>
                                    ))}
                                </select>
                            </div>

                        </div>

                        {/* Pilot Vehicle */}
                        <div className="row-group">

                            <div className="input-group">
                                <label>
                                    Vehicle
                                    {form.pilotAssignedVehicleId && (
                                        <span
                                            style={{
                                                marginLeft: '0.5rem',
                                                fontSize: '0.75rem',
                                                color: 'var(--primary)'
                                            }}
                                        >
                                            Auto Assigned
                                        </span>
                                    )}
                                </label>

                                <select
                                    value={form.pilotAssignedVehicleId || ""}
                                    disabled={busy || Boolean(form.pilotAssignedVehicleId)}
                                    required
                                    onChange={(e) =>
                                        setForm(prev => ({
                                            ...prev,
                                            pilotAssignedVehicleId: e.target.value
                                        }))
                                    }
                                >
                                    <option value="">Select Vehicle</option>

                                    {vehicles.map((vehicle) => (
                                        <option key={vehicle.id} value={vehicle.id}>
                                            {vehicle.registrationNumber || vehicle.vehicleNumber}
                                        </option>
                                    ))}
                                </select>
                            </div>

                        </div>


                        {/* COPILOT */}
                        <div
                            style={{
                                marginTop: '1rem',
                                paddingTop: '1rem',
                                borderTop: '1px solid var(--border)'
                            }}
                        >
                            <h4
                                style={{
                                    margin: '0 0 0.8rem',
                                    color: 'var(--text-primary)',
                                    fontSize: '1rem',
                                    fontWeight: 700
                                }}
                            >
                                Copilot
                            </h4>

                            <div className="row-group">

                                {/* Copilot */}
                                <div className="input-group">
                                    <label>Copilot</label>

                                    <select
                                        value={form.copilotId || ""}
                                        disabled={busy}
                                        onChange={(e) => {
                                            const copilotId = e.target.value;

                                            const selectedCopilot = pilots.find(
                                                (pilot) =>
                                                    String(pilot.id) === String(copilotId)
                                            );

                                            setForm(prev => ({
                                                ...prev,
                                                copilotId,
                                                copilotName: selectedCopilot?.name || "",

                                                copilotAssignedDroneId:
                                                    selectedCopilot?.droneId || "",

                                                copilotAssignedVehicleId:
                                                    selectedCopilot?.vehicleId || ""
                                            }));
                                        }}
                                    >
                                        <option value="">Select Copilot</option>

                                        {pilots
                                            .filter(
                                                (pilot) =>
                                                    String(pilot.id) !==
                                                    String(form.pilotId)
                                            )
                                            .map((pilot) => (
                                                <option key={pilot.id} value={pilot.id}>
                                                    {pilot.name}
                                                </option>
                                            ))}
                                    </select>
                                </div>

                                {/* Copilot Drone */}
                                <div className="input-group">
                                    <label>
                                        Drone
                                        {form.copilotAssignedDroneId && (
                                            <span
                                                style={{
                                                    marginLeft: '0.5rem',
                                                    fontSize: '0.75rem',
                                                    color: 'var(--primary)'
                                                }}
                                            >
                                                Auto Assigned
                                            </span>
                                        )}
                                    </label>

                                    <select
                                        value={form.copilotAssignedDroneId || ""}
                                        disabled={
                                            busy ||
                                            Boolean(form.copilotAssignedDroneId)
                                        }
                                        onChange={(e) =>
                                            setForm(prev => ({
                                                ...prev,
                                                copilotAssignedDroneId: e.target.value
                                            }))
                                        }
                                    >
                                        <option value="">Select Drone</option>

                                        {drones.map((drone) => (
                                            <option key={drone.id} value={drone.id}>
                                                {drone.serialNumber}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                            </div>

                            {/* Copilot Vehicle */}
                            <div
                                className="row-group"
                                style={{ marginTop: '0.75rem' }}
                            >
                                <div className="input-group">
                                    <label>
                                        Vehicle
                                        {form.copilotAssignedVehicleId && (
                                            <span
                                                style={{
                                                    marginLeft: '0.5rem',
                                                    fontSize: '0.75rem',
                                                    color: 'var(--primary)'
                                                }}
                                            >
                                                Auto Assigned
                                            </span>
                                        )}
                                    </label>

                                    <select
                                        value={form.copilotAssignedVehicleId || ""}
                                        disabled={
                                            busy ||
                                            Boolean(form.copilotAssignedVehicleId)
                                        }
                                        onChange={(e) =>
                                            setForm(prev => ({
                                                ...prev,
                                                copilotAssignedVehicleId: e.target.value
                                            }))
                                        }
                                    >
                                        <option value="">Select Vehicle</option>

                                        {vehicles.map((vehicle) => (
                                            <option key={vehicle.id} value={vehicle.id}>
                                                {vehicle.registrationNumber ||
                                                    vehicle.vehicleNumber}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>

                    </div>
                </div>

                {/* Section 4: Location */}
                <div style={{ background: 'var(--surface-raised)', padding: '1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', marginBottom: '1.25rem', boxShadow: 'var(--shadow-sm)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.6rem' }}>
                        <OpsIcon name="location" size={20} style={{ color: 'var(--primary)' }} />
                        <h3 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1.15rem', fontWeight: 750 }}>{t('Location')}</h3>
                    </div>
                    <div className="form-stack">
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

                        <div className="row-group">
                            <div className="input-group">
                                <label>Cluster</label>
                                <select
                                    value={form.cluster || ""}
                                    onChange={(e) =>
                                        setForm({
                                            ...form,
                                            cluster: e.target.value
                                        })
                                    }
                                    disabled={busy}
                                    required
                                >
                                    <option value="">Select Cluster</option>
                                    {clusterOptions.map((c) => (
                                        <option key={c} value={c}>
                                            {c}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="input-group">
                                <label>Cluster Type</label>
                                <select
                                    value={form.clusterType || ""}
                                    onChange={(e) =>
                                        setForm({
                                            ...form,
                                            clusterType: e.target.value
                                        })
                                    }
                                    disabled={busy}
                                    required
                                >
                                    <option value="">Select Type</option>
                                    {clusterTypeOptions.map((type) => (
                                        <option key={type} value={type}>
                                            {type}
                                        </option>
                                    ))}
                                </select>
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

                {/* Lead & Reporting Details */}
                <div
                    style={{
                        background: 'var(--surface-raised)',
                        padding: '1.25rem',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--border)',
                        marginBottom: '1.25rem',
                        boxShadow: 'var(--shadow-sm)'
                    }}
                >
                    {/* Card Header */}
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            marginBottom: '1.1rem',
                            borderBottom: '1px solid var(--border)',
                            paddingBottom: '0.6rem'
                        }}
                    >
                        <OpsIcon
                            name="user"
                            size={20}
                            style={{ color: 'var(--primary)' }}
                        />

                        <h3
                            style={{
                                margin: 0,
                                color: 'var(--text-primary)',
                                fontSize: '1.15rem',
                                fontWeight: 750
                            }}
                        >
                            Lead & Reporting Details
                        </h3>
                    </div>

                    {/* Card Content */}
                    <div className="form-stack">
                        <div className="row-group">

                            {/* Reporting Admin */}
                            <div className="input-group">
                                <label>Reporting Admin</label>

                                <select
                                    value={form.reportingAdmin || ""}
                                    onChange={(e) =>
                                        setForm(prev => ({
                                            ...prev,
                                            reportingAdmin: e.target.value
                                        }))
                                    }
                                    disabled={busy}
                                    required
                                >
                                    <option value="">
                                        Select Reporting Admin
                                    </option>

                                    {REPORTING_ADMIN_OPTIONS.map((admin) => (
                                        <option key={admin} value={admin}>
                                            {admin}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Lead Source */}
                            <div className="input-group">
                                <label>Lead Source</label>

                                <select
                                    value={form.leadSource || ""}
                                    onChange={(e) =>
                                        setForm(prev => ({
                                            ...prev,
                                            leadSource: e.target.value
                                        }))
                                    }
                                    disabled={busy}
                                    required
                                >
                                    <option value="">
                                        Select Lead Source
                                    </option>

                                    {LEAD_SOURCE_OPTIONS.map((source) => (
                                        <option key={source} value={source}>
                                            {source}
                                        </option>
                                    ))}
                                </select>
                            </div>

                        </div>
                    </div>
                </div>
                {/* Section 5: Subscription & Remarks */}
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
        </section >
    )
}

export default FarmDetails;
