import { useState } from "react";
import { Bell } from "lucide-react";

import CustomerPageHeader from "../../components/customer/CustomerPageHeader";
import { seedNotices } from "../../data/customerAccountMockData";
import { loadMock, saveMock } from "../../utils/prototypeStore";

export default function NotificationsPage() {
  const [items, setItems] = useState(() =>
    loadMock("av_customer_notifications", seedNotices),
  );

  const save = (nextItems) => {
    setItems(nextItems);
    saveMock("av_customer_notifications", nextItems);
  };

  return (
    <div className="customer-module">
      <div className="customer-module-action-head">
        <CustomerPageHeader
          Icon={Bell}
          title="Notifications"
          copy="Order, payment, service, and promotional updates."
        />

        <button
          type="button"
          className="btn btn-soft"
          onClick={() => save(items.map((item) => ({ ...item, read: true })))}
        >
          Mark all read
        </button>
      </div>

      <div className="customer-notice-list">
        {items.map((notice) => (
          <article
            className={`surface customer-notice ${notice.read ? "" : "unread"}`}
            key={notice.id}
          >
            <Bell size={17} />

            <div>
              <strong>{notice.title}</strong>
              <p>{notice.text}</p>
              <small>{notice.time}</small>
            </div>

            {!notice.read && (
              <button
                type="button"
                className="customer-mini-action"
                onClick={() =>
                  save(
                    items.map((item) =>
                      item.id === notice.id ? { ...item, read: true } : item,
                    ),
                  )
                }
              >
                Mark read
              </button>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}
