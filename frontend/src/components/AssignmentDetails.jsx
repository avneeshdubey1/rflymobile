import React, { useEffect, useState } from "react";
import axios from "axios";
// import "./AssignmentDetails.css";
import "../style/AssignmentDetails.css";
import { SkeletonRow } from '../components/Skeleton';
import { API_URL } from '../config';

const AssignmentDetails = () => {
    const [assignments, setAssignments] = useState([]);
    const [currentPage, setCurrentPage] = useState(1);
    const [loading, setLoading] = useState(true);

    const rowsPerPage = 5;

    const indexOfLastRow = currentPage * rowsPerPage;
    const indexOfFirstRow = indexOfLastRow - rowsPerPage;

    const currentAssignments = assignments.slice(
        indexOfFirstRow,
        indexOfLastRow
    );

    const totalPages = Math.ceil(assignments.length / rowsPerPage);
    useEffect(() => {
        fetchAssignments();
    }, []);

    const fetchAssignments = async () => {
        setLoading(true);
        try {
            const response = await axios.get(
                `${API_URL}/api/assignments/all`,
                {
                    withCredentials: true
                }
            );
            console.log("ASSIGNMENT RESPONSE:", response.data);
            setAssignments(response.data.missions || response.data.assignments || []);
        } catch (error) {
            console.error(
                "Failed to fetch assignments",
                error.response?.data || error
            );
        } finally {
            setLoading(false);
        }
    };


    return (
        <div className="assignment-container">
            <h2>Spraying Assignments</h2>
            <table>
                <thead>
                    <tr>
                        <th>Customer</th>
                        <th>Date</th>
                        <th>Time</th>
                        <th>Pilot</th>
                        <th>Co-Pilot</th>
                        <th>Drone</th>
                        <th>LMV</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    {loading ? (
                        // Show a handful of skeleton rows while data loads
                        Array.from({ length: rowsPerPage }).map((_, index) => (
                            <SkeletonRow key={`skeleton-${index}`} columns={7} />
                        ))
                    ) : assignments.length > 0 ? (
                        currentAssignments.map((item) => (
                            <tr key={item.id}>
                                {/* Farmer Name */}
                                <td>
                                    {item.lead?.farmerName || "Unknown"}
                                </td>
                                {/* Scheduled Date */}
                                <td>
                                    {
                                        item.scheduledDate
                                            ?
                                            new Date(item.scheduledDate)
                                                .toLocaleDateString()
                                            :
                                            "No Date"
                                    }
                                </td>
                                {/* Time */}
                                <td>
                                    {
                                        item.scheduledDate
                                            ?
                                            new Date(item.scheduledDate)
                                                .toLocaleTimeString()
                                            :
                                            "-"
                                    }
                                </td>

                                {/* Pilot */}
                                <td>
                                    {item.pilot?.name || "Not Assigned"}
                                </td>

                                {/* Co Pilot */}
                                <td>
                                    {
                                        item.copilot?.name || "Not Assigned"
                                    }
                                </td>


                                {/* Shared crew drone */}
                                <td>
                                    {
                                        item.drone
                                            ?
                                            <>
                                                {item.drone.name}
                                                <br />
                                                {item.drone.model}
                                            </>
                                            :
                                            "No Drone"
                                    }
                                </td>

                                <td>{item.lmv?.registrationNo || item.lmv?.label || "No LMV"}</td>

                                {/* Status */}
                                <td>
                                    <span
                                        className={
                                            ["SCHEDULED", "IN_PROGRESS", "COMPLETED"].includes(item.lead?.status)
                                                ? "success"
                                                : "pending"
                                        }
                                    >
                                        {item.lead?.status || "Unknown"}
                                    </span>
                                </td>
                            </tr>
                        ))

                    ) : (

                        <tr>
                            <td colSpan="7">
                                No assignments found
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
            {!loading && assignments.length > 0 && (
                <div className="pagination">

                    <button
                        onClick={() => setCurrentPage(currentPage - 1)}
                        disabled={currentPage === 1}
                    >
                        Previous
                    </button>

                    <span>
                        Page {currentPage} of {totalPages}
                    </span>

                    <button
                        onClick={() => setCurrentPage(currentPage + 1)}
                        disabled={currentPage === totalPages}
                    >
                        Next
                    </button>

                </div>
            )}
        </div>

    );
};


export default AssignmentDetails;
