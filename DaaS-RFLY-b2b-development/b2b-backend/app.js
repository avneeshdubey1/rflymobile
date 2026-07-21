import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import businessRoutes from "./routes/businessRoutes.js";

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());
app.use("/api/b2b", businessRoutes);

export default app;