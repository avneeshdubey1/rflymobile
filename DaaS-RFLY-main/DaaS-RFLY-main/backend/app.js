const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());

app.use(express.json());

app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/forms", require("./routes/formRoutes"));
app.use("/api/submit", require("./routes/submitRoutes")); // Deprecated landing page submit
app.use("/api/leads", require("./routes/leadRoutes")); // New 2-step workflow
app.use("/api/assignments", require("./routes/assignmentRoutes")); // Pilot workflow
app.use("/api/users", require("./routes/userRoutes")); // Fetch Pilots
app.use("/api/drones", require("./routes/droneRoutes")); // Fetch Drones
app.use("/api/bhumeet", require("./routes/bhumeetRoutes")); // Mock Bhumeet API
app.use("/api/system", require("./routes/systemRoutes")); // Development reset tools

app.use("/api/acreage", require("./routes/acreageRoutes")); // Acreage trend 

module.exports = app;