import { useEffect, useRef, useState } from "react";
import api from "../../../api/api.js";

const PHONE_PATTERN = /^[+0-9 ()-]{7,30}$/;

export default function CheckoutPhoneSelector({
  value,
  onChange,
  disabled = false,
}) {
  const [savedPhone, setSavedPhone] = useState("");
  const [choice, setChoice] = useState("custom");
  const [customPhone, setCustomPhone] = useState(value || "");
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const userChangedChoice = useRef(false);

  useEffect(() => {
    const controller = new AbortController();

    async function loadSavedPhone() {
      try {
        const response = await api.get("/api/customer/account/profile", {
          signal: controller.signal,
        });

        if (controller.signal.aborted) return;

        if (!response.data?.success || !response.data?.user) {
          throw new Error("Unable to retrieve your saved phone number.");
        }

        const accountPhone = response.data.user.phone;
        const phone =
          typeof accountPhone === "string" ? accountPhone.trim() : "";

        if (PHONE_PATTERN.test(phone)) {
          setSavedPhone(phone);

          if (!userChangedChoice.current) {
            setChoice("saved");
            onChange(phone);
          }
        }
      } catch (error) {
        if (controller.signal.aborted) return;

        setNotice(
          "Your saved number could not be loaded. Enter a number for this order.",
        );
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    loadSavedPhone();

    return () => controller.abort();
  }, [onChange]);

  function changeChoice(nextChoice) {
    userChangedChoice.current = true;
    setChoice(nextChoice);

    onChange(nextChoice === "saved" ? savedPhone : customPhone);
  }

  function changeCustomPhone(nextPhone) {
    userChangedChoice.current = true;
    setCustomPhone(nextPhone);
    onChange(nextPhone);
  }

  const useCustomPhone = !savedPhone || choice === "custom";

  return (
    <div className="checkout-phone-selector">
      {savedPhone && (
        <label className="checkout-input-field" htmlFor="checkout-phone-choice">
          Contact number
          <select
            id="checkout-phone-choice"
            className="form-control"
            value={choice}
            onChange={(event) => changeChoice(event.target.value)}
            disabled={disabled}
          >
            <option value="saved">My saved number · {savedPhone}</option>

            <option value="custom">Use another number</option>
          </select>
        </label>
      )}

      {useCustomPhone && (
        <label className="checkout-input-field" htmlFor="checkout-custom-phone">
          {savedPhone ? "Different number for this order" : "Contact number"}

          <input
            id="checkout-custom-phone"
            className="form-control"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={customPhone}
            onChange={(event) => changeCustomPhone(event.target.value)}
            minLength={7}
            maxLength={30}
            pattern="[+0-9 \(\)\-]{7,30}"
            placeholder="09XXXXXXXXX"
            required
            disabled={disabled}
          />
        </label>
      )}

      {loading && (
        <p className="checkout-phone-hint" role="status">
          Checking your saved number…
        </p>
      )}

      {notice && (
        <p className="checkout-phone-hint" role="status">
          {notice}
        </p>
      )}

      <p className="checkout-phone-hint">
        This contact number is for this order only. Your account number won't
        change.
      </p>
    </div>
  );
}
