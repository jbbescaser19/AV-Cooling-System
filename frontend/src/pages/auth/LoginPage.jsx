import { Link, useNavigate } from "react-router-dom";
import { readCatalogProducts } from "../../utils/catalogStore";
import { loginCustomer } from "../../utils/authMock";
import "../../styles/auth/auth.css";
export default function LoginPage() {
  const nav = useNavigate();
  const continuePending = (p) => {
    if (!p) return nav("/shop");
    if (p.type === "checkout") return nav("/checkout");
    if (p.type === "book_service") return nav("/services");
    if (p.type === "add_to_cart") {
      const product = readCatalogProducts().find((x) => x.id === p.productId);
      const variant = product?.variants?.find((v) => v.hp === p.variant);
      if (product && variant) {
        const cart = JSON.parse(localStorage.getItem("av_cart") || "[]");
        const found = cart.find(
          (x) => x.productId === product.id && x.hp === variant.hp,
        );
        if (found) found.qty += 1;
        else
          cart.push({
            productId: product.id,
            name: product.name,
            brand: product.brand,
            hp: variant.hp,
            price: variant.price,
            srp: variant.srp,
            qty: 1,
          });
        localStorage.setItem("av_cart", JSON.stringify(cart));
        window.dispatchEvent(new Event("av-cart-updated"));
        return nav("/cart");
      }
    }
    nav("/shop");
  };
  return (
    <div className="auth-shell">
      <form
        className="auth-card"
        onSubmit={(e) => {
          e.preventDefault();
          loginCustomer(e.currentTarget.email.value);
          const p = JSON.parse(
            sessionStorage.getItem("av_pending_action") || "null",
          );
          sessionStorage.removeItem("av_pending_action");
          continuePending(p);
        }}
      >
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
          className="form-control"
          type="password"
          placeholder="Password"
          required
        />
        <button className="btn btn-dark">Login</button>
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
