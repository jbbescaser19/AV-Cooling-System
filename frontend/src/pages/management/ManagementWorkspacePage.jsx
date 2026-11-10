import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  AlertCircle,
  ArrowUpRight,
  ChevronRight,
  ClipboardList,
  Download,
  MinusCircle,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  TrendingUp,
  X,
} from "lucide-react";

import api from "../../../api/api.js";
import AvailabilityPicker from "../../components/scheduling/AvailabilityPicker";
import TechnicianTeamPicker from "../../components/management/TechnicianTeamPicker";
import SourceTeamPanel from "../../components/management/SourceTeamPanel";
import { getStaff } from "../../utils/authMock";
import { workspaceConfig } from "../../data/managementWorkspaceConfig.js";
import "../../styles/management/workspace.css";
import "../../styles/management/schedule-availability.css";

function show(value, key) {
  if (value === null || value === undefined || value === "") return "—";
  if (key === "publicReview" || key === "isRead") {
    return Number(value) === 1 || value === true ? "Yes" : "No";
  }
  if (
    ["startingPrice", "srp", "promoPrice", "price", "revenue"].includes(key)
  ) {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
    }).format(Number(value));
  }
  if (key === "createdAt" || key === "lastLogin") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("en-PH");
  }
  return String(value);
}

function normalizedSentiment(value) {
  const text = String(value || "").toUpperCase();
  if (text.startsWith("POSITIVE")) return "POSITIVE";
  if (text.startsWith("NEGATIVE")) return "NEGATIVE";
  if (text.startsWith("NEUTRAL")) return "NEUTRAL";
  return "NOT_ANALYZED";
}

function SentimentSummary({ feedback, loading }) {
  const counts = { POSITIVE: 0, NEUTRAL: 0, NEGATIVE: 0, NOT_ANALYZED: 0 };
  feedback.forEach((item) => {
    counts[normalizedSentiment(item.sentiment)] += 1;
  });

  const groups = [
    {
      key: "POSITIVE",
      name: "Positive",
      description: "Mostly satisfied feedback",
    },
    {
      key: "NEUTRAL",
      name: "Neutral",
      description: "Mixed or unclear feedback",
    },
    {
      key: "NEGATIVE",
      name: "Negative",
      description: "Feedback that needs attention",
    },
  ];

  return (
    <section
      className="wsm-sentiment-panel"
      aria-labelledby="wsm-sentiment-heading"
    >
      <div className="wsm-sentiment-heading">
        <div>
          <span className="wsm-sentiment-eyebrow">
            Automatic feedback classification
          </span>
          <h2 id="wsm-sentiment-heading">Feedback Sentiment Analysis</h2>
          <p>
            Estimated using the customer's rating and English/Filipino comment
            keywords. Read the original feedback before making decisions.
          </p>
        </div>
        <span className="wsm-sentiment-total">
          {feedback.length} recent feedback records
        </span>
      </div>
      <div className="wsm-sentiment-grid">
        {groups.map((group) => (
          <div
            className={`wsm-sentiment-card wsm-sentiment-card--${group.key.toLowerCase()}`}
            key={group.key}
          >
            <span className="wsm-sentiment-card-name">{group.name}</span>
            <strong>{counts[group.key]}</strong>
            <small>{group.description}</small>
          </div>
        ))}
      </div>
      {loading ? (
        <p className="wsm-sentiment-note" role="status">
          Loading feedback sentiment from MySQL…
        </p>
      ) : feedback.length === 0 ? (
        <p className="wsm-sentiment-note">
          No customer feedback yet. When a customer submits feedback, its
          estimated sentiment will appear here automatically.
        </p>
      ) : counts.NOT_ANALYZED > 0 ? (
        <p className="wsm-sentiment-note">
          {counts.NOT_ANALYZED} older record(s) have no estimated label. New
          feedback is classified when submitted.
        </p>
      ) : (
        <p className="wsm-sentiment-note">
          All {feedback.length} displayed feedback records have estimated
          sentiment labels. These labels may be inaccurate.
        </p>
      )}
    </section>
  );
}

function makeForm(fields = [], row = null) {
  return Object.fromEntries(
    fields.map((field) => {
      let value = row?.[field.key];
      if (field.key === "isRead" && value !== undefined) {
        value = Boolean(value) ? "true" : "false";
      }
      if (
        field.key === "status" &&
        field.choices &&
        !field.choices.includes(value)
      ) {
        value = field.choices[0];
      }
      return [
        field.key,
        value ??
          (field.nullable
            ? ""
            : field.type === "number"
              ? 0
              : field.choices?.[0] || ""),
      ];
    }),
  );
}

function prepare(fields, form) {
  return Object.fromEntries(
    fields.map((field) => {
      let value = form[field.key];
      if (field.type === "number") {
        value = value === "" && field.nullable ? null : Number(value);
      }
      if (field.type === "reference") {
        value = value === "" && field.nullable ? null : Number(value);
      }
      if (field.key === "isRead") {
        value = value === "true" || value === true;
      }
      return [field.key, value];
    }),
  );
}

function ExportButton({ columns, items, slug }) {
  function download() {
    const csv = [
      columns.map(([, label]) => label),
      ...items.map((item) => columns.map(([key]) => show(item[key], key))),
    ]
      .map((row) =>
        row
          .map((cell) => {
            const value = String(cell);
            return `"${(/^\s*[=+\-@]/.test(value) ? "'" : "") + value.replaceAll('"', '""')}"`;
          })
          .join(","),
      )
      .join("\r\n");

    const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `av-cooling-${slug}-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <button
      type="button"
      className="wsm-secondary"
      onClick={download}
      disabled={!items.length}
    >
      <Download size={16} aria-hidden="true" /> Export CSV
    </button>
  );
}

function InputField({
  field,
  value,
  onChange,
  options,
  form,
  disabled,
  module,
}) {
  if (
    module === "schedules" &&
    ["reason", "startTime", "endTime"].includes(field.key) &&
    form.status !== "OFF"
  )
    return null;
  if (field.key === "variantId" && form.requestKind === "SERVICE") return null;
  if (field.key === "serviceTypeId" && form.requestKind === "AIRCON")
    return null;
  if (field.key === "quantity" && form.requestKind === "SERVICE") return null;

  const needsServiceAircon = form.requestKind === "SERVICE";
  if (
    ["airconBrand", "airconModel", "airconHp"].includes(field.key) &&
    !needsServiceAircon
  ) {
    return null;
  }
  const required =
    field.required ||
    (needsServiceAircon &&
      ["airconBrand", "airconModel", "airconHp"].includes(field.key));

  if (
    field.key === "technicianId" &&
    form.status !== "ASSIGNED" &&
    field.type === "reference" &&
    form.status
  ) {
    return null;
  }
  if (
    field.key === "scheduledStart" &&
    form.status !== "RESCHEDULE" &&
    form.status
  ) {
    return null;
  }

  const group =
    field.key === "sourceId"
      ? form.sourceType === "SERVICE_REQUEST"
        ? "requests"
        : "orders"
      : field.optionGroup;
  const choices =
    field.type === "reference" ? options[group] || [] : field.choices || [];

  if (field.type === "datetime-local" && field.key === "scheduledStart") {
    return (
      <div className="wsm-field" style={{ gridColumn: "1 / -1" }}>
        <AvailabilityPicker
          value={value || ""}
          onChange={(selected) => onChange(field.key, selected)}
          disabled={disabled}
          allowExistingValue={Boolean(value)}
          label={field.label}
        />
      </div>
    );
  }
  return (
    <label className="wsm-field">
      <span>
        {field.label}
        {required && <i aria-label="Required"> *</i>}
      </span>
      {field.type === "textarea" ? (
        <textarea
          rows={3}
          maxLength={field.maxLength || 2000}
          required={required}
          disabled={disabled}
          value={value ?? ""}
          onChange={(event) => onChange(field.key, event.target.value)}
        />
      ) : field.type === "reference" || field.type === "select" ? (
        <select
          required={required}
          disabled={disabled}
          value={value ?? ""}
          onChange={(event) => onChange(field.key, event.target.value)}
        >
          {(field.type === "reference" || field.nullable) && (
            <option value="">{required ? "Choose an option" : "None"}</option>
          )}
          {choices.map((option) =>
            typeof option === "string" ? (
              <option key={option} value={option}>
                {option.replaceAll("_", " ")}
              </option>
            ) : (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ),
          )}
        </select>
      ) : (
        <input
          type={
            field.type === "datetime-local"
              ? "datetime-local"
              : field.type || "text"
          }
          required={required}
          disabled={disabled}
          value={value ?? ""}
          min={field.min}
          max={field.max}
          step={field.step}
          maxLength={field.maxLength || undefined}
          autoComplete={field.type === "password" ? "new-password" : undefined}
          onChange={(event) => onChange(field.key, event.target.value)}
        />
      )}
    </label>
  );
}

function Editor({
  module,
  mode,
  intent,
  presetVariantId,
  inventoryRows,
  row,
  options,
  onClose,
  onSuccess,
}) {
  const config = workspaceConfig[module];
  const isNew = mode === "create";
  const isStockIn = module === "inventory" && isNew && intent === "stock-in";

  const fields = (config[mode] || [])
    .map((field) => {
      if (
        module === "facebook-requests" &&
        mode === "update" &&
        field.key === "action"
      ) {
        return {
          ...field,
          choices:
            row?.status === "PENDING"
              ? ["CONFIRM", "CANCEL"]
              : row?.status === "CONFIRMED"
                ? ["CONVERT", "CANCEL"]
                : [],
        };
      }
      if (isStockIn && field.key === "quantity") {
        return {
          ...field,
          label: "How many units to add?",
          min: 1,
          max: 100000,
          step: 1,
        };
      }
      return field;
    })
    .filter((field) => !(isStockIn && field.key === "movementType"));

  const [form, setForm] = useState(() => ({
    ...makeForm(fields, row),
    ...(isStockIn
      ? {
          variantId: presetVariantId ? String(presetVariantId) : "",
          quantity: 1,
          note: "",
        }
      : {}),
  }));
  const [technicianIds, setTechnicianIds] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const dialogRef = useRef(null);

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === "Escape" && !saving) onClose();
    }
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);
    dialogRef.current?.focus();
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, saving]);

  function update(key, value) {
    setForm((prev) => ({
      ...prev,
      [key]: value,
      ...(key === "requestKind"
        ? { variantId: "", serviceTypeId: "", quantity: 1 }
        : {}),
      ...(key === "sourceType" ? { sourceId: "" } : {}),
    }));
    setError("");
  }

  const selectedInventory = isStockIn
    ? inventoryRows.find((item) => String(item.id) === String(form.variantId))
    : null;
  const addedQuantity = Number(form.quantity);
  const canPreviewStock =
    selectedInventory &&
    Number.isSafeInteger(addedQuantity) &&
    addedQuantity > 0;

  async function submit(event) {
    event.preventDefault();
    if (saving) return;

    if (
      module === "facebook-requests" &&
      !window.confirm(
        "Save this manually entered Messenger agreement? Check all customer details first.",
      )
    )
      return;

    if (
      !isNew &&
      ["customers", "staff", "facebook-requests"].includes(module) &&
      !window.confirm("Confirm this management action?")
    )
      return;

    if (
      isStockIn &&
      !window.confirm(
        `Add ${form.quantity} unit(s) to ${selectedInventory?.name || "the selected product"}?`,
      )
    )
      return;

    setSaving(true);
    setError("");
    try {
      const payload = prepare(fields, form);
      if (module === "schedules") {
        if (
          isNew &&
          (!Number.isSafeInteger(Number(payload.technicianId)) ||
            Number(payload.technicianId) < 1)
        ) {
          setError("Choose a technician before saving a schedule.");
          setSaving(false);
          return;
        }
        if (payload.status !== "OFF") {
          payload.reason = "";
          payload.startTime = "";
          payload.endTime = "";
        }
        if (
          payload.status === "OFF" &&
          String(payload.reason || "").trim().length < 3
        ) {
          setError("Enter why the technician is unavailable.");
          setSaving(false);
          return;
        }
      }
      if (isStockIn) payload.movementType = "STOCK_IN";
      if (
        module === "facebook-requests" &&
        !isNew &&
        form.action === "CONVERT"
      ) {
        payload.technicianIds = technicianIds;
      }
      if (module === "facebook-requests" && isNew) {
        payload.variantId =
          payload.requestKind === "AIRCON" ? payload.variantId : null;
        payload.serviceTypeId =
          payload.requestKind === "SERVICE" ? payload.serviceTypeId : null;
        payload.quantity =
          payload.requestKind === "AIRCON" ? payload.quantity : 1;
      }

      const endpoint = `/api/management/workspace/${encodeURIComponent(module)}`;
      const response = isNew
        ? await api.post(endpoint, payload)
        : await api.patch(`${endpoint}/${row.id}`, payload);
      if (!response.data?.success)
        throw new Error("The server did not confirm this change.");
      onSuccess(
        response.data.message ||
          (isStockIn ? "Stock added successfully." : "Saved successfully."),
        response.data,
      );
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          requestError.message ||
          "Could not save your changes.",
      );
    } finally {
      setSaving(false);
    }
  }

  const heading = isStockIn
    ? `Add Stock${selectedInventory ? ` · ${selectedInventory.name}` : ""}`
    : isNew
      ? config.createLabel || `Add ${config.title}`
      : `Update ${config.title}`;

  return (
    <div
      className="wsm-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !saving) onClose();
      }}
    >
      <section
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="wsm-dialog-title"
        className="wsm-dialog"
      >
        <div className="wsm-dialog-head">
          <div>
            <small>{config.title}</small>
            <h2 id="wsm-dialog-title">{heading}</h2>
          </div>
          <button
            type="button"
            className="wsm-close"
            onClick={onClose}
            aria-label="Close"
            disabled={saving}
          >
            <X size={19} />
          </button>
        </div>
        <form onSubmit={submit} className="wsm-form">
          {isStockIn && (
            <p className="wsm-info">
              <Plus size={17} aria-hidden="true" />
              Enter <strong>1</strong> to add one unit, or <strong>100</strong>{" "}
              to add one hundred. This increases the current stock and saves a
              Stock Movement record.
            </p>
          )}
          {module === "facebook-requests" && (
            <p className="wsm-info">
              <ShieldCheck size={17} />
              Staff must enter only details genuinely agreed on Messenger.
            </p>
          )}
          {fields.map((field) => (
            <InputField
              module={module}
              key={field.key}
              field={field}
              value={form[field.key]}
              onChange={update}
              options={options}
              form={form}
              disabled={saving}
            />
          ))}
          {module === "facebook-requests" &&
            !isNew &&
            form.action === "CONVERT" && (
              <TechnicianTeamPicker
                value={technicianIds}
                onChange={setTechnicianIds}
                disabled={saving}
              />
            )}
          {isStockIn && canPreviewStock && (
            <div className="wsm-stock-preview" role="status">
              <span>Stock after addition (if no other changes occur)</span>
              <strong>
                {Number(selectedInventory.onHand)} + {addedQuantity} ={" "}
                {Number(selectedInventory.onHand) + addedQuantity} units
              </strong>
            </div>
          )}
          {error && (
            <p className="wsm-error" role="alert">
              <AlertCircle size={16} />
              {error}
            </p>
          )}
          <div className="wsm-form-actions">
            <button
              type="button"
              className="wsm-secondary"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>
            <button type="submit" className="wsm-primary" disabled={saving}>
              {saving
                ? "Saving…"
                : isStockIn
                  ? "Confirm Add Stock"
                  : "Save changes"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

export default function ManagementWorkspacePage({ module }) {
  const config = workspaceConfig[module];
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [options, setOptions] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [search, setSearch] = useState("");
  const [editor, setEditor] = useState(null);
  const [teamSource, setTeamSource] = useState(null);
  const [reload, setReload] = useState(0);

  const staff = getStaff();
  const ownerOrManager = ["OWNER", "MANAGER"].includes(staff?.role);
  const writable =
    ownerOrManager ||
    (["notifications", "facebook-requests"].includes(module) &&
      ["SALES_CASHIER", "TECHNICIAN"].includes(staff?.role) &&
      (module === "notifications" || staff.role === "SALES_CASHIER"));

  const writableCreate =
    writable &&
    ![
      "variants",
      "customers",
      "feedback",
      "notifications",
      "audit-logs",
      "reports",
      "stock-movements",
    ].includes(module) &&
    staff?.role !== "TECHNICIAN";

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");

    api
      .get(`/api/management/workspace/${encodeURIComponent(module)}`, {
        signal: controller.signal,
      })
      .then(({ data }) => {
        if (!controller.signal.aborted) {
          setItems(data.items || []);
          setOptions(data.options || {});
        }
      })
      .catch((requestError) => {
        if (!controller.signal.aborted) {
          setItems([]);
          setError(
            requestError.response?.data?.message ||
              "Could not load records from MySQL.",
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [module, reload]);

  const filtered = useMemo(
    () =>
      items.filter((item) =>
        Object.values(item).some(
          (value) =>
            value !== null &&
            value !== undefined &&
            String(value).toLowerCase().includes(search.trim().toLowerCase()),
        ),
      ),
    [items, search],
  );

  if (!config) return <p>Unknown management module.</p>;

  function complete(message, result = {}) {
    setEditor(null);
    setSuccess(message);
    setReload((count) => count + 1);
    window.dispatchEvent(new Event("av-management-updated"));

    // A converted agreement now opens the REAL record it created.
    if (module === "facebook-requests") {
      if (
        Number.isSafeInteger(Number(result.convertedOrderId)) &&
        Number(result.convertedOrderId) > 0
      ) {
        navigate(`/management/orders?orderId=${result.convertedOrderId}`);
      } else if (
        Number.isSafeInteger(Number(result.convertedServiceRequestId)) &&
        Number(result.convertedServiceRequestId) > 0
      ) {
        navigate(
          `/management/service-requests?requestId=${result.convertedServiceRequestId}`,
        );
      }
    }
  }

  function openStock(variantId = null) {
    setEditor({ mode: "create", intent: "stock-in", variantId });
  }

  return (
    <div className="wsm-page">
      <header className="wsm-head">
        <div>
          <span className="wsm-kicker">AV COOLING · MANAGEMENT</span>
          <h1>
            {module === "feedback" ? "Feedback & Sentiment" : config.title}
          </h1>
          <p>{config.description}</p>
        </div>
        <div className="wsm-top-actions">
          <button
            type="button"
            className="wsm-secondary"
            onClick={() => setReload((n) => n + 1)}
            disabled={loading}
          >
            <RefreshCw size={17} aria-hidden="true" /> Refresh
          </button>
          {module === "inventory" && writableCreate ? (
            <>
              <button
                type="button"
                className="wsm-primary"
                onClick={() => openStock()}
              >
                <Plus size={17} aria-hidden="true" /> Add Stock
              </button>
              <button
                type="button"
                className="wsm-secondary"
                onClick={() =>
                  setEditor({ mode: "create", intent: "movement" })
                }
              >
                <MinusCircle size={17} aria-hidden="true" /> Other Movement
              </button>
            </>
          ) : writableCreate ? (
            <button
              type="button"
              className="wsm-primary"
              onClick={() => setEditor({ mode: "create" })}
            >
              <Plus size={17} aria-hidden="true" />
              {config.createLabel || "Add record"}
            </button>
          ) : null}
        </div>
      </header>

      {module === "products" && (
        <p className="wsm-info">
          <ChevronRight size={17} aria-hidden="true" />
          Adjust individual variant prices under
          <Link to="/management/variants">
            Product Variants &amp; Prices <ArrowUpRight size={15} />
          </Link>
          .
        </p>
      )}
      {module === "inventory" && (
        <p className="wsm-info">
          <Plus size={17} aria-hidden="true" />
          To receive 100 aircons, click <strong>Add Stock</strong> and enter
          100. To receive one, enter 1. Create a product and HP variant first if
          this list is empty. Stock changes appear in{" "}
          <Link to="/management/stock-movements">
            Stock Movements <ArrowUpRight size={15} />
          </Link>
          .
        </p>
      )}
      {module === "facebook-requests" && (
        <p className="wsm-info">
          <ChevronRight size={17} aria-hidden="true" />
          After confirming an agreement, choose Convert. Aircon sales then
          appear in Orders; service-only agreements appear in Service Requests.
          Assign the technician team directly in the corresponding record. Cash
          stays pending until collected.
        </p>
      )}
      {module === "feedback" && (
        <SentimentSummary feedback={items} loading={loading} />
      )}

      {error && (
        <p className="wsm-error" role="alert">
          <AlertCircle size={17} />
          {error}
        </p>
      )}
      {success && (
        <p className="wsm-success" role="status">
          <ShieldCheck size={17} />
          {success}
        </p>
      )}

      <section className="wsm-panel">
        <div className="wsm-table-head">
          <div>
            <h2>
              {module === "feedback"
                ? "Customer feedback records"
                : `${config.title} records`}
            </h2>
            <small>{filtered.length} shown, latest records first</small>
          </div>
          <div className="wsm-table-tools">
            <label className="wsm-search">
              <Search size={18} aria-hidden="true" />
              <input
                aria-label="Search records"
                placeholder="Search records…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
            <ExportButton
              items={filtered}
              columns={config.columns}
              slug={module}
            />
          </div>
        </div>

        {loading ? (
          <div className="wsm-empty" role="status">
            Loading records from MySQL…
          </div>
        ) : !filtered.length ? (
          <div className="wsm-empty">
            <ClipboardList size={27} aria-hidden="true" />
            <strong>
              {items.length ? "No matching results" : "No records yet"}
            </strong>
            <p>
              {items.length
                ? "Try a different search."
                : "New saved records will appear here. No sample data is shown."}
            </p>
          </div>
        ) : (
          <div className="wsm-overflow">
            <table className="wsm-table">
              <thead>
                <tr>
                  {config.columns.map(([field, label]) => (
                    <th key={field}>{label}</th>
                  ))}
                  {((config.update && writable) ||
                    module === "facebook-requests") && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => (
                  <tr
                    key={item.id}
                    className={
                      module === "schedules" && item.status === "OFF"
                        ? "schedule-unavailable-row"
                        : ""
                    }
                  >
                    {config.columns.map(([field]) => (
                      <td data-label={field} key={field}>
                        {field === "conversationUrl" && item[field] ? (
                          <a
                            className="wsm-external"
                            href={item[field]}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label="Open Messenger conversation in a new tab"
                          >
                            Open chat <ArrowUpRight size={15} />
                          </a>
                        ) : field === "sentiment" ? (
                          <span
                            className={`wsm-sentiment-label wsm-sentiment-label--${normalizedSentiment(item[field]).toLowerCase()}`}
                          >
                            {normalizedSentiment(item[field]) === "NOT_ANALYZED"
                              ? "Not analyzed"
                              : `${normalizedSentiment(item[field]).toLowerCase()} · estimated`}
                          </span>
                        ) : (
                          <span
                            className={
                              ["status", "paymentStatus"].includes(field)
                                ? "wsm-status"
                                : ""
                            }
                          >
                            {show(item[field], field)}
                          </span>
                        )}
                      </td>
                    ))}
                    {((config.update && writable) ||
                      module === "facebook-requests") && (
                      <td>
                        <div className="wsm-row-actions">
                          {module === "inventory" && (
                            <button
                              type="button"
                              className="wsm-primary wsm-row-action"
                              onClick={() => openStock(item.id)}
                            >
                              <Plus size={16} aria-hidden="true" /> Add Stock
                            </button>
                          )}
                          {module === "facebook-requests" &&
                            item.status === "CONVERTED" && (
                              <>
                                {item.convertedOrderId && (
                                  <Link
                                    className="wsm-primary wsm-row-action"
                                    to={`/management/orders?orderId=${item.convertedOrderId}`}
                                  >
                                    View Order{" "}
                                    <ArrowUpRight
                                      size={15}
                                      aria-hidden="true"
                                    />
                                  </Link>
                                )}
                                {item.convertedServiceRequestId && (
                                  <Link
                                    className="wsm-primary wsm-row-action"
                                    to={`/management/service-requests?requestId=${item.convertedServiceRequestId}`}
                                  >
                                    View Service{" "}
                                    <ArrowUpRight
                                      size={15}
                                      aria-hidden="true"
                                    />
                                  </Link>
                                )}
                                {ownerOrManager &&
                                  (item.convertedOrderId ||
                                    item.convertedServiceRequestId) && (
                                    <button
                                      type="button"
                                      className="wsm-primary wsm-row-action"
                                      onClick={() =>
                                        setTeamSource({
                                          kind: item.convertedOrderId
                                            ? "ORDER"
                                            : "SERVICE",
                                          id:
                                            item.convertedOrderId ||
                                            item.convertedServiceRequestId,
                                        })
                                      }
                                    >
                                      Assign / change team here
                                    </button>
                                  )}
                              </>
                            )}
                          {writable &&
                            !(
                              module === "facebook-requests" &&
                              ["CONVERTED", "CANCELLED"].includes(item.status)
                            ) && (
                              <button
                                type="button"
                                className="wsm-secondary wsm-row-action"
                                onClick={() =>
                                  setEditor({ mode: "update", row: item })
                                }
                              >
                                {module === "inventory"
                                  ? "Reorder level"
                                  : "Manage"}{" "}
                                <ChevronRight size={16} aria-hidden="true" />
                              </button>
                            )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {module === "facebook-requests" && (
        <p className="wsm-footnote">
          Staff must verify identity, stock, schedule and cash collection
          separately. Facebook messages are not automatically accessible.
        </p>
      )}
      {module === "feedback" && (
        <p className="wsm-footnote">
          New feedback receives an estimated sentiment automatically. Review the
          original comment and rating; negative reviews are never hidden just
          because they are negative.
        </p>
      )}
      {teamSource && module === "facebook-requests" && (
        <div
          className="wsm-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setTeamSource(null);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-label="Assign team for Facebook agreement"
            className="wsm-dialog"
            style={{ maxWidth: 640 }}
          >
            <div className="wsm-dialog-head">
              <h2>Assign technician team</h2>
              <button
                type="button"
                className="wsm-close"
                onClick={() => setTeamSource(null)}
                aria-label="Close team assignment"
              >
                <X size={18} />
              </button>
            </div>
            <div className="wsm-form">
              <p>
                Set or change the team for this converted Facebook agreement
                here.
              </p>
              <SourceTeamPanel
                key={`${teamSource.kind}-${teamSource.id}`}
                kind={teamSource.kind}
                sourceId={teamSource.id}
              />
              <button
                type="button"
                className="wsm-secondary"
                onClick={() => setTeamSource(null)}
              >
                Done
              </button>
            </div>
          </section>
        </div>
      )}
      {editor && (
        <Editor
          key={`${module}-${editor.mode}-${editor.intent || "default"}-${editor.variantId || editor.row?.id || "new"}`}
          module={module}
          mode={editor.mode}
          intent={editor.intent}
          presetVariantId={editor.variantId}
          inventoryRows={items}
          row={editor.row || null}
          options={options}
          onClose={() => setEditor(null)}
          onSuccess={complete}
        />
      )}
    </div>
  );
}
