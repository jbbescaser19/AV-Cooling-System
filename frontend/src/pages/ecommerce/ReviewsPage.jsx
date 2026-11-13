import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { MessageSquareHeart, RefreshCw, Star } from "lucide-react";
import api from "../../../api/api.js";
import useRealtimeRefresh from "../../hooks/useRealtimeRefresh.js";
import "../../styles/home/testimonials.css";

export default function ReviewsPage() {
  const [items, setItems] = useState([]),
    [busy, setBusy] = useState(true),
    [error, setError] = useState(""),
    [refresh, setRefresh] = useState(0);
  useRealtimeRefresh(["feedback"], setRefresh);

  useEffect(() => {
    const controller = new AbortController();
    setBusy(true);
    api
      .get("/api/customer/feedback/public", {
        params: { limit: 30 },
        signal: controller.signal,
      })
      .then(({ data }) => {
        if (!controller.signal.aborted) setItems(data.reviews || []);
      })
      .catch((e) => {
        if (!controller.signal.aborted)
          setError(e.response?.data?.message || "Could not load reviews.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setBusy(false);
      });
    return () => controller.abort();
  }, [refresh]);

  return (
    <main className="public-reviews-page">
      <div className="container">
        <header className="public-reviews-header">
          <span className="eyebrow">Customer reviews</span>
          <h1>Real customer experiences</h1>
          <p>
            Reviews about completed purchases or services, shared only with
            customer permission.
          </p>
        </header>
        {busy ? (
          <p role="status">Loading reviews…</p>
        ) : error ? (
          <div role="alert">
            <p>{error}</p>
            <button
              type="button"
              onClick={() => {
                setError("");
                setRefresh((n) => n + 1);
              }}
            >
              <RefreshCw size={16} />
              Try again
            </button>
          </div>
        ) : items.length ? (
          <div className="public-reviews-grid">
            {items.map((item) => (
              <article className="public-review-card" key={item.id}>
                <div
                  aria-label={`${item.rating} out of 5 stars`}
                  className="public-review-stars"
                >
                  {Array.from({ length: 5 }, (_, i) => (
                    <Star
                      key={i}
                      size={17}
                      fill={i < item.rating ? "currentColor" : "none"}
                    />
                  ))}
                </div>
                <p>{item.comment}</p>
                <div>
                  <strong>{item.reviewerName}</strong>
                  <small>
                    {item.sourceLabel} · {item.category} · {item.dateLabel}
                  </small>
                </div>
              </article>
            ))}
          </div>
        ) : null}
        {!busy && !error && (
          <section className="public-reviews-invite">
            <div className="public-reviews-icon">
              <MessageSquareHeart size={27} />
            </div>
            <h2>Your Feedback Matters!</h2>
            <p>
              We'd love to hear about your experience with AV Cooling System.
              Your feedback helps us improve and serve you better.
            </p>
            <Link to="/account/feedback">Share Your Experience</Link>
          </section>
        )}
      </div>
    </main>
  );
}
