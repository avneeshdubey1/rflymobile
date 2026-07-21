// import axios from "axios";

// const API = axios.create({
//     baseURL: "http://localhost:5000/api/b2b",
// });

// export const registerBusiness = (data) => {
//     return API.post("/register", data);
// };

// export const loginBusiness = (data) => {
//     return API.post("/login", data);
// }

// export default API;



import axios from 'axios';

const API = axios.create({
    baseURL: 'http://localhost:5000/api/b2b',
});

export const registerBusiness = (data) =>
    API.post('/register', data);
export const sendOtp = (data) =>
    API.post('/send-otp', data);
export const verifyOtp = (data) =>
    API.post('/verify-otp', data);

export default API;