import { Link, useNavigate } from "react-router-dom";

import { loginCustomer } from "../../utils/authMock";

import { continuePendingAction } from "../../utils/purchaseFlow";

import "../../styles/auth/auth.css";

export default function LoginPage() {
  const nav = useNavigate();

  const handleSubmit = (event) => {
    event.preventDefault();

    const email = event.currentTarget.email.value;

    /*
      TEMPORARY MOCK LOGIN.

      Replace this with your real
      backend login API later.
    */

    loginCustomer(email);

    /*
      After successful authentication,
      continue Order Now / Checkout /
      Service Request.
    */

    continuePendingAction(nav);
  };

  return (
    <div className="auth-shell">
      <form className="auth-card" onSubmit={handleSubmit}>
        <div className="eyebrow">Customer Login</div>

        <h1>Welcome back</h1>

        <input
          name="email"
          className="form-control"
          type="email"
          placeholder="Email"
          required
        />

        <input
          name="password"
          className="form-control"
          type="password"
          placeholder="Password"
          required
        />

        <button className="btn btn-dark" type="submit">
          Login
        </button>

        <p>
          <Link to="/forgot-password">Forgot password?</Link>
        </p>

        <p>
          New customer? <Link to="/register">Create account</Link>
        </p>
      </form>
    </div>
  );
}
