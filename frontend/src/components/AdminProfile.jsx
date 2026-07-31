import "../style/AdminProfile.css";
import { useState } from "react";

function AdminProfile({ user }) {
  const [isEditing, setIsEditing] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [profile, setProfile] = useState({
    name: user?.name || "",
    email: user?.email || "",
    phone: user?.phone || "",
  });

  const [password, setPassword] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const handleSave = async () => {
    if (!/^\d{10}$/.test(profile.phone)) {
      setErrorMessage("Please enter a valid 10-digit mobile number.");
      return;
    }
    try {
      console.log(profile);
      setSuccessMessage("Profile updated successfully.");
      setErrorMessage("");
      setIsEditing(false);
      setTimeout(() => {
        setSuccessMessage("");
      }, 3000);
    } catch (error) {
      console.error(error);
      setErrorMessage("Failed to update profile. Please try again.");
    }
  };

  const handlePasswordChange = async () => {
    if (password.newPassword !== password.confirmPassword) {
      setErrorMessage("New password and confirm password do not match.");
      return;
    }
    try {
      console.log(password);
      setSuccessMessage("Password updated successfully.");
      setErrorMessage("");
      setShowPassword(false);
      setPassword({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
      setTimeout(() => {
        setSuccessMessage("");
      }, 3000);
    } catch (error) {
      console.error(error);
      setErrorMessage("Failed to update password. Please try again.");
    }
  };
  const isAdmin = user?.role === "ADMIN";

  return (
    <section className="panel panel--raised">
      <div className="panel-header">
        <div>
          <h2>{isAdmin ? "Administrator Profile" : "My Profile"}</h2>

          <p>
            {isAdmin
              ? "Manage your profile, security, and account settings."
              : "Manage your contact details and account security."}
          </p>
          {successMessage && (
            <div className="success-message">
              {successMessage}
            </div>
          )}

          {errorMessage && (
            <div className="error-message">
              {errorMessage}
            </div>
          )}
        </div>

        <button
          className="btn btn-primary"
          onClick={() => setIsEditing(!isEditing)}
        >
          {isEditing ? "Cancel" : "Edit Profile"}
        </button>
      </div>

      {/* Contact Details */}
      <div className="profile-card">
        <h3>Contact Details</h3>

        <div className="profile-grid">
          <div>
            <label>Full Name</label>
            {isEditing ? (
              <input
                type="text"
                value={profile.name}
                onChange={(e) =>
                  setProfile({ ...profile, name: e.target.value })
                }
              />
            ) : (
              <p>{profile.name}</p>
            )}
          </div>

          <div>
            <label>Email Address</label>
            {isEditing ? (
              <input
                type="email"
                value={profile.email}
                onChange={(e) =>
                  setProfile({ ...profile, email: e.target.value })
                }
              />
            ) : (
              <p>{profile.email}</p>
            )}
          </div>

          <div>
            <label>Mobile Number</label>
            {isEditing ? (
              <>
                <input
                  type="tel"
                  value={profile.phone}
                  maxLength={10}
                  placeholder="Enter 10-digit mobile number"
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, "").slice(0, 10);

                    setProfile({
                      ...profile,
                      phone: value,
                    });

                    setErrorMessage("");
                  }}
                />

                {errorMessage && (
                  <small className="error-text">{errorMessage}</small>
                )}
              </>
            ) : (
              <p>{profile.phone || "-"}</p>
            )}
          </div>

          {isEditing && (
            <button className="btn btn-success" onClick={handleSave}>
              Save Changes
            </button>
          )}

          <div>
            <label>Role</label>
            <p>{user?.role || "Administrator"}</p>
          </div>

          {/* <div>
            <label>Employee ID</label>
            <p>{user?.employeeId || "-"}</p>
          </div> */}
        </div>
      </div>

      {/* Security */}
      <div className="profile-card">
        <div className="section-header">
          <h3>Security</h3>
          <button
            className="btn btn-outline"
            onClick={() => setShowPassword(!showPassword)}
          >
            {showPassword ? "Cancel" : "Change Password"}
          </button>
        </div>

        {showPassword && (
          <div className="password-form">
            <input
              type="password"
              placeholder="Current Password"
              value={password.currentPassword}
              onChange={(e) =>
                setPassword({
                  ...password,
                  currentPassword: e.target.value,
                })
              }
            />
            <input
              type="password"
              placeholder="New Password"
              value={password.newPassword}
              onChange={(e) =>
                setPassword({
                  ...password,
                  newPassword: e.target.value,
                })
              }
            />

            <input
              type="password"
              placeholder="Confirm Password"
              value={password.confirmPassword}
              onChange={(e) =>
                setPassword({
                  ...password,
                  confirmPassword: e.target.value,
                })
              }
            />

            <button
              className="btn btn-primary"
              onClick={handlePasswordChange}
            >
              Update Password
            </button>
          </div>
        )}

        <div className="profile-grid">
          <div>
            <label>Last Password Change</label>
            <p>{user?.passwordUpdatedAt || "-"}</p>
          </div>
        </div>
      </div>

      {/* Account Information */}
      <div className="profile-card">
        <h3>Account Information</h3>

        <div className="profile-grid">
          <div>
            <label>Account Status</label>
            <span className="status-badge status-active">
              Active
            </span>
          </div>

          <div>
            <label>Member Since</label>
            <p>{user?.createdAt || "-"}</p>
          </div>

          <div>
            <label>Last Login</label>
            <p>{user?.lastLogin || "-"}</p>
          </div>
        </div>
      </div>
    </section>
  );
}

export default AdminProfile;