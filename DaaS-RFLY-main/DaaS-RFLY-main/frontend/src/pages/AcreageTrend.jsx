import { useState, useEffect } from "react";
import axios from "axios";
import "./AcreageTrend.css";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";

const API = "http://localhost:5000";

function AcreageTrend() {
  const droneId = "d8fc4809-c6a2-4fba-b650-be93e37a53f5";

  // Initial Date (Today)
  const now = new Date();

  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(now);
  endOfDay.setHours(23, 59, 59, 999);

  const [filters, setFilters] = useState({
    interval: "day",
    fromDate: startOfDay,
    toDate: endOfDay,
  });

  const [response, setResponse] = useState(null);
  // const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  const handleIntervalChange = (value) => {
    const now = new Date();

    let fromDate = new Date();
    let toDate = new Date();

    switch (value) {
      case "day":
        fromDate.setHours(0, 0, 0, 0);
        toDate.setHours(23, 59, 59, 999);
        break;

      case "week":
        const day = now.getDay();

        // Monday
        fromDate = new Date(now);
        fromDate.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
        fromDate.setHours(0, 0, 0, 0);

        // Sunday
        toDate = new Date(fromDate);
        toDate.setDate(fromDate.getDate() + 6);
        toDate.setHours(23, 59, 59, 999);
        break;

      case "month":
        fromDate = new Date(
          now.getFullYear(),
          now.getMonth(),
          1,
          0,
          1,
          0,
          0
        );

        toDate = new Date(
          now.getFullYear(),
          now.getMonth() + 1,
          0
        );

        toDate.setHours(23, 59, 59, 999);
        break;

      case "year":
        fromDate = new Date(
          now.getFullYear(),
          0,
          1,
          0,
          1,
          0,
          0
        );

        toDate = new Date(
          now.getFullYear(),
          11,
          31
        );

        toDate.setHours(23, 59, 59, 999);
        break;

      default:
        break;
    }

    setFilters({
      interval: value,
      fromDate,
      toDate,
    });
  };

  const testAcreage = async () => {
    setLoading(true);
    // setStatus("");
    setResponse(null);

    try {
      console.log({
        start: filters.fromDate.toISOString(),
        end: filters.toDate.toISOString(),
        interval: filters.interval,
        droneId,
      });

      const res = await axios.get(`${API}/api/acreage`, {
        params: {
          start: filters.fromDate.toISOString(),
          end: filters.toDate.toISOString(),
          interval: filters.interval,
          // droneId,
        },
      });

      // setStatus(res.status);
      setResponse(res.data);
    } catch (error) {
      console.error(error);

      if (error.response) {
        // setStatus(error.response.status);
        setResponse({
          message:
            error.response.data?.message ||
            "Server Error",
        });
      } else {
        // setStatus("Network Error");
        setResponse({
          message: error.message,
        });
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    testAcreage();
  }, [filters]);

  const graphData =
    response?.totalAcreage?.map((item) => ({
      time: new Date(Number(item.time) * 1000).toLocaleDateString(),
      acreage: Number(item.value.toString()).toFixed(2)
    })) || [];

  return (
    <div className="acreage-container">
      <div className="acreage-form">
        <div className="input-group">
          <label  style={{
    fontSize: "18px",
    fontWeight: "600",
  }}>Interval</label>

          <select
            value={filters.interval}
            onChange={(e) =>
              handleIntervalChange(e.target.value)
            }
          >
            <option value="day">Today</option>
            <option value="week">This Week</option>
            <option value="month">This Month</option>
            <option value="year">This Year</option>
          </select>
        </div>


        <div className="button-container">
          <button
            className="acreage-btn"
            onClick={testAcreage}
            disabled={loading}
          >
            {loading ? "Loading..." : "Refresh"}
          </button>
        </div>
      </div>
      <div className="status-box">
        <h3 style={{ marginTop: "2px", color: "#666" }}>
          Total Acreage :
          {" "}
          <span style={{ color: "#1976d2" }}>
            {response?.totalAcreage?.length > 0
              ? `${Number(
                response.totalAcreage[0].total_acreage
              ).toFixed(2)} Acre`
              : "0.00 Acre"}
          </span>
        </h3>
        <p
          style={{
            color: "#1976d2",
            fontWeight: "bold",
            fontSize: "18px",
            textAlign: "center",
          }}
        >
          Acreage Graph
        </p>
        <div>
          <h4 style={{ marginTop: "2px", color: "#666" }}>
            API Used:
          </h4>
          <code
            style={{
              display: "block",
              background: "#f5f5f5",
              padding: "2px",
              borderRadius: "6px",
              fontSize: "13px",
              wordBreak: "break-word",
            }}
          >
            GET /dsp/acreage/total-acreage/
            {"{"}fromDate{"}"}/{"{"}toDate{"}"}/{"{"}interval{"}"}
          </code> </div>

        {/* {response?.message && (
          <p style={{ color: "red" }}>
            {response.message}
          </p>
        )} */}
      </div>

      {graphData.length > 0 ? (
        <ResponsiveContainer width="100%" height={450}>
          <LineChart data={graphData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="time" />
            <YAxis />
            <Tooltip />

            <Line
              type="monotone"
              dataKey="acreage"
              stroke="#1976d2"
              strokeWidth={3}
            />
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <p className="no-data">
          {loading ? "Loading..." : "No Acreage Data"}
        </p>
      )}
    </div>
  );
}

export default AcreageTrend;