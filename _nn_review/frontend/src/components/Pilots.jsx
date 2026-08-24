import React, { useState } from "react";
import '../style/Pilots.css';

const Pilots = () => {
  const [pilotData, setPilotData] = useState({
    firstName: "",
    middleName: "",
    lastName: "",
    pilotId: "",
    licenseId: "",
    location: "",
    phone: "",
    email: "",
    address: "",
    state: "",
    city: "",
    pincode: "",
    drone: "",
    isActive: true,
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setPilotData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleToggle = () => {
    setPilotData((prev) => ({
      ...prev,
      isActive: !prev.isActive,
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log(pilotData);

    // TODO:
    // POST /api/pilots
  };

  const handleCancel = () => {
    setPilotData({
      firstName: "",
      middleName: "",
      lastName: "",
      pilotId: "",
      licenseId: "",
      location: "",
      phone: "",
      email: "",
      address: "",
      state: "",
      city: "",
      pincode: "",
      drone: "",
      isActive: true,
    });
  };

  return (
    <></>
    // <div className="pilot-page">
    //   <div className="pilot-card">
    //     <div className="pilot-header">
    //       <h2>Add Pilot</h2>
    //       <p>Register a new pilot and assign a drone.</p>
    //     </div>

    //     <form onSubmit={handleSubmit}>
    //       <h3>Pilot Information</h3>
    //       <div className="grid-3">

    //         <div>
    //           <label>First Name *</label>
    //           <input
    //             name="firstName"
    //             value={pilotData.firstName}
    //             onChange={handleChange}
    //             required/>
    //         </div>
    //         {/* <div>
    //           <label>Middle Name</label>
    //           <input
    //             name="middleName"
    //             value={pilotData.middleName}
    //             onChange={handleChange}
    //           />
    //         </div> */}
    //         <div>
    //           <label>Last Name *</label>
    //           <input
    //             name="lastName"
    //             value={pilotData.lastName}
    //             onChange={handleChange}
    //             required/>
    //         </div>
    //       </div>
    //       <div className="grid-2">
    //         <div>
    //           <label>Pilot ID *</label>
    //           <input
    //             name="pilotId"
    //             value={pilotData.pilotId}
    //             onChange={handleChange}
    //             required/>
    //         </div>

    //         <div>
    //           <label>Pilot License ID *</label>
    //           <input
    //             name="licenseId"
    //             value={pilotData.licenseId}
    //             onChange={handleChange}
    //             required />
    //         </div>
    //       </div>

    //       <h3>Contact Information</h3>
    //       <div className="grid-2">
    //         <div>
    //           <label>Phone Number *</label>
    //           <input
    //             type="tel"
    //             placeholder="+91"
    //             name="phone"
    //             value={pilotData.phone}
    //             onChange={handleChange}
    //             required />
    //         </div>

    //         <div>
    //           <label>Email *</label>
    //           <input
    //             type="email"
    //             name="email"
    //             value={pilotData.email}
    //             onChange={handleChange}
    //             required/>
    //         </div>
    //       </div>

    //       <h3>Location Details</h3>
    //       <div className="grid-3">
    //         <div>
    //           <label>Location *</label>
    //           <select
    //             name="location"
    //             value={pilotData.location}
    //             onChange={handleChange}
    //             required>
    //             <option value="">Select</option>
    //           </select>
    //         </div>

    //         <div>
    //           <label>State *</label>
    //           <select
    //             name="state"
    //             value={pilotData.state}
    //             onChange={handleChange}
    //             required>
    //             <option value="">Select</option>
    //           </select>
    //         </div>

    //         <div>
    //           <label>City *</label>
    //           <select
    //             name="city"
    //             value={pilotData.city}
    //             onChange={handleChange}
    //             required>
    //             <option value="">Select</option>
    //           </select>
    //         </div>
    //       </div>

    //       <div className="grid-2">
    //         <div>
    //           <label>Pincode</label>
    //           <input
    //             name="pincode"
    //             value={pilotData.pincode}
    //             onChange={handleChange} />
    //         </div>
    //       </div>
    //       <div>

    //         <label>Address *</label>
    //         <textarea
    //           rows={4}
    //           name="address"
    //           value={pilotData.address}
    //           onChange={handleChange}
    //           required />
    //       </div>
    //       <h3>Assignment</h3>
    //       <div className="grid-2">
    //         <div>
    //           <label>Assign Drone</label>
    //           <select name="drone" value={pilotData.drone} onChange={handleChange} >
    //             <option value="">Select Drone</option>
    //           </select>
    //         </div>

    //         <div>
    //           <label>Status</label>
    //           <div className="status-toggle">
    //             <span>{pilotData.isActive ? "Active" : "Inactive"} </span>
    //             <label className="switch">
    //               <input type="checkbox" checked={pilotData.isActive} onChange={handleToggle} />
    //               <span className="slider"></span>
    //             </label>
    //           </div>
    //         </div>
    //       </div>

    //       <div className="button-group">
    //         <button
    //           type="button" className="cancel-btn" onClick={handleCancel}> Cancel</button>
    //         <button type="submit" className="submit-btn"> Add Pilot </button>
    //       </div>
    //     </form>
    //   </div>
    // </div>
  );
};

export default Pilots;