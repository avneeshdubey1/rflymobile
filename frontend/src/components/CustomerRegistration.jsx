import { useState, useEffect } from "react";
import OpsIcon from "./OpsIcon";
import '../style/CustomerRegistration.css';
import { csrfHeaders } from '../utils/csrf';

const initialFarmerData = {
    name: "",
    phone: "",
    ownership: "",
    totalAcres: "",
    village: "",
    mandal: "",
    district: "",
    state: "",
    kharifCrop: "",
    kharifOtherCrop: "",
    kharifAcres: "",
    kharifTanks: "",
    kharifSprayings: "",
    rabiCrop: "",
    rabiOtherCrop: "",
    rabiAcres: "",
    rabiTanks: "",
    rabiSprayings: "",
    summerCrop: "",
    summerOtherCrop: "",
    summerAcres: "",
    summerTanks: "",
    subscriptionCardNumber: "",
    subscriptionYear: "2026-27",
    remarks: "",
    clusterId: "",
};

const cropOptions = [
    "Paddy",
    "Black gram",
    "Maize",
    "Green gram",
    "Red gram",
    "Cotton",
    "Chilly",
    "Sugar cane",
    "Jowar",
    "Bengal gram",
    "Ground nut",
    "Tobacco",
    "Others",
];

const summerOptions = [
    "Sugar Cane",
    "Paddy",
    "Others",
];

const ownershipOptions = ["Owner", "Tenant"];

// Add next year here when the new subscription cycle opens
const subscriptionYearOptions = ["2026-27", "2027-28"];

function CustomerRegistration({ API, user, confirmModal, setConfirmModal }) {
    const [farmerData, setFarmerData] = useState(initialFarmerData);
    const [farmerNotice, setFarmerNotice] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [clusters, setClusters] = useState([]);

    useEffect(() => {
        fetch(`${API}/api/master-data/choices`, { credentials: 'include' })
            .then(async (response) => {
                const body = await response.json();
                if (!response.ok) throw new Error(body.error || 'Failed to load clusters');
                setClusters(body.data.clusters || []);
            })
            .catch((error) => setFarmerNotice({ type: 'error', message: error.message }));
    }, [API]);

    useEffect(() => {
        if (!farmerNotice) return;
        const timer = setTimeout(() => {
            setFarmerNotice(null);
        }, 4500);
        return () => clearTimeout(timer);
    }, [farmerNotice]);

    const handleChange = (field) => (e) => {
        setFarmerData((prev) => ({ ...prev, [field]: e.target.value }));
    };

    const handleFarmerRegistration = async (e, confirmed = false) => {
        if (e) e.preventDefault();
        setSubmitting(true);
        try {
            const payload = {
                ...farmerData,
                displayName: farmerData.name,
                ownership: farmerData.ownership.toUpperCase(),
            };
            const response = await fetch(`${API}/api/customers/sales`, {
                method: "POST",
                headers: { "Content-Type": "application/json", ...csrfHeaders() },
                credentials: 'include',
                body: JSON.stringify(payload),
            });
            const data = await response.json();

            if (!response.ok) {
                if (data.needsConfirmation) {
                    setConfirmModal({
                        message: data.message,
                        onConfirm: () => {
                            setConfirmModal(null);
                            handleFarmerRegistration(undefined, true);
                        },
                    });
                    return;
                }
                setFarmerNotice({
                    type: "error",
                    message: data.error || data.message || "Customer registration could not be completed.",
                });
                return;
            }

            setFarmerNotice({ type: "success", message: "Customer registered successfully!" });
            setFarmerData(initialFarmerData);
        } catch (error) {
            console.error(error);
            setFarmerNotice({ type: "error", message: "An unexpected error occurred. Please try again." });
        } finally {
            setSubmitting(false);
        }
    };

    const renderCropSection = (season, options, includeSprayings = true) => {
        const cropKey = `${season}Crop`;
        const otherKey = `${season}OtherCrop`;
        const acresKey = `${season}Acres`;
        const tanksKey = `${season}Tanks`;
        const sprayingsKey = `${season}Sprayings`;
        const label = season.charAt(0).toUpperCase() + season.slice(1);

        // return (
        //   <div className="form-section">
        //     <h3>{label}</h3>

        //     <div className="form-group">
        //       <label htmlFor={cropKey}>{label} Crop</label>
        //       <select
        //         id={cropKey}
        //         value={farmerData[cropKey]}
        //         onChange={handleChange(cropKey)}
        //       >
        //         <option value="">Select crop</option>
        //         {options.map((crop) => (
        //           <option key={crop} value={crop}>
        //             {crop}
        //           </option>
        //         ))}
        //       </select>
        //     </div>

        //     {farmerData[cropKey] === "Others" && (
        //       <div className="form-group">
        //         <label htmlFor={otherKey}>Specify Crop</label>
        //         <input
        //           id={otherKey}
        //           type="text"
        //           value={farmerData[otherKey]}
        //           onChange={handleChange(otherKey)}
        //           placeholder="Enter crop name"
        //         />
        //       </div>
        //     )}

        //     <div className="form-group">
        //       <label htmlFor={acresKey}>{label} Acres</label>
        //       <input
        //         id={acresKey}
        //         type="number"
        //         min="0"
        //         step="0.01"
        //         value={farmerData[acresKey]}
        //         onChange={handleChange(acresKey)}
        //       />
        //     </div>

        //     <div className="form-group">
        //       <label htmlFor={tanksKey}>{label} Tanks</label>
        //       <input
        //         id={tanksKey}
        //         type="number"
        //         min="0"
        //         step="0.01"
        //         value={farmerData[tanksKey]}
        //         onChange={handleChange(tanksKey)}
        //       />
        //     </div>

        //     {includeSprayings && (
        //       <div className="form-group">
        //         <label htmlFor={sprayingsKey}>{label} Sprayings</label>
        //         <input
        //           id={sprayingsKey}
        //           type="number"
        //           min="0"
        //           step="1"
        //           value={farmerData[sprayingsKey]}
        //           onChange={handleChange(sprayingsKey)}
        //         />
        //       </div>
        //     )}
        //   </div>
        // );

        return (
            <div className="crop-card">
                <h4 className="crop-title">
                    {label}
                </h4>

                <div className="form-stack">

                    <div className="row-group">

                        <div className="input-group">
                            <label>{label} Crop</label>

                            <select
                                value={farmerData[cropKey]}
                                onChange={handleChange(cropKey)}
                            >
                                <option value="">Select Crop</option>

                                {options.map((crop) => (
                                    <option key={crop} value={crop}>
                                        {crop}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {farmerData[cropKey] === "Others" && (
                            <div className="input-group">
                                <label>Specify Crop</label>

                                <input
                                    type="text"
                                    value={farmerData[otherKey]}
                                    onChange={handleChange(otherKey)}
                                    placeholder="Enter crop name"
                                />
                            </div>
                        )}

                    </div>

                    <div className="row-group">

                        <div className="input-group">
                            <label>{label} Acres</label>

                            <input
                                type="number"
                                min="0"
                                step="0.1"
                                value={farmerData[acresKey]}
                                onChange={handleChange(acresKey)}
                                placeholder="e.g. 2.5"
                            />
                        </div>

                        <div className="input-group">
                            <label>{label} Tanks</label>

                            <input
                                type="number"
                                min="0"
                                step="0.1"
                                value={farmerData[tanksKey]}
                                onChange={handleChange(tanksKey)}
                                placeholder="e.g. 10"
                            />
                        </div>

                        {includeSprayings && (
                            <div className="input-group">
                                <label>{label} Sprayings</label>

                                <input
                                    type="number"
                                    min="0"
                                    step="1"
                                    value={farmerData[sprayingsKey]}
                                    onChange={handleChange(sprayingsKey)}
                                    placeholder="Number of sprayings"
                                />
                            </div>
                        )}

                    </div>

                </div>
            </div>
        );

    };

    return (
        <>
            <section className="panel panel--raised">
                <div className="panel-header">
                    <div className="panel-header__title">
                        <div className="panel-title-row">
                            <span className="panel-title-icon">
                                <OpsIcon name="user-plus" />
                            </span>
                            <h2>Customer Registration</h2>
                        </div>
                        <p>Register a new customer</p>
                    </div>
                </div>

                <div className="panel-body">
                    {farmerNotice && (
                        <div
                            style={{
                                marginBottom: "15px",
                                padding: "12px",
                                borderRadius: "8px",
                                backgroundColor:
                                    farmerNotice.type === "success"
                                        ? "#d4edda"
                                        : "#f8d7da",
                                color:
                                    farmerNotice.type === "success"
                                        ? "#155724"
                                        : "#721c24",
                                fontWeight: "600",
                                textAlign: "center",
                            }}
                        >
                            {farmerNotice.message}
                        </div>
                    )}

                    <form
                        onSubmit={(e) => handleFarmerRegistration(e, false)}
                        className="form-stack"
                    >
                        {/* Basic Details */}
                        <div
                            style={{
                                background: "var(--surface-raised)",
                                padding: "1.25rem",
                                borderRadius: "var(--radius-md)",
                                border: "1px solid var(--border)",
                                marginBottom: "1.25rem",
                                boxShadow: "var(--shadow-sm)",
                            }}
                        >
                            <div
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "0.5rem",
                                    marginBottom: "1.1rem",
                                    borderBottom: "1px solid var(--border)",
                                    paddingBottom: "0.6rem",
                                }}
                            >
                                <OpsIcon
                                    name="user-plus"
                                    size={20}
                                    style={{ color: "var(--primary)" }}
                                />

                                <h3
                                    style={{
                                        margin: 0,
                                        color: "var(--text-primary)",
                                        fontSize: "1.15rem",
                                        fontWeight: 750,
                                    }}
                                >
                                    Basic Details
                                </h3>
                            </div>

                            <div className="form-stack">
                                <div className="row-group">
                                    <div className="input-group">
                                        <label>Full Name</label>
                                        <input
                                            type="text"
                                            placeholder="Enter full name"
                                            value={farmerData.name}
                                            onChange={(e) => {
                                                const value = e.target.value;
                                                if (/^[A-Za-z\s]*$/.test(value)) {
                                                    setFarmerData({
                                                        ...farmerData,
                                                        name: value,
                                                    });
                                                }
                                            }}
                                            required
                                        />
                                    </div>

                                    <div className="input-group">
                                        <label>Mobile Number</label>
                                        <input
                                            type="tel"
                                            placeholder="Enter mobile number"
                                            value={farmerData.phone}
                                            onChange={(e) => {
                                                const value = e.target.value
                                                    .replace(/\D/g, "")
                                                    .slice(0, 10);

                                                setFarmerData({
                                                    ...farmerData,
                                                    phone: value,
                                                });
                                            }}
                                            maxLength={10}
                                            pattern="[0-9]{10}"
                                            inputMode="numeric"
                                            required
                                        />

                                        {farmerData.phone &&
                                            farmerData.phone.length !== 10 && (
                                                <small style={{ color: "red" }}>
                                                    Mobile number must be exactly 10 digits.
                                                </small>
                                            )}
                                    </div>
                                </div>

                                <div className="row-group">
                                    <div className="input-group">
                                        <label>Farmer Ownership</label>
                                        <select
                                            value={farmerData.ownership}
                                            onChange={handleChange("ownership")}
                                            required
                                        >
                                            <option value="">Select Ownership</option>

                                            {ownershipOptions.map((option) => (
                                                <option key={option} value={option}>
                                                    {option}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="input-group">
                                        <label>Total Acres</label>
                                        <input
                                            type="number"
                                            min="0"
                                            step="0.1"
                                            placeholder="Enter total acres"
                                            value={farmerData.totalAcres}
                                            onChange={handleChange("totalAcres")}
                                            required
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Kharif */}
                        {/* Seasonal Crop Details */}
                        <div
                            style={{
                                background: "var(--surface-raised)",
                                padding: "1.25rem",
                                borderRadius: "var(--radius-md)",
                                border: "1px solid var(--border)",
                                marginBottom: "1.25rem",
                                boxShadow: "var(--shadow-sm)",
                            }}
                        >
                            <div
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "0.5rem",
                                    marginBottom: "1.1rem",
                                    borderBottom: "1px solid var(--border)",
                                    paddingBottom: "0.6rem",
                                }}
                            >
                                <OpsIcon
                                    name="leaf"
                                    size={20}
                                    style={{ color: "var(--primary)" }}
                                />

                                <h3
                                    style={{
                                        margin: 0,
                                        color: "var(--text-primary)",
                                        fontSize: "1.15rem",
                                        fontWeight: 750,
                                    }}
                                >
                                    Seasonal Crop Details
                                </h3>
                            </div>

                            <div className="form-stack">

                                {/* Kharif */}
                                {renderCropSection("kharif", cropOptions)}

                                {/* Rabi */}
                                {renderCropSection("rabi", cropOptions)}

                                {/* Summer */}
                                {renderCropSection("summer", summerOptions, true)}

                            </div>
                        </div>
                        {/* Location */}
                        {/* Location Details */}
                        <div
                            style={{
                                background: "var(--surface-raised)",
                                padding: "1.25rem",
                                borderRadius: "var(--radius-md)",
                                border: "1px solid var(--border)",
                                marginBottom: "1.25rem",
                                boxShadow: "var(--shadow-sm)",
                            }}
                        >
                            <div
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "0.5rem",
                                    marginBottom: "1.1rem",
                                    borderBottom: "1px solid var(--border)",
                                    paddingBottom: "0.6rem",
                                }}
                            >
                                <OpsIcon
                                    name="location"
                                    size={20}
                                    style={{ color: "var(--primary)" }}
                                />

                                <h3
                                    style={{
                                        margin: 0,
                                        color: "var(--text-primary)",
                                        fontSize: "1.15rem",
                                        fontWeight: 750,
                                    }}
                                >
                                    Location Details
                                </h3>
                            </div>

                            <div className="form-stack">

                                <div className="row-group">
                                    <div className="input-group">
                                        <label>Cluster</label>
                                        <select value={farmerData.clusterId} onChange={handleChange("clusterId")} required>
                                            <option value="">Select cluster</option>
                                            {clusters.map(cluster => <option key={cluster.id} value={cluster.id}>{cluster.displayName}</option>)}
                                        </select>
                                    </div>
                                    <div className="input-group">
                                        <label>Cluster Type</label>
                                        <input value={clusters.find(cluster => cluster.id === farmerData.clusterId)?.type || ''} readOnly placeholder="Derived from cluster" />
                                    </div>
                                </div>

                                <div className="row-group">
                                    <div className="input-group">
                                        <label>Village Name</label>
                                        <input
                                            type="text"
                                            placeholder="Enter village"
                                            value={farmerData.village}
                                            onChange={handleChange("village")}
                                            required
                                        />
                                    </div>

                                    <div className="input-group">
                                        <label>Mandal</label>
                                        <input
                                            type="text"
                                            placeholder="Enter mandal"
                                            value={farmerData.mandal}
                                            onChange={handleChange("mandal")}
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="row-group">
                                    <div className="input-group">
                                        <label>District</label>
                                        <input
                                            type="text"
                                            placeholder="Enter district"
                                            value={farmerData.district}
                                            onChange={handleChange("district")}
                                            required
                                        />
                                    </div>

                                    <div className="input-group">
                                        <label>State</label>
                                        <input
                                            type="text"
                                            placeholder="Enter state"
                                            value={farmerData.state}
                                            onChange={handleChange("state")}
                                            required
                                        />
                                    </div>
                                </div>

                            </div>
                        </div>

                        {/* Subscription */}
                        {/* Subscription & Remarks */}
                        <div
                            style={{
                                background: "var(--surface-raised)",
                                padding: "1.25rem",
                                borderRadius: "var(--radius-md)",
                                border: "1px solid var(--border)",
                                marginBottom: "1.5rem",
                                boxShadow: "var(--shadow-sm)",
                            }}
                        >
                            <div
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "0.5rem",
                                    marginBottom: "1.1rem",
                                    borderBottom: "1px solid var(--border)",
                                    paddingBottom: "0.6rem",
                                }}
                            >
                                <OpsIcon
                                    name="plus"
                                    size={20}
                                    style={{ color: "var(--primary)" }}
                                />

                                <h3
                                    style={{
                                        margin: 0,
                                        color: "var(--text-primary)",
                                        fontSize: "1.15rem",
                                        fontWeight: 750,
                                    }}
                                >
                                    Subscription & Remarks
                                </h3>
                            </div>

                            <div className="form-stack">

                                <div className="row-group">

                                    <div className="input-group">
                                        <label>
                                            Subscription Card Number
                                            <span className="optional"> (Optional)</span>
                                        </label>

                                        <input
                                            type="text"
                                            placeholder="Enter card number"
                                            value={farmerData.subscriptionCardNumber}
                                            onChange={handleChange("subscriptionCardNumber")}
                                        />
                                    </div>

                                    <div className="input-group">
                                        <label>Subscription Year</label>

                                        <select
                                            value={farmerData.subscriptionYear}
                                            onChange={handleChange("subscriptionYear")}
                                        >
                                            {subscriptionYearOptions.map((year) => (
                                                <option key={year} value={year}>
                                                    {year}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                </div>

                                <div className="input-group">
                                    <label>Description / Remarks</label>

                                    <textarea
                                        rows="4"
                                        placeholder="Enter remarks..."
                                        value={farmerData.remarks}
                                        onChange={handleChange("remarks")}
                                        style={{
                                            resize: "vertical",
                                            width: "100%",
                                        }}
                                    />
                                </div>

                            </div>
                        </div>

                        <div className="form-actions">
                            <button
                                type="submit"
                                className="submit-btn"
                                disabled={submitting}
                            >
                                {submitting ? "Registering..." : "Register Customer"}
                            </button>
                        </div>
                    </form>
                </div>
            </section>
            {confirmModal && (
                <div
                    style={{
                        position: "fixed",
                        inset: 0,
                        backgroundColor: "rgba(0, 0, 0, 0.45)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        zIndex: 1000,
                    }}
                >
                    <div
                        style={{
                            background: "#fff",
                            borderRadius: "10px",
                            padding: "24px",
                            maxWidth: "400px",
                            width: "90%",
                            boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
                        }}
                    >
                        <h3 style={{ margin: "0 0 12px", fontSize: "16px", fontWeight: 600 }}>
                            Confirm Registration
                        </h3>
                        <p style={{ margin: "0 0 20px", color: "#444", fontSize: "14px", lineHeight: 1.5 }}>
                            {confirmModal.message}
                        </p>
                        <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                            <button
                                onClick={() => setConfirmModal(null)}
                                style={{
                                    padding: "8px 16px",
                                    borderRadius: "6px",
                                    border: "1px solid #ccc",
                                    background: "#fff",
                                    cursor: "pointer",
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmModal.onConfirm}
                                style={{
                                    padding: "8px 16px",
                                    borderRadius: "6px",
                                    border: "none",
                                    background: "#2f6feb",
                                    color: "#fff",
                                    cursor: "pointer",
                                    fontWeight: 600,
                                }}
                            >
                                Confirm
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

export default CustomerRegistration;
