import { useEffect, useState } from "react";
import {
  CheckCircle2,
  MessageSquareText,
  RefreshCw,
  Send,
  Star,
} from "lucide-react";
import api from "../../../api/api.js";
import CustomerPageHeader from "../../components/customer/CustomerPageHeader";
import "../../styles/customer/customer-feedback.css";

const categories = [
  "Service Quality",
  "Installation",
  "Product Quality",
  "Communication",
  "Pricing",
];
const empty = {
  category: "Service Quality",
  rating: 5,
  comment: "",
  subject: "GENERAL",
  allowPublicReview: false,
};
const stars = (rating) => `${"★".repeat(rating)}${"☆".repeat(5 - rating)}`;
export default function FeedbackPage() {
  const [form, setForm] = useState(empty),
    [history, setHistory] = useState([]),
    [targets, setTargets] = useState([]),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [changing, setChanging] = useState(null),
    [error, setError] = useState(""),
    [success, setSuccess] = useState(""),
    [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    api
      .get("/api/customer/feedback", { signal: controller.signal })
      .then(({ data }) => {
        if (!controller.signal.aborted) {
          setHistory(data.feedback || []);
          setTargets(data.availableTargets || []);
        }
      })
      .catch((e) => {
        if (!controller.signal.aborted)
          setError(e.response?.data?.message || "Unable to load feedback.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [revision]);
  function change(key, value) {
    setForm((prev) => ({
      ...prev,
      [key]: value,
      ...(key === "subject" ? { allowPublicReview: false } : {}),
    }));
    setError("");
    setSuccess("");
  }
  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const [subjectKind, id] = form.subject.split(":");
      const data = await api.post("/api/customer/feedback", {
        category: form.category,
        rating: form.rating,
        comment: form.comment.trim(),
        subjectKind,
        subjectId: subjectKind === "GENERAL" ? null : Number(id),
        allowPublicReview: subjectKind !== "GENERAL" && form.allowPublicReview,
      });
      if (!data.data?.success) throw new Error("Submission not confirmed.");
      setForm(empty);
      setSuccess("Thank you! Your feedback has been saved.");
      setRevision((v) => v + 1);
    } catch (e) {
      setError(
        e.response?.data?.message || e.message || "Unable to send feedback.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function visibility(item) {
    if (changing !== null) return;
    setChanging(item.id);
    setError("");
    setSuccess("");
    try {
      const { data } = await api.patch(
        `/api/customer/feedback/${item.id}/public-visibility`,
        { allowPublicReview: !item.allowPublicReview },
      );
      setHistory((list) =>
        list.map((x) =>
          x.id === item.id
            ? { ...x, allowPublicReview: data.allowPublicReview }
            : x,
        ),
      );
      setSuccess(data.message);
    } catch (e) {
      setError(
        e.response?.data?.message || "Could not change review visibility.",
      );
    } finally {
      setChanging(null);
    }
  }
  return (
    <div className="customer-module customer-feedback-page">
      <CustomerPageHeader
        Icon={Star}
        title="Feedback"
        copy="Tell us about your experience and see all feedback you have submitted."
      />
      <form className="surface customer-feedback-form" onSubmit={submit}>
        <div className="customer-feedback-heading">
          <MessageSquareText size={20} />
          <strong>Share your experience</strong>
        </div>
        {error && (
          <p role="alert" className="customer-feedback-error">
            {error}
          </p>
        )}
        {success && (
          <p role="status" className="customer-feedback-success">
            <CheckCircle2 size={16} />
            {success}
          </p>
        )}
        <div className="customer-feedback-fields">
          <label>
            About
            <select
              className="form-control"
              value={form.subject}
              disabled={loading || busy}
              onChange={(e) => change("subject", e.target.value)}
            >
              <option value="GENERAL">General feedback (private)</option>
              {targets.map((t) => (
                <option
                  key={`${t.subjectKind}:${t.subjectId}`}
                  value={`${t.subjectKind}:${t.subjectId}`}
                >
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Category
            <select
              className="form-control"
              value={form.category}
              onChange={(e) => change("category", e.target.value)}
              disabled={busy}
            >
              {categories.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label>
            Rating
            <select
              className="form-control"
              value={form.rating}
              onChange={(e) => change("rating", Number(e.target.value))}
              disabled={busy}
            >
              {[5, 4, 3, 2, 1].map((n) => (
                <option key={n} value={n}>
                  {n} / 5 stars
                </option>
              ))}
            </select>
          </label>
          <label className="customer-feedback-comment">
            Your comments
            <textarea
              className="form-control"
              rows={5}
              maxLength={2000}
              minLength={5}
              required
              value={form.comment}
              disabled={busy}
              onChange={(e) => change("comment", e.target.value)}
              placeholder="Tell us what went well and what we could improve."
            />
            <small>{form.comment.length}/2000 characters</small>
          </label>
        </div>
        {form.subject !== "GENERAL" && (
          <label className="customer-feedback-permission">
            <input
              type="checkbox"
              checked={form.allowPublicReview}
              onChange={(e) => change("allowPublicReview", e.target.checked)}
              disabled={busy}
            />
            <span>
              <strong>Allow this review on our public website</strong>
              <small>
                Only your first name and last initial, rating, comment and
                review category will be shown. You can withdraw permission
                later.
              </small>
            </span>
          </label>
        )}
        <p className="customer-feedback-hint">
          General feedback is private. Only completed orders and services can be
          published as verified reviews.
        </p>
        <button
          type="submit"
          className="btn btn-dark customer-feedback-submit"
          disabled={busy || loading}
        >
          <Send size={17} />
          {busy ? "Sending…" : "Submit Feedback"}
        </button>
      </form>
      <section className="customer-feedback-history">
        <div className="customer-feedback-history-title">
          <h2>My feedback</h2>
          <button
            className="customer-feedback-refresh"
            type="button"
            disabled={loading || busy}
            onClick={() => setRevision((n) => n + 1)}
          >
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>
        {loading ? (
          <p className="customer-feedback-state">Loading feedback…</p>
        ) : history.length === 0 ? (
          <p className="surface customer-feedback-empty">
            You haven't submitted feedback yet. Your reviews will appear here.
          </p>
        ) : (
          <div className="customer-feedback-list">
            {history.map((item) => (
              <article className="surface customer-feedback-card" key={item.id}>
                <div className="customer-feedback-card-top">
                  <strong>{item.category}</strong>
                  <span
                    className="customer-feedback-stars"
                    aria-label={`${item.rating} out of 5 stars`}
                  >
                    {stars(item.rating)}
                  </span>
                </div>
                <p>{item.comment}</p>
                <div className="customer-feedback-card-bottom">
                  <span>{item.subjectLabel}</span>
                  <time>{item.createdAt}</time>
                </div>
                {item.canPublish && (
                  <div className="customer-feedback-privacy">
                    <span>
                      {item.allowPublicReview
                        ? "Shared publicly"
                        : "Private review"}
                    </span>
                    <button
                      type="button"
                      onClick={() => visibility(item)}
                      disabled={changing !== null || busy}
                    >
                      {changing === item.id
                        ? "Saving…"
                        : item.allowPublicReview
                          ? "Make private"
                          : "Share publicly"}
                    </button>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
