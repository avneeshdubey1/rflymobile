// import express from "express";
// import { registerBusiness, loginBusiness } from "../controllers/businessController.js";

// const router = express.Router();
// router.post("/register", registerBusiness);
// router.post("/login", loginBusiness);
// export default router;

import express from 'express';
import {
    registerBusiness,
    sendOtp,
    verifyOtp,
} from '../controllers/businessController.js';

const router = express.Router();
router.post('/register', registerBusiness);
router.post('/send-otp', sendOtp);
router.post('/verify-otp', verifyOtp);
export default router;