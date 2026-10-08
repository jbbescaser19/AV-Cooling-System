import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";

export default function RegisterPage() {
  //   const nav = useNavigate();
  // const [formData setFormData] = useState({
  //   name:"",
  //   email:"",
  //   pass:"",
  // })
  return (
    <div className="auth-shell">
      <form className="auth-card">
        <div className="eyebrow">Customer Registration</div>
        <h1>Create account</h1>
        <input
          name="name"
          className="form-control"
          placeholder="Full name"
          required
        />
        <input
          name="email"
          className="form-control"
          type="email"
          placeholder="Email"
          required
        />
        <input
          className="form-control"
          type="password"
          placeholder="Password"
          required
        />
        <button className="btn btn-dark">Register</button>
        <p>
          Already registered? <Link to="/login">Login</Link>
        </p>
      </form>
    </div>
  );
}
