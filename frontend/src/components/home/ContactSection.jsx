import { Link } from "react-router-dom";

import {
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  MapPin,
  MessageCircle,
  PhoneCall,
  Snowflake,
} from "lucide-react";

import { businessProfile } from "../../data/businessProfile";

import "../../styles/home/contact.css";

/* ==========================================
   SAFE MESSENGER LINK
========================================== */

function getMessengerUrl(messengerLink, facebookPageLink) {
  const allowedMessengerHosts = new Set(["m.me", "www.m.me"]);

  const allowedFacebookHosts = new Set([
    "facebook.com",
    "www.facebook.com",
    "m.facebook.com",
  ]);

  try {
    const url = new URL(String(messengerLink || "").trim());

    const hostname = url.hostname.toLowerCase();

    if (url.protocol !== "https:" || url.username || url.password) {
      return null;
    }

    // Standard direct Messenger link.
    if (
      allowedMessengerHosts.has(hostname) &&
      /^\/[a-zA-Z0-9._-]{2,100}\/?$/.test(url.pathname) &&
      !url.search &&
      !url.hash
    ) {
      return url.href;
    }

    // Direct Facebook Messages conversation.
    // Supports the business-provided format:
    // facebook.com/messages/t/123456789
    if (
      allowedFacebookHosts.has(hostname) &&
      /^\/messages\/t\/[1-9]\d*\/?$/.test(url.pathname) &&
      !url.search &&
      !url.hash
    ) {
      return url.href;
    }
  } catch {
    // Fall back to a supported Page username.
  }

  // Optional fallback when the business has
  // a public Facebook Page username.

  try {
    const page = new URL(String(facebookPageLink || "").trim());

    const hostname = page.hostname.toLowerCase();

    const match = page.pathname.match(/^\/([a-zA-Z0-9._-]{2,100})\/?$/);

    const reserved = new Set([
      "share",
      "pages",
      "groups",
      "people",
      "events",
      "watch",
      "reel",
      "marketplace",
      "messages",
      "login",
      "help",
      "photo",
      "photos",
    ]);

    if (
      page.protocol === "https:" &&
      allowedFacebookHosts.has(hostname) &&
      match &&
      !reserved.has(match[1].toLowerCase()) &&
      !page.search &&
      !page.hash &&
      !page.username &&
      !page.password
    ) {
      return `https://m.me/${match[1]}`;
    }
  } catch {
    // No supported Page URL available.
  }

  return null;
}

/* ==========================================
   GOOGLE MAPS LINK
========================================== */

function getMapsUrl(verifiedLink, address) {
  try {
    const url = new URL(String(verifiedLink || "").trim());

    const trustedHosts = new Set([
      "google.com",
      "www.google.com",
      "maps.google.com",
      "maps.app.goo.gl",
    ]);

    if (
      url.protocol === "https:" &&
      trustedHosts.has(url.hostname.toLowerCase()) &&
      !url.username &&
      !url.password
    ) {
      return url.href;
    }
  } catch {
    // Use Google Maps address search.
  }

  return (
    "https://www.google.com/maps/search/" +
    "?api=1&query=" +
    encodeURIComponent(address)
  );
}

/* ==========================================
   PHONE LINKS
========================================== */

function getPhoneLink(phone) {
  const digits = String(phone).replace(/\D/g, "");

  const number = digits.startsWith("0")
    ? `+63${digits.slice(1)}`
    : `+${digits}`;

  return `tel:${number}`;
}

/* ==========================================
   CONTACT SECTION
========================================== */

export default function ContactSection() {
  const messengerUrl = getMessengerUrl(
    businessProfile.messengerUrl,
    businessProfile.facebookUrl,
  );

  const mapsUrl = getMapsUrl(businessProfile.mapsUrl, businessProfile.address);

  return (
    <section
      className="section contact-section"
      id="contact"
      aria-labelledby="contact-heading"
    >
      <div className="container contact-container">
        {/* INTRODUCTION AND MAIN ACTION */}

        <div className="contact-top">
          <div className="contact-intro">
            <div className="contact-kicker">
              <Snowflake size={15} aria-hidden="true" />
              Contact our team
            </div>

            <h2 id="contact-heading">
              Great cooling starts with <span>a conversation.</span>
            </h2>

            <p className="contact-description">
              Need help choosing an air conditioner, requesting a quotation, or
              asking about installation and repairs? We're here to help.
            </p>

            <div className="contact-topics" aria-label="What we can help with">
              <span>
                <CheckCircle2 size={15} aria-hidden="true" />
                Product advice
              </span>

              <span>
                <CheckCircle2 size={15} aria-hidden="true" />
                Installation
              </span>

              <span>
                <CheckCircle2 size={15} aria-hidden="true" />
                Repairs &amp; service
              </span>
            </div>
          </div>

          {/* MESSENGER CONTACT CARD */}

          <div className="contact-chat-card">
            <div className="contact-chat-icon" aria-hidden="true">
              <MessageCircle size={25} strokeWidth={2.1} />
            </div>

            <span className="contact-chat-label">
              Need Help? We're Just a Message Away! 💬
            </span>

            <h3>Chat with AV Cooling</h3>

            <p>
              Have questions about our air conditioning products or services?
              Chat with us directly on Facebook Messenger for quick and friendly
              assistance!
            </p>

            {messengerUrl ? (
              <a
                className="contact-messenger-button"
                href={messengerUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Message AV Cooling System on Messenger (opens in a new tab)"
              >
                <MessageCircle size={19} aria-hidden="true" />

                <span>Message Us on Messenger</span>

                <ArrowUpRight size={19} aria-hidden="true" />
              </a>
            ) : (
              <>
                <a
                  className={
                    "contact-messenger-button " + "contact-messenger-fallback"
                  }
                  href={getPhoneLink(businessProfile.phones[0])}
                >
                  <PhoneCall size={19} aria-hidden="true" />

                  <span>Call Us Instead</span>

                  <ArrowUpRight size={19} aria-hidden="true" />
                </a>

                <p className="contact-chat-unavailable" role="status">
                  Messenger is currently unavailable. You can call our team
                  instead.
                </p>
              </>
            )}

            <span className="contact-chat-footnote">
              {messengerUrl
                ? "Opens your conversation in Facebook or Messenger."
                : "Please use our phone numbers for inquiries."}
            </span>
          </div>
        </div>

        {/* CONTACT DETAILS */}

        <div
          className="contact-details"
          aria-label="Other ways to contact AV Cooling"
        >
          {/* PHONE NUMBERS */}

          <div className="contact-detail-item">
            <div className="contact-detail-icon" aria-hidden="true">
              <PhoneCall size={19} />
            </div>

            <div className="contact-detail-body">
              <h3>Give us a call</h3>

              <p>Talk to our team directly.</p>

              <div className="contact-phone-links">
                {businessProfile.phones.map((phone) => (
                  <a key={phone} href={getPhoneLink(phone)}>
                    {phone}
                  </a>
                ))}
              </div>
            </div>
          </div>

          {/* LOCATION */}

          <div className="contact-detail-item">
            <div className="contact-detail-icon" aria-hidden="true">
              <MapPin size={19} />
            </div>

            <div className="contact-detail-body">
              <h3>Find our location</h3>

              <p>{businessProfile.address}</p>

              <a
                className="contact-detail-action"
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Find AV Cooling System on Google Maps (opens in a new tab)"
              >
                View on Google Maps
                <ArrowUpRight size={15} aria-hidden="true" />
              </a>
            </div>
          </div>

          {/* BUSINESS HOURS */}

          <div className="contact-detail-item">
            <div className="contact-detail-icon" aria-hidden="true">
              <Clock3 size={19} />
            </div>

            <div className="contact-detail-body">
              <h3>Business hours</h3>

              <p>{businessProfile.hours}</p>

              <span className="contact-hours-note">
                Messages outside business hours may be answered the next working
                day.
              </span>
            </div>
          </div>
        </div>

        {/* WEBSITE TRANSACTION LINKS */}

        <div className="contact-bottom-note">
          Ready to place an order or book a service?
          <Link to="/shop">Browse air conditioners</Link>
          <span aria-hidden="true">·</span>
          <Link to="/services">Explore services</Link>
        </div>
      </div>
    </section>
  );
}
