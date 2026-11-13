import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Star } from "lucide-react";
import api from "../../../api/api.js";
import useRealtimeRefresh from "../../hooks/useRealtimeRefresh.js";
import "../../styles/home/testimonials.css";

export default function TestimonialsSection() {
  const [reviews, setReviews] = useState([]);
  const [revision, setRevision] = useState(0);
  useRealtimeRefresh(["feedback"], setRevision);

  useEffect(() => {
    const ctrl = new AbortController();
    api
      .get("/api/customer/feedback/public", {
        params: { limit: 3 },
        signal: ctrl.signal,
      })
      .then(({ data }) => {
        if (!ctrl.signal.aborted) setReviews(data.reviews || []);
      })
      .catch(() => {});
    return () => ctrl.abort();
  }, [revision]);

  if (!reviews.length) return null;

  return (
    <section className="section testimonials-section" id="feedback">
      <div className="container">
        <div className="section-head">
          <div className="eyebrow">Genuine customer feedback</div>
          <h2 className="section-title">
            Experiences shared by our customers.
          </h2>
          <p>
            Real reviews from completed orders and services, shared with
            permission.
          </p>
        </div>
        <div className="public-reviews-grid">
          {reviews.map((r) => (
            <article className="public-review-card" key={r.id}>
              <div
                className="public-review-stars"
                aria-label={`${r.rating} out of 5 stars`}
              >
                {Array.from({ length: 5 }, (_, i) => (
                  <Star
                    key={i}
                    size={17}
                    fill={i < r.rating ? "currentColor" : "none"}
                  />
                ))}
              </div>
              <p>{r.comment}</p>
              <div>
                <strong>{r.reviewerName}</strong>
                <small>
                  {r.sourceLabel} · {r.category}
                </small>
              </div>
            </article>
          ))}
        </div>
        <Link className="public-reviews-more" to="/reviews">
          Read all customer reviews →
        </Link>
      </div>
    </section>
  );
}
