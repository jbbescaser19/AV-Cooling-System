import { useEffect, useState } from "react";
import { CheckCircle2, Search, UserRound, X } from "lucide-react";
import api from "../../../api/api.js";
import "../../styles/management/pos-customer-fees.css";

/** Compact POS-only lookup; never opens the restricted Customers management page. */
export default function ReturningCustomerSearch({
  onSelect,
  disabled = false,
}) {
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [chosen, setChosen] = useState(null);
  const trimmed = query.trim();

  useEffect(() => {
    const minimum = /^\d+$/.test(trimmed) ? 4 : 3;
    if (trimmed.length < minimum) {
      setMatches([]);
      setLoading(false);
      setError("");
      return undefined;
    }
    // Never show stale results for a newly typed name or phone.
    setMatches([]);
    setError("");
    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        const { data } = await api.get("/api/management/sales/pos-customers", {
          params: { q: trimmed },
          signal: controller.signal,
        });
        if (!controller.signal.aborted) {
          setMatches(Array.isArray(data.items) ? data.items : []);
        }
      } catch (requestError) {
        if (!controller.signal.aborted) {
          setMatches([]);
          setError(
            requestError.response?.data?.message ||
              "Could not search customers.",
          );
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 300);
    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [trimmed]);

  function choose(person) {
    onSelect({
      name: String(person.name || ""),
      phone: String(person.phone || ""),
      address: String(person.address || ""),
    });
    setChosen(person);
    setQuery("");
    setMatches([]);
  }

  return (
    <section
      className="pos-returning-customer"
      aria-label="Find a returning customer"
    >
      <div className="pos-returning-customer__heading">
        <span className="pos-returning-customer__icon">
          <UserRound size={19} />
        </span>
        <div>
          <strong>Returning customer?</strong>
          <p>Search by name or phone to fill the details below.</p>
        </div>
      </div>
      <label className="pos-returning-customer__search">
        <Search size={18} aria-hidden="true" />
        <input
          type="search"
          value={query}
          disabled={disabled}
          maxLength={80}
          placeholder="Name (3+ letters) or phone (4+ digits)"
          autoComplete="off"
          aria-label="Search existing customer by name or phone"
          onChange={(event) => {
            setQuery(event.target.value);
            setChosen(null);
          }}
        />
      </label>
      {loading && (
        <p className="pos-returning-customer__hint" role="status">
          Searching…
        </p>
      )}
      {error && (
        <p className="pos-returning-customer__error" role="alert">
          {error}
        </p>
      )}
      {!loading &&
        trimmed.length >= (/^\d+$/.test(trimmed) ? 4 : 3) &&
        !error &&
        matches.length === 0 && (
          <p className="pos-returning-customer__hint">
            No matching records. Enter the customer's details manually.
          </p>
        )}
      {!loading && matches.length > 0 && (
        <ul
          className="pos-returning-customer__results"
          aria-label="Matching customers"
        >
          {matches.map((person, index) => (
            <li key={`${person.phone}-${person.name}-${index}`}>
              <button
                type="button"
                disabled={disabled}
                onClick={() => choose(person)}
              >
                <span>
                  <strong>{person.name}</strong>
                  <small>
                    {person.phone} · {person.source}
                  </small>
                </span>
                <span className="pos-returning-customer__choose">
                  Use details
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {chosen && (
        <div className="pos-returning-customer__selected" role="status">
          <CheckCircle2 size={16} aria-hidden="true" />
          <span>
            Filled in <strong>{chosen.name}</strong>. Please confirm the phone
            and address with the customer.
          </span>
          <button
            type="button"
            onClick={() => setChosen(null)}
            aria-label="Dismiss selected customer notice"
          >
            <X size={15} />
          </button>
        </div>
      )}
      <p className="pos-returning-customer__manual">
        New customer? Just fill in the form below.
      </p>
    </section>
  );
}
