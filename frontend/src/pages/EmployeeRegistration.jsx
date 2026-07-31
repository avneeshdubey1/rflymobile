import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import LanguageSelector from "../components/LanguageSelector";
import { API_URL as API } from "../config";

export default function EmployeeRegistration() {
    const navigate = useNavigate();
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);
    const [success, setSuccess] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [centers, setCenters] = useState([]);
    const [form, setForm] = useState({
        name: "",
        email: "",
        phone: "",
        role: "",
        password: "",
        confirmPassword: "",
        homeCenterId: "",
    });

    useEffect(() => {
        let active = true;
        fetch(`${API}/api/centers/all`)
            .then(async (response) => {
                const data = await response.json().catch(() => ({}));
                if (!response.ok || !data.success) throw new Error(data.error || "Failed to load operating centers");
                if (active) setCenters((data.centers || []).filter((center) => center.active));
            })
            .catch((requestError) => { if (active) setError(requestError.message); });
        return () => { active = false; };
    }, []);

    const handleChange = (e) => {
        setForm({
            ...form,
            [e.target.name]: e.target.value
        });
    };

    const passwordsMatch =
        form.confirmPassword === "" || form.password === form.confirmPassword;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        if (form.phone.length !== 10) {
            setError("Mobile number must be exactly 10 digits.");
            return;
        }

        if (form.password !== form.confirmPassword) {
            setError("Passwords do not match");
            return;
        }
        try {
            setBusy(true);
            const response = await fetch(
                `${API}/api/users/add`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        name: form.name,
                        email: form.email,
                        phone: form.phone,
                        role: form.role,
                        password: form.password,
                        homeCenterId: form.role === "PILOT" ? form.homeCenterId : undefined,
                    })
                }
            );
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || data.message || "Registration failed");
            }
            setSuccess("Employee account created successfully. Redirecting to login...");
            setTimeout(() => { navigate("/admin"); }, 1500);
        }
        catch (error) {
            setError(error.message || "Registration failed");
        } finally {
            setBusy(false);
        }
    };

    return (
        <main className="login-container">
            <LanguageSelector
                style={{
                    position: "absolute",
                    top: "1.5rem",
                    right: "1.5rem",
                    zIndex: 50
                }} />
            <section className="login-context">
                <div className="login-context__brand logo">Daas</div>
                <div className="login-context__copy">
                    <p className="hero-kicker">Employee Portal </p>
                    <h1> Manage drone operations efficiently.</h1>
                    <p>
                        Create employee accounts to manage sales,
                        pilots, operations and administration.
                    </p>
                </div>
            </section>
            <section className="login-form-pane">
                <div className="panel login-card">
                    <p className="eyebrow eyebrow--accent"> EMPLOYEE REGISTRATION </p>
                    <h2> Create employee account </h2>
                    <p className="subtitle">
                        Register employee access for Daas platform.
                    </p>

                    {error && (
                        <div className="alert error" role="alert"> {error} </div>
                    )}
                    {success && (
                        <div className="alert success" role="alert"> {success}</div>
                    )}
                    <form className="login-form" onSubmit={handleSubmit}>
                        <div className="employee-grid">
                            {/* <div className="input-group">
                                <label>Full Name</label>
                                <input
                                    name="name"
                                    value={form.name}
                                    onChange={handleChange}
                                    placeholder="Enter full name"
                                    required
                                    disabled={busy} />
                            </div> */}

                            <div className="input-group">
                                <label>Full Name</label>
                                <input
                                    name="name"
                                    value={form.name}
                                    onChange={(e) => {
                                        const value = e.target.value.replace(/[^a-zA-Z\s]/g, "");
                                        setForm({
                                            ...form,
                                            name: value,
                                        });
                                    }}
                                    placeholder="Enter full name"
                                    required
                                    disabled={busy}
                                />
                            </div>
                            <div className="input-group" style={{ marginTop: "10px" }}>
                                <label>Email</label>
                                <input
                                    type="email"
                                    name="email"
                                    value={form.email}
                                    onChange={handleChange}
                                    placeholder="employee@daas.com"
                                    required
                                    disabled={busy} />
                            </div>
                            <div className="input-group" style={{ marginTop: "10px" }}>
                                <label>Mobile Number</label>
                                <input
                                    type="tel"
                                    name="phone"
                                    value={form.phone}
                                    placeholder="9876543210"
                                    maxLength={10}
                                    inputMode="numeric"
                                    onChange={(e) => {
                                        const phone = e.target.value.replace(/\D/g, "").slice(0, 10);
                                        setForm({
                                            ...form,
                                            phone,
                                        });
                                    }}
                                    required
                                    disabled={busy}
                                />
                                {form.phone && form.phone.length !== 10 && (
                                    <small style={{ color: "#dc2626", fontSize: "0.85rem" }}>
                                        Mobile number must be exactly 10 digits.
                                    </small>
                                )}
                            </div>
                            <div className="input-group" style={{ marginTop: "10px" }}>
                                <label>  Role </label>
                                <select
                                    name="role"
                                    value={form.role}
                                    onChange={handleChange}
                                    required
                                    disabled={busy}  >
                                    <option value="">Select Role  </option>
                                    <option value="ADMIN">Admin  </option>
                                    <option value="SALES"> Sales Executive </option>
                                    <option value="FLEET_MANAGER"> Fleet Manager </option>
                                    <option value="PILOT"> Pilot </option>
                                </select>
                            </div>
                            {form.role === "PILOT" && (
                                <div className="input-group" style={{ marginTop: "10px" }}>
                                    <label>Operating Center</label>
                                    <select name="homeCenterId" value={form.homeCenterId} onChange={handleChange} required disabled={busy}>
                                        <option value="">Select active center</option>
                                        {centers.map((center) => <option key={center.id} value={center.id}>{center.name}</option>)}
                                    </select>
                                </div>
                            )}
                            <div className="input-group" style={{ marginTop: "10px" }}>
                                <label> Password  </label>
                                <div style={{ position: "relative" }}>
                                    <input
                                        type={showPassword ? "text" : "password"}
                                        name="password"
                                        value={form.password}
                                        onChange={handleChange}
                                        placeholder="Minimum 12 characters"
                                        minLength="12"
                                        required
                                        disabled={busy}
                                        style={{ paddingRight: "2.5rem", width: "100%" }}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        tabIndex={-1}
                                        style={{
                                            position: "absolute",
                                            right: "0.6rem",
                                            top: "50%",
                                            transform: "translateY(-50%)",
                                            background: "none",
                                            border: "none",
                                            cursor: "pointer",
                                            display: "flex",
                                            alignItems: "center",
                                            color: "#6b7280"
                                        }}
                                    >
                                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                            </div>
                            <div className="input-group" style={{ marginTop: "10px" }}>
                                <label>Confirm Password</label>
                                <div style={{ position: "relative" }}>
                                    <input
                                        type={showConfirmPassword ? "text" : "password"}
                                        name="confirmPassword"
                                        value={form.confirmPassword}
                                        onChange={handleChange}
                                        placeholder="Confirm password"
                                        minLength="12"
                                        required
                                        disabled={busy}
                                        style={{ paddingRight: "2.5rem", width: "100%" }}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                        tabIndex={-1}
                                        style={{
                                            position: "absolute",
                                            right: "0.6rem",
                                            top: "50%",
                                            transform: "translateY(-50%)",
                                            background: "none",
                                            border: "none",
                                            cursor: "pointer",
                                            display: "flex",
                                            alignItems: "center",
                                            color: "#6b7280"
                                        }}
                                    >
                                        {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                                {!passwordsMatch && (
                                    <small style={{ color: "#dc2626", fontSize: "0.85rem" }}>
                                        Passwords do not match.
                                    </small>
                                )}
                            </div>
                        </div>
                        <button
                            className="submit-btn login-submit"
                            disabled={busy || !passwordsMatch} >
                            {
                                busy
                                    ?
                                    "Registering..."
                                    :
                                    "Register Employee"
                            }
                        </button>
                    </form>
                    <div className="login-footer" style={{ marginTop: "12px" }}>
                        <p>
                            Already have an account?
                            {" "}
                            <Link to="/login">
                                Employee Login
                            </Link>
                        </p>
                    </div>
                </div>
            </section>
        </main>
    );
}
