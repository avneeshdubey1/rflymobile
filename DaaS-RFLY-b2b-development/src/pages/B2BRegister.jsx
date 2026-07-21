import { useState } from "react";
import { Link } from "react-router-dom";
import { registerBusiness } from "../services/businessApi";
import { toast } from "react-toastify";

export default function B2BRegister() {
  const [formData, setFormData] = useState({
    businessName: "",
    contactPerson: "",
    email: "",
    mobile: "",
    address: "",
    // password: "",
    // confirmPassword: "",
  });

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // if (formData.password !== formData.confirmPassword) {
    //   alert("Passwords do not match");
    //   return;
    // }

    try {
      const response = await registerBusiness({
        businessName: formData.businessName,
        contactPerson: formData.contactPerson,
        email: formData.email,
        mobile: formData.mobile,
        address: formData.address,
        // password: formData.password,
      });
      toast.success("Business registered successfully");
      console.log(response.data);
      setFormData({
        businessName: "",
        contactPerson: "",
        email: "",
        mobile: "",
        address: "",
        // password: "",
        // confirmPassword: "",
      });
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.message || "Registration Failed");
    }
  };

  return (
    // <div className="relative min-h-screen flex items-center justify-center login-context overflow-hidden py-4 px-4">

    //   {/* Background Decorations */}
    //   <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-[#2E8B57]/20 blur-3xl"></div>
    //   <div className="absolute bottom-0 right-0 w-96 h-96 rounded-full bg-green-300/10 blur-3xl"></div>
  <main className="login-container">
      <section className="login-context">
        <div className="login-context__brand logo">Daas</div>
        <div className="login-context__copy">
          <p className="hero-kicker">Business Portal</p>
          <h1>Request drone services instantly.</h1>
          <p>Register your business to access drone services, manage requests, 
            and monitor your operations anytime.
          </p>
        </div>
      </section>
      {/* Registration Card */}
      {/* <div className="relative w-full max-w-3xl bg-white/95 backdrop-blur-lg rounded-3xl shadow-2xl p-8 md:p-10"> */}

        {/* Logo */}
        {/* <div className="flex justify-center mb-1">
          <div className="w-20 h-20 rounded-full bg-[#2E8B57] flex items-center justify-center text-white text-3xl font-bold shadow-lg">
            B
          </div>
        </div> */}

        {/* <h2 className="text-3xl font-bold text-center !text-black">
          Business Registration
        </h2>

        <p className="text-center text-[#808080] mt-5 mb-10">
          Register your business to access our B2B services
        </p> */}
        <section className="login-form-pane">
        <div className="register-card">
        <div className="form-heading"> 
          <p className="eyebrow eyebrow--accent">BUSINESS REGISTRATION</p>
          <h2 className="!text-black">Create your account</h2>
          <p>Register your business to access our B2B services</p>
          {/* <p>Already registered? <Link to="/farmer/login">Login using OTP</Link></p> */}
        </div> 
        <form
          onSubmit={handleSubmit}
          className="grid grid-cols-1 lg:grid-cols-2 gap-6"
        >
          {/* Business Name */}
          <div>
            <label className="block mt-1 mb-2 text-sm font-semibold text-black">
              Business Name
            </label>

            <input
              required
              type="text"
              name="businessName"
              value={formData.businessName}
              onChange={handleChange}
              //   placeholder="ABC Pvt Ltd"
              className="w-full bg-white text-black caret-black border border-gray-300 rounded-xl px-4 py-3 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#2E8B57]"
            />
          </div>

          {/* Contact Person */}
          <div>
            <label className="block mt-1 mb-2 text-sm font-semibold text-black">
              Contact Person
            </label>

            <input
              required
              type="text"
              name="contactPerson"
              value={formData.contactPerson}
              onChange={handleChange}
              //   placeholder="John Doe"
              className="w-full bg-white text-black caret-black border border-gray-300 rounded-xl px-4 py-3 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#2E8B57]"
            />
          </div>

          {/* Email */}
          <div>
            <label className="block mb-2 text-sm font-semibold text-black">
              Email
            </label>

            <input
              required
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="company@example.com"
              className="w-full bg-white text-black caret-black border border-gray-300 rounded-xl px-4 py-3 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#2E8B57]"
            />
          </div>

          {/* Mobile */}
          <div>
            <label className="block mb-2 text-sm font-semibold text-black">
              Mobile Number
            </label>
            <input
              required
              type="tel"
              name="mobile"
              value={formData.mobile}
              onChange={handleChange}
              //   placeholder="9876543210"
              className="w-full bg-white text-black caret-black border border-gray-300 rounded-xl px-4 py-3 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#2E8B57]"
            />
          </div>

          {/* Address */}
          <div className="lg:col-span-2">
            <label className="block mb-2 text-sm font-semibold text-black">
              Business Address
            </label>
            <textarea
              required
              rows="2"
              name="address"
              value={formData.address}
              onChange={handleChange}
              placeholder="Enter your complete business address"
              className="w-full bg-white text-black caret-black border border-gray-300 rounded-xl px-4 py-3 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#2E8B57]"
            />
          </div>

          {/* Password */}
          {/* <div >
            <label className="block mb-2 text-sm font-semibold text-black">
              Password
            </label>
            <input
              required
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="Enter password"
              className="w-full bg-white text-black caret-black border border-gray-300 rounded-xl px-4 py-3 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#2E8B57]"
            />
          </div> */}

          {/* Confirm Password */}
          {/* <div>
            <label className="block mb-2 text-sm font-semibold text-black">
              Confirm Password
            </label>
            <input
              required
              type="password"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              placeholder="Confirm password"
              className="w-full bg-white text-black caret-black border border-gray-300 rounded-xl px-4 py-3 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#2E8B57]"
            />
          </div> */}

          {/* Register Button */}
          <div className="lg:col-span-2 ">
            <button
              type="submit"
              className="w-full bg-[#2E8B57] text-white py-3 rounded-xl font-semibold hover:bg-[#246B45] hover:shadow-xl hover:scale-[1.01] transition-all duration-300"
            >
              Register Business
            </button>
          </div>
        </form>

        <hr className="my-5 border-gray-200" />
        <p className="text-center text-[#808080]">
          Already have a business account?
          <Link
            to="/"
            className="ml-2 text-[#2E8B57] font-semibold hover:underline"
          >
            Login
          </Link>
        </p>

        </div>
        </section>
      {/* </div> */}
    {/* </div> */}
    </main>
  );
}