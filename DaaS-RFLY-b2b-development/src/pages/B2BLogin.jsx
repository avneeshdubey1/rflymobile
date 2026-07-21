import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Smartphone, ShieldCheck, Building2 } from "lucide-react";
import { sendOtp, verifyOtp } from "../services/businessApi";
import { toast } from "react-toastify";

export default function B2BLogin() {
  const navigate = useNavigate();

  const [step, setStep] = useState(1);

  const [formData, setFormData] = useState({
    mobile: "",
    otp: "",
  });

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSendOtp = async (e) => {
    e.preventDefault();

    try {
      const response = await sendOtp({
        mobile: formData.mobile,
      });

      toast.success(response.data.message);
      setStep(2);
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to send OTP");
    }
  };

  // const handleVerifyOtp = async (e) => {
  //   e.preventDefault();

  //   try {
  //     const response = await verifyOtp(formData);
  //     toast.success("Login Successful");
  //     localStorage.setItem("token", response.data.token);
  //     navigate("/dashboard");
  //   } catch (error) {
  //     toast.error(error.response?.data?.message || "Invalid OTP");
  //   }
  // };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    console.log("Verify button clicked");
    try {
      const response = await verifyOtp(formData);
      console.log("Full response:", response);
      console.log("Response data:", response.data);
      toast.success("Login Successful");
      localStorage.setItem("token", response.data.token);
      localStorage.setItem(
        "business",
        JSON.stringify(response.data.business)
      );
      navigate("/dashboard");
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.message || "Invalid OTP");
    }
  };


  return (
    <main className="login-container">
      <section className="login-context">
        <div className="login-context__brand logo">Daas</div>
        <div className="login-context__copy">
          <p className="hero-kicker">Business Portal</p>
          <h1>Request drone services effortlessly.</h1>
          <p>Manage your service requests, track their status, view invoices, and monitor all drone operations from one place.</p>
        </div>
      </section>

      {/* <div className="relative min-h-screen flex items-center justify-center login-context overflow-hidden">
      <div className="absolute -top-32 -left-32 w-80 h-80 bg-[#2E8B57]/20 rounded-full blur-3xl"></div>
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-green-300/10 rounded-full blur-3xl"></div> */}
      <section className="login-form-pane">
        <div className="login-card">
          {/* <div className="relative w-full max-w-md bg-white/95 rounded-3xl shadow-2xl p-8">
        <div className="flex justify-center mb-2">
          <div className="w-20 h-20 rounded-full bg-[#2E8B57] flex items-center justify-center">
            <Building2 className="text-white" size={36} />
          </div>
        </div> */}

          {/* <h2 className="text-3xl font-bold text-center !text-black">
          Business Login
        </h2>
        <p className="text-center text-gray-500 !mt-1 !mb-2">
          Login using Mobile Number & OTP
        </p> */}

          <p className="eyebrow eyebrow--accent">BUSINESS LOGIN</p>
          <h2>Welcome back</h2>
          <p className="subtitle" style={{ marginBottom: '1.6rem' }}>Use the mobile number registered with your Farmer account.</p>

          {step === 1 ? (
            <form onSubmit={handleSendOtp} className="space-y-5">

              <div>
                <label className="block font-semibold mb-2">
                  Mobile Number
                </label>

                <div className="relative">

                  <Smartphone
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
                    size={18}
                  />

                  <input
                    type="tel"
                    name="mobile"
                    value={formData.mobile}
                    onChange={handleChange}
                    placeholder="Enter Mobile Number"
                    className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-xl
                  text-black placeholder:text-gray-400
                  bg-white
                  focus:outline-none
                  focus:ring-2
                  focus:ring-[#2E8B57]"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-[#2E8B57] text-white rounded-xl font-semibold hover:bg-[#246B45]"
              >
                Send OTP
              </button>

            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-5">

              <div>
                <label className="block font-semibold mb-2">
                  OTP
                </label>

                <div className="relative">
                  <ShieldCheck
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
                    size={18}
                  />
                  <input
                    type="text"
                    name="otp"
                    value={formData.otp}
                    onChange={handleChange}
                    placeholder="Enter OTP"
                    className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-xl
                    text-black placeholder:text-gray-400
                    bg-white
                    focus:outline-none
                    focus:ring-2
                    focus:ring-[#2E8B57]"
                    required
                  />

                </div>
                <div className="mt-3">
                  <p className="text-xs text-gray-500">
                    Demo OTP: <span className="font-semibold">123456</span>
                  </p>
                </div>
              </div>
              <button
                type="submit"
                className="w-full py-3 bg-[#2E8B57] text-white rounded-xl font-semibold hover:bg-[#246B45]"
              >
                Verify OTP
              </button>
            </form>
          )}

          <div className="text-center mt-5 text-sm">
            <span className="text-gray-500">
              Don't have a business account?
            </span>

            <Link
              to="/register"
              className="ml-2 font-semibold text-[#2E8B57] hover:underline">
              Register
            </Link>
          </div>

          {/* </div> */}
        </div>
      </section>
      {/* </div> */}
    </main>
  );
}