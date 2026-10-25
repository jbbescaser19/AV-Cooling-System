import { useState } from "react";
import { Star } from "lucide-react";

import CustomerPageHeader from "../../components/customer/CustomerPageHeader";
import { loadMock, saveMock, uid } from "../../utils/prototypeStore";

export default function FeedbackPage() {
  const [category, setCategory] = useState("Service Quality");
  const [rating, setRating] = useState("5");
  const [comment, setComment] = useState("");

  const [history, setHistory] = useState(() =>
    loadMock("av_customer_feedback", []),
  );

  const submit = () => {
    if (!comment.trim()) {
      window.alert("Please enter your feedback.");
      return;
    }

    const record = {
      id: uid("FB"),
      category,
      rating: Number(rating),
      comment: comment.trim(),
      date: new Date().toLocaleDateString("en-PH"),
    };

    const nextHistory = [record, ...history];

    setHistory(nextHistory);
    saveMock("av_customer_feedback", nextHistory);
    setComment("");

    window.alert("Feedback submitted.");
  };

  return (
    <div className="customer-module">
      <CustomerPageHeader
        Icon={Star}
        title="Feedback"
        copy="Send feedback after an order or service and view your submissions."
      />

      <section className="surface customer-form-card">
        <label>
          Category
          <select
            className="form-control"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
          >
            <option>Service Quality</option>
            <option>Installation</option>
            <option>Product Quality</option>
            <option>Communication</option>
            <option>Pricing</option>
          </select>
        </label>

        <label>
          Rating
          <select
            className="form-control"
            value={rating}
            onChange={(event) => setRating(event.target.value)}
          >
            <option value="5">5 - Excellent</option>
            <option value="4">4 - Good</option>
            <option value="3">3 - Average</option>
            <option value="2">2 - Poor</option>
            <option value="1">1 - Very Poor</option>
          </select>
        </label>

        <label>
          Comment
          <textarea
            className="form-control"
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            placeholder="Tell us about your experience"
          />
        </label>

        <button type="button" className="btn btn-dark" onClick={submit}>
          Submit Feedback
        </button>
      </section>

      {history.length > 0 && (
        <div className="customer-record-list customer-history">
          {history.map((item) => (
            <article className="surface customer-record" key={item.id}>
              <div>
                <strong>
                  {item.category} · {item.rating}/5
                </strong>

                <span>{item.comment}</span>
              </div>

              <small>{item.date}</small>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
