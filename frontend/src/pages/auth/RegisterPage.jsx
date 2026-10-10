import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import api from "../../../api/api.js";
export default function RegisterPage() {
  const nav = useNavigate();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    pass: "",
  });

  const handleFormData = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const registerCustomer = async () => {};
  return (
    <div className="auth-shell">
      <form className="auth-card">
        <div className="eyebrow">Customer Registration</div>
        <h1>Create account</h1>
        <input
          name="name"
          value={formData.name}
          onChange={handleFormData}
          className="form-control"
          placeholder="Full name"
          required
        />
        <input
          name="email"
          value={formData.email}
          onChange={handleFormData}
          className="form-control"
          type="email"
          placeholder="Email"
          required
        />
        <input
          name="pass"
          value={formData.pass}
          onChange={handleFormData}
          className="form-control"
          type="password"
          placeholder="Password"
          required
        />
        <button className="btn btn-dark" onClick={registerCustomer}>
          Register
        </button>
        <p>
          Already registered? <Link to="/login">Login</Link>
        </p>
      </form>
    </div>
  );
}
