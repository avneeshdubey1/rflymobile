import { useEffect, useState } from "react";
import { API_URL as API } from "../config";
import { SkeletonTableRows } from "./Skeleton";
import "./RegisteredFarmers.css";

function RegisteredFarmers() {
    const [farmers, setFarmers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [total, setTotal] = useState(0);
    // pagination
    const [currentPage, setCurrentPage] = useState(1);
    const farmersPerPage = 10;

    useEffect(() => {
        fetchFarmers();
    }, [currentPage, search]);

    const fetchFarmers = async () => {
        setLoading(true);
        try {
            // const response = await fetch(`${API}/api/customers/sales?q=`);
            // const data = await response.json().catch(() => ({}));
            // if (!response.ok || !data.success) throw new Error(data.error || "Failed to fetch customers");
            // setFarmers(data.customers || []);
            const response = await fetch(
                `${API}/api/customers/sales?q=${encodeURIComponent(search)}&page=${currentPage}&pageSize=${farmersPerPage}`
            );
            const data = await response.json().catch(() => ({}));

            if (!response.ok || !data.success) throw new Error(data.error || "Failed to fetch customers");
            setFarmers(data.customers || []);
            setTotal(data.total || 0);

        } catch (error) {
            console.error("Failed to fetch farmers:", error);
        } finally {
            setLoading(false);
        }
    };
    const filteredFarmers = farmers.filter((farmer) => {
        const value = search.toLowerCase();

        return (
            farmer.displayName?.toLowerCase().includes(value) ||
            farmer.phone?.includes(value)
        );
    });

    // const totalPages = Math.ceil(filteredFarmers.length / farmersPerPage);
    // const indexOfLastFarmer = currentPage * farmersPerPage;
    // const indexOfFirstFarmer = indexOfLastFarmer - farmersPerPage;
    // const currentFarmers = filteredFarmers.slice(
    //     indexOfFirstFarmer,
    //     indexOfLastFarmer
    // );
    const totalPages = Math.ceil(total / farmersPerPage) || 1;
    const indexOfFirstFarmer = total === 0 ? 0 : (currentPage - 1) * farmersPerPage + 1;
    const indexOfLastFarmer = Math.min(currentPage * farmersPerPage, total);


    return (
        <section className="panel panel--raised">
            <div className="panel-header">
                <div className="panel-header__title">
                    <h2>Registered Customers</h2>
                    <p>List of all registered Customers.</p>
                </div>
            </div>
            <div
                style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: "16px",
                }}
            >
                <input
                    type="text"
                    placeholder="Search by Customer Name or Mobile Number"
                    value={search}
                    onChange={(e) => {
                        setSearch(e.target.value);
                        setCurrentPage(1);
                    }}
                    disabled={loading}
                    style={{
                        width: "350px",
                        padding: "10px",
                        borderRadius: "6px",
                        border: "1px solid #ccc",
                        marginLeft: '20px'
                    }}
                />
            </div>
            <div className="panel-body">
                <div className="table-scroll">
                    <table className="table">
                        <thead>
                            <tr>
                                <th>Customer Name</th>
                                <th>Mobile Number</th>
                                <th>Ownership</th>
                                <th>Total Acres</th>
                                <th>Kharif Crop</th>
                                <th>Rabi Crop</th>
                                <th>Summer Crop</th>
                                <th>Village</th>
                                <th>Mandal</th>
                                <th>District</th>
                                <th>State</th>
                                <th>Cluster Field</th>
                                <th>Cluster Type</th>
                                <th>Subscription</th>
                                <th>Registered By</th>
                                <th>Registered On</th>
                            </tr>
                        </thead>

                        <tbody>
                            {loading ? (
                                <SkeletonTableRows rows={6} columns={16} />
                            ) : farmers.length === 0 ? (
                                <tr>
                                    <td colSpan="16" style={{ textAlign: "center" }}>
                                        No customers registered.
                                    </td>
                                </tr>
                            ) : (
                                farmers.map((farmer) => (
                                    <tr key={farmer.id}>
                                        <td>{farmer.displayName}</td>

                                        <td>{farmer.phone}</td>

                                        <td>{farmer.ownership || "-"}</td>

                                        <td>{farmer.totalAcres ?? "-"}</td>

                                        <td>
                                            {farmer.kharifCrop === "Others"
                                                ? farmer.kharifOtherCrop
                                                : farmer.kharifCrop || "-"}
                                        </td>

                                        <td>
                                            {farmer.rabiCrop === "Others"
                                                ? farmer.rabiOtherCrop
                                                : farmer.rabiCrop || "-"}
                                        </td>

                                        <td>
                                            {farmer.summerCrop === "Others"
                                                ? farmer.summerOtherCrop
                                                : farmer.summerCrop || "-"}
                                        </td>

                                        <td>{farmer.village}</td>

                                        <td>{farmer.mandal || "-"}</td>

                                        <td>{farmer.district}</td>

                                        <td>{farmer.state}</td>
                                        <td>{farmer.cluster || "-"}</td>
                                        <td>{farmer.clusterType || "-"}</td>
                                        <td>
                                            {farmer.subscriptionCardNumber
                                                ? `${farmer.subscriptionCardNumber} (${farmer.subscriptionYear})`
                                                : "-"}
                                        </td>

                                        <td>Internal staff</td>

                                        <td>
                                            {new Date(farmer.createdAt).toLocaleDateString()}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
                <div className="pagination-container">
                    <span className="pagination-info">
                    Showing {indexOfFirstFarmer} - {indexOfLastFarmer} of {total} farmers
                    </span>

                    {/* <div className="pagination-controls">
                        <button
                            className="pagination-btn"
                            onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                            disabled={currentPage === 1 || loading}
                        >
                            Previous
                        </button>

                        <span className="pagination-page">
                            Page {currentPage} of {totalPages || 1}
                        </span>

                        <button
                            className="pagination-btn"
                            onClick={() =>
                                setCurrentPage((p) => Math.min(p + 1, totalPages))
                            }
                            disabled={currentPage === totalPages || totalPages === 0 || loading}
                        >
                            Next
                        </button>
                    </div> */}
                    <div className="pagination-controls">
                        <button
                            type="button"
                            className="pagination-btn pagination-btn--icon"
                            aria-label="Previous page"
                            disabled={currentPage === 1 || loading}
                            onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                        >
                            &lt;
                        </button>
                        <span className="pagination-page">{`Page ${currentPage} of ${totalPages || 1}`}</span>
                        <button
                            type="button"
                            className="pagination-btn pagination-btn--icon"
                            aria-label="Next page"
                            disabled={currentPage === totalPages || totalPages === 0 || loading}
                            onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                        >
                            &gt;
                        </button>
                    </div>
                </div>
            </div>
        </section>
    );
}

export default RegisteredFarmers;
