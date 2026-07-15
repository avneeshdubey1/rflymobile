import { useEffect, useState } from "react";
import axios from "axios";

const PilotAssignments = () => {
  const [missions, setMissions] = useState([]);

  
  const pilotId = localStorage.getItem("userId") || "60002";

  useEffect(() => {
    fetchMissions();
  }, []);

  const fetchMissions = async () => {
    try {
      const res = await axios.get(
        `http://localhost:5000/api/assignments/pilot?email=${pilotId}`
      );
      setMissions(res.data.missions);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div style={{ padding: 20 }}>
      <h2>My Assignments</h2>

      <table border="1" cellPadding="10" width="100%">
        <thead>
          <tr>
            <th>Farmer</th>
            <th>Village</th>
            <th>Crop</th>
            <th>Acres</th>
            <th>Drone</th>
            <th>Status</th>
          </tr>
        </thead>

        <tbody>
          {missions.map((m) => (
            <tr key={m.id}>
              <td>{m.farmerName}</td>
              <td>{m.village}</td>
              <td>{m.cropType}</td>
              <td>{m.acres}</td>
              <td>{m.droneId || "-"}</td>
              <td>{m.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default PilotAssignments;