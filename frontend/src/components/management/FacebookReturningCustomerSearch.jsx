import { useEffect, useState } from "react";
import { Search, UserRoundCheck } from "lucide-react";
import api from "../../../api/api.js";
import "../../styles/management/facebook-returning-customer.css";

/** Reuse the same privacy-limited name/phone lookup used by POS. */
export default function FacebookReturningCustomerSearch({
  onSelect,
  disabled = false,
}) {
  const [query, setQuery] = useState("");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const q = query.trim();
    const needed = /^\d+$/.test(q) ? 4 : 3;
    if (q.length < needed) {
      setItems([]);
      setError("");
      setLoading(false);
      return undefined;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError("");
      api
        .get("/api/management/sales/pos-customers", {
          params: { q },
          signal: controller.signal,
        })
        .then(({ data }) => {
          if (!controller.signal.aborted)
            setItems(Array.isArray(data.items) ? data.items : []);
        })
        .catch((err) => {
          if (!controller.signal.aborted) {
            setError(err.response?.data?.message || "Search unavailable.");
            setItems([]);
          }
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 350);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query]);
  function choose(person) {
    onSelect(person);
    setQuery("");
    setItems([]);
  }
  return (
    <section className="fb-returning">
      <label htmlFor="fb-returning-search">
        <UserRoundCheck size={17} /> Returning customer? (optional)
      </label>
      <div className="fb-returning__field">
        <Search size={17} />
        <input
          id="fb-returning-search"
          type="search"
          value={query}
          disabled={disabled}
          maxLength={80}
          placeholder="Search name or phone, or enter a new customer"
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>
      {loading && <small role="status">Searching previous customers…</small>}
      {error && <small role="alert">{error}</small>}
      {items.length > 0 && (
        <div
          className="fb-returning__results"
          role="list"
          aria-label="Matching customers"
        >
          {items.map((person, index) => (
            <button
              key={`${person.name}-${person.phone}-${index}`}
              type="button"
              role="listitem"
              disabled={disabled}
              onClick={() => choose(person)}
            >
              <strong>{person.name}</strong>
              <span>
                {person.phone} · {person.source || "Existing customer"}
              </span>
            </button>
          ))}
        </div>
      )}
      <p>
        Select a previous customer to copy their name, phone and address. Always
        confirm details with the person you are speaking to.
      </p>
    </section>
  );
}
