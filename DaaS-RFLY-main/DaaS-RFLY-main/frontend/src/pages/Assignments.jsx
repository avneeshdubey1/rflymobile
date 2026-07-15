import { useEffect, useState } from "react";
import axios from "axios";

const Assignments = () => {
  const [assignments, setAssignments] = useState([]);

  useEffect(() => {
    fetchAssignments();
  }, []);

  const fetchAssignments = async () => {
    try {
      const res = await axios.get(
        "http://localhost:5000/api/assignments/all"
      );
      setAssignments(res.data.missions);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div style={{ padding: "20px" }}>
      <h2>Pilot Assignments</h2>

      <table border="1" cellPadding="10" width="100%">
        <thead>
          <tr>
            <th>Farmer</th>
            <th>Village</th>
            <th>Crop</th>
            <th>Acres</th>
            <th>Pilot</th>
            <th>Drone</th>
            <th>Status</th>
            <th>Created</th>
          </tr>
        </thead>

        <tbody>
          {assignments.map((a) => (
            <tr key={a.id}>
              <td>{a.farmerName}</td>
              <td>{a.village}</td>
              <td>{a.cropType}</td>
              <td>{a.acres}</td>
              <td>{a.pilotEmail}</td>
              <td>{a.droneId}</td>
              <td>{a.status}</td>
              <td>{new Date(a.createdAt).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default Assignments;