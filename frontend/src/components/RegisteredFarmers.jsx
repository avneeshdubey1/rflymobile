import { useEffect, useState } from "react";
import { API_URL as API } from "../config";
import { SkeletonTableRows } from "./Skeleton";
import "./RegisteredFarmers.css";

function RegisteredFarmers() {
    const [farmers, setFarmers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const [totalFarmers, setTotalFarmers] = useState(0);
    const [totalPages, setTotalPages] = useState(0);
    const farmersPerPage = 10;

    useEffect(() => {
        const controller = new AbortController();
        const timer = setTimeout(async () => {
            setLoading(true);
            try {
                const params = new URLSearchParams({
                    q: search.trim(),
                    page: String(currentPage),
                    pageSize: String(farmersPerPage),
                });
                const response = await fetch(`${API}/api/customers/sales?${params}`, {
                    signal: controller.signal,
                });
                const data = await response.json().catch(() => ({}));

                if (!response.ok || !data.success) throw new Error(data.error || "Failed to fetch customers");
                setFarmers(data.customers || []);
                setTotalFarmers(data.pagination?.total || 0);
                setTotalPages(data.pagination?.totalPages || 0);
            } catch (error) {
                if (error.name !== "AbortError") console.error("Failed to fetch farmers:", error);
            } finally {
                if (!controller.signal.aborted) setLoading(false);
            }
        }, search ? 250 : 0);
        return () => {
            clearTimeout(timer);
            controller.abort();
        };
    }, [currentPage, search]);
    const indexOfFirstFarmer = (currentPage - 1) * farmersPerPage;
    const indexOfLastFarmer = indexOfFirstFarmer + farmers.length;

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
                                <th>Subscription</th>
                                <th>Registered By</th>
                                <th>Registered On</th>
                            </tr>
                        </thead>

                        <tbody>
                            {loading ? (
                                <SkeletonTableRows rows={6} columns={14} />
                            ) : farmers.length === 0 ? (
                                <tr>
                                    <td colSpan="14" style={{ textAlign: "center" }}>
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
                        Showing {totalFarmers === 0 ? 0 : indexOfFirstFarmer + 1} -
                        {indexOfLastFarmer} of{" "}
                        {totalFarmers} customers
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
