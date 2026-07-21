// import prisma from "../prisma/client.js";
// import bcrypt from "bcrypt";
// import jwt from "jsonwebtoken";

// export const registerBusiness = async(req, res) => {
//     try {
//         const {
//             businessName,
//             contactPerson,
//             email,
//             mobile,
//             address,
//             password,
//         } = req.body;

//         // Check if mobile already exists
//         const existingUser = await prisma.businessUser.findUnique({
//             where: {
//                 mobile,
//             },
//         });

//         if (existingUser) {
//             return res.status(400).json({
//                 success: false,
//                 message: "Mobile number already registered",
//             });
//         }

//         // Hash password
//         const hashedPassword = await bcrypt.hash(password, 10);

//         // Save business user
//         const business = await prisma.businessUser.create({
//             data: {
//                 businessName,
//                 contactPerson,
//                 email,
//                 mobile,
//                 address,
//                 password: hashedPassword,
//             },
//         });

//         res.status(201).json({
//             success: true,
//             message: "Business registered successfully",
//             data: business,
//         });
//     } catch (error) {
//         console.error(error);

//         res.status(500).json({
//             success: false,
//             message: "Internal Server Error",
//         });
//     }
// };


// export const loginBusiness = async(req, res) => {
//     try {
//         const { email, password } = req.body;

//         // Find business by email
//         const business = await prisma.businessUser.findFirst({
//             where: {
//                 email,
//             },
//         });

//         if (!business) {
//             return res.status(404).json({
//                 success: false,
//                 message: "Business account not found",
//             });
//         }

//         // Compare password
//         const isMatch = await bcrypt.compare(password, business.password);

//         if (!isMatch) {
//             return res.status(401).json({
//                 success: false,
//                 message: "Invalid password",
//             });
//         }

//         // Create JWT token
//         const token = jwt.sign({
//                 id: business.id,
//                 email: business.email,
//             },
//             process.env.JWT_SECRET, {
//                 expiresIn: "1d",
//             }
//         );

//         res.json({
//             success: true,
//             message: "Login successful",
//             token,
//             business: {
//                 id: business.id,
//                 businessName: business.businessName,
//                 email: business.email,
//             },
//         });

//     } catch (error) {
//         console.error(error);

//         res.status(500).json({
//             success: false,
//             message: "Internal Server Error",
//         });
//     }
// };


import prisma from '../prisma/client.js';
import jwt from 'jsonwebtoken';

export const registerBusiness = async(req, res) => {
    try {
        const { businessName, contactPerson, email, mobile, address } = req.body;

        const existingUser = await prisma.businessUser.findUnique({
            where: { mobile },
        });

        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'Mobile number already registered',
            });
        }

        const business = await prisma.businessUser.create({
            data: {
                businessName,
                contactPerson,
                email,
                mobile,
                address,
            },
        });

        res.status(201).json({
            success: true,
            message: 'Business registered successfully',
            data: business,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: 'Internal Server Error',
        });
    }
};

export const sendOtp = async(req, res) => {
    try {
        const { mobile } = req.body;

        const user = await prisma.businessUser.findUnique({
            where: { mobile },
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'Mobile number not registered',
            });
        }

        // Demo OTP
        const otp = '123456';

        console.log(`OTP for ${mobile}: ${otp}`);

        res.json({
            success: true,
            message: 'OTP sent successfully',
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: 'Internal Server Error',
        });
    }
};

export const verifyOtp = async(req, res) => {
    try {
        const { mobile, otp } = req.body;

        const user = await prisma.businessUser.findUnique({
            where: { mobile },
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found',
            });
        }

        // Demo OTP validation
        if (otp !== '123456') {
            return res.status(401).json({
                success: false,
                message: 'Invalid OTP',
            });
        }

        const token = jwt.sign({
                id: user.id,
                mobile: user.mobile,
            },
            process.env.JWT_SECRET, { expiresIn: '1d' }
        );

        res.json({
            success: true,
            message: 'Login successful',
            token,
            business: {
                id: user.id,
                businessId: `B2B-${String(user.id).padStart(4, "0")}`,
                businessName: user.businessName,
                contactPerson: user.contactPerson,
                email: user.email,
                mobile: user.mobile,
                address: user.address,
                createdAt: user.createdAt,
            },

        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: 'Internal Server Error',
        });
    }
};