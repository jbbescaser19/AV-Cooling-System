import { useMemo, useState } from "react";
import {
  Minus,
  Plus,
  Search,
  ShoppingCart,
  Trash2,
  UserRound,
  Wrench,
  X,
  CheckCircle2,
  ReceiptText,
} from "lucide-react";
import { readCatalogProducts } from "../../utils/catalogStore";
import { notifications, serviceTypes, payments, stockMovements, serviceRequests, auditLogs } from "../../data/mockManagement";
import { getStaff } from "../../utils/authMock";
import {
  addManagementNotification,
  createPosOrderId,
  savePosOrder,
} from "../../utils/managementStore";
import { loadMock, saveMock, uid } from "../../utils/prototypeStore";

const money = (value) => `₱${Number(value || 0).toLocaleString("en-PH")}`;

export default function POSPage() {
  const staff = getStaff() || { name: "AV Staff", role: "SALES_CASHIER" };
  const [tab, setTab] = useState("products");
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState([]);
  const [selectedVariants, setSelectedVariants] = useState({});
  const [customerName, setCustomerName] = useState("Walk-in Customer");
  const [customerPhone, setCustomerPhone] = useState("");
  const [fulfillment, setFulfillment] = useState("Walk-in / Take-home");
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [cashReceived, setCashReceived] = useState("");
  const [reference, setReference] = useState("");
  const [discount, setDiscount] = useState(0);
  const [receipt, setReceipt] = useState(null);
  const [message, setMessage] = useState("");

  const sellableProducts = useMemo(
    () => readCatalogProducts().filter((product) => product.variants?.length),
    [],
  );

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sellableProducts;
    return sellableProducts.filter((product) =>
      `${product.brand} ${product.name} ${product.category}`.toLowerCase().includes(q),
    );
  }, [search, sellableProducts]);

  const filteredServices = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return serviceTypes;
    return serviceTypes.filter((service) =>
      `${service.name} ${service.category} ${service.description}`.toLowerCase().includes(q),
    );
  }, [search]);

  const subtotal = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  const safeDiscount = Math.max(0, Math.min(Number(discount) || 0, subtotal));
  const total = subtotal - safeDiscount;
  const received = Number(cashReceived) || 0;
  const change = paymentMethod === "Cash" ? Math.max(0, received - total) : 0;

  const canProcess =
    cart.length > 0 &&
    total >= 0 &&
    (paymentMethod !== "Cash" || received >= total) &&
    (paymentMethod === "Cash" || reference.trim().length > 0);

  const addProduct = (product) => {
    const selectedHp = selectedVariants[product.id] || product.variants[0].hp;
    const variant = product.variants.find((item) => item.hp === selectedHp) || product.variants[0];
    const key = `product:${product.id}:${variant.hp}`;

    setCart((items) => {
      const existing = items.find((item) => item.key === key);
      if (existing) {
        return items.map((item) =>
          item.key === key ? { ...item, qty: item.qty + 1 } : item,
        );
      }
      return [
        ...items,
        {
          key,
          type: "Product",
          id: product.id,
          name: product.name,
          detail: variant.hp,
          price: variant.price,
          qty: 1,
        },
      ];
    });
    setMessage(`${product.name} ${variant.hp} added to the current sale.`);
  };

  const addService = (service) => {
    const key = `service:${service.id}`;
    setCart((items) => {
      const existing = items.find((item) => item.key === key);
      if (existing) {
        return items.map((item) =>
          item.key === key ? { ...item, qty: item.qty + 1 } : item,
        );
      }
      return [
        ...items,
        {
          key,
          type: "Service",
          id: service.id,
          name: service.name,
          detail: service.duration,
          price: service.basePrice,
          qty: 1,
        },
      ];
    });
    setMessage(`${service.name} added to the current sale.`);
  };

  const changeQty = (key, amount) => {
    setCart((items) =>
      items
        .map((item) =>
          item.key === key ? { ...item, qty: Math.max(0, item.qty + amount) } : item,
        )
        .filter((item) => item.qty > 0),
    );
  };

  const removeItem = (key) => {
    setCart((items) => items.filter((item) => item.key !== key));
  };

  const resetSale = () => {
    setCart([]);
    setCustomerName("Walk-in Customer");
    setCustomerPhone("");
    setFulfillment("Walk-in / Take-home");
    setPaymentMethod("Cash");
    setCashReceived("");
    setReference("");
    setDiscount(0);
    setSearch("");
    setMessage("");
  };

  const processSale = () => {
    if (!canProcess) return;

    const hasService = cart.some((item) => item.type === "Service");
    const order = {
      id: createPosOrderId(),
      customer: customerName.trim() || "Walk-in Customer",
      phone: customerPhone.trim(),
      type: hasService ? "Walk-in + Service" : "Walk-in POS",
      source: "POS",
      fulfillment,
      total,
      subtotal,
      discount: safeDiscount,
      status: hasService ? "Processing" : "Completed",
      payment: "Paid",
      paymentMethod,
      paymentReference: paymentMethod === "Cash" ? "Cash" : reference.trim(),
      amountReceived: paymentMethod === "Cash" ? received : total,
      change,
      cashier: `${staff.name} · ${staff.role}`,
      createdAt: new Date().toLocaleString("en-PH", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }),
      items: cart.map((item) => ({ ...item })),
    };

    savePosOrder(order);

    // Keep the rest of the frontend prototype in sync with the POS transaction.
    const paymentRecords = loadMock("av_module_payments", payments);
    saveMock("av_module_payments", [
      {
        id: uid("PAY"),
        order: order.id,
        customer: order.customer,
        method: order.paymentMethod,
        amount: order.total,
        status: "Paid",
        date: order.createdAt,
      },
      ...paymentRecords,
    ]);

    const currentMovements = loadMock("av_module_stock-movements", stockMovements);
    const newMovements = order.items
      .filter((item) => item.type === "Product")
      .map((item) => ({
        id: uid("STM"),
        product: `${item.name} ${item.detail}`,
        type: "Stock Out",
        qty: item.qty,
        reference: order.id,
        user: staff.role,
        date: order.createdAt,
      }));
    if (newMovements.length) saveMock("av_module_stock-movements", [...newMovements, ...currentMovements]);

    const stockMap = loadMock("av_inventory_stock", {});
    order.items.filter((item) => item.type === "Product").forEach((item) => {
      const stockKey = `${item.id}:${item.detail}`;
      stockMap[stockKey] = Math.max(0, Number(stockMap[stockKey] ?? 10) - item.qty);
    });
    saveMock("av_inventory_stock", stockMap);

    const soldServices = order.items.filter((item) => item.type === "Service");
    if (soldServices.length) {
      const requests = loadMock("av_module_service-requests", serviceRequests);
      const createdRequests = soldServices.map((item) => ({
        id: uid("SR"),
        customer: order.customer,
        service: item.name,
        preferred: "To schedule",
        location: order.fulfillment,
        technician: "Unassigned",
        status: "Approved",
        source: order.id,
      }));
      saveMock("av_module_service-requests", [...createdRequests, ...requests]);
    }

    const logs = loadMock("av_module_audit-logs", auditLogs);
    saveMock("av_module_audit-logs", [{
      id: uid("LOG"),
      user: staff.role,
      action: "Completed walk-in sale",
      module: "POS",
      record: order.id,
      time: order.createdAt,
    }, ...logs]);

    addManagementNotification(
      {
        id: `NTF-${Date.now()}`,
        type: "POS",
        title: `Walk-in sale ${order.id} completed`,
        message: `${order.customer} paid ${money(order.total)} via ${order.paymentMethod}.`,
        time: "Just now",
        read: false,
        priority: "Normal",
      },
      notifications,
    );

    setReceipt(order);
    resetSale();
  };

  return (
    <>
      <div className="mgmt-page-head pos-page-head">
        <div>
          <h1>POS / Walk-in Sales</h1>
          <p>
            This is where the cashier processes walk-in purchases. Add products or services,
            collect payment, complete the sale, and generate a mock receipt/order record.
          </p>
        </div>
        <div className="pos-cashier-chip"><UserRound size={16}/>{staff.role}</div>
      </div>

      {message && <div className="pos-message"><CheckCircle2 size={16}/>{message}</div>}

      <div className="pos-layout pos-layout-full">
        <section className="mgmt-panel pos-catalog-panel">
          <div className="pos-catalog-toolbar">
            <div className="pos-tabs" role="tablist" aria-label="POS catalog type">
              <button type="button" className={tab === "products" ? "active" : ""} onClick={() => setTab("products")}>
                <ShoppingCart size={16}/> Products
              </button>
              <button type="button" className={tab === "services" ? "active" : ""} onClick={() => setTab("services")}>
                <Wrench size={16}/> Services
              </button>
            </div>

            <label className="pos-search">
              <Search size={16}/>
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={`Search ${tab}...`} />
            </label>
          </div>

          {tab === "products" ? (
            <div className="pos-product-grid">
              {filteredProducts.map((product) => {
                const selectedHp = selectedVariants[product.id] || product.variants[0].hp;
                const variant = product.variants.find((item) => item.hp === selectedHp) || product.variants[0];
                return (
                  <article className="pos-product-card" key={product.id}>
                    <div className="pos-product-brand">{product.brand}</div>
                    <h3>{product.name}</h3>
                    <p>{product.category}</p>
                    <label>
                      <span>Horsepower</span>
                      <select
                        value={selectedHp}
                        onChange={(event) =>
                          setSelectedVariants((current) => ({ ...current, [product.id]: event.target.value }))
                        }
                      >
                        {product.variants.map((item) => <option key={item.hp}>{item.hp}</option>)}
                      </select>
                    </label>
                    <div className="pos-product-price">
                      <span>Promo price</span>
                      <strong>{money(variant.price)}</strong>
                    </div>
                    <button type="button" className="btn btn-dark" onClick={() => addProduct(product)}>
                      <Plus size={16}/> Add to Sale
                    </button>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="pos-service-grid">
              {filteredServices.map((service) => (
                <article className="pos-service-card" key={service.id}>
                  <div className="pos-service-icon"><Wrench size={20}/></div>
                  <div>
                    <span>{service.category}</span>
                    <h3>{service.name}</h3>
                    <p>{service.description}</p>
                    <small>{service.duration}</small>
                  </div>
                  <strong>{money(service.basePrice)}</strong>
                  <button type="button" className="btn btn-soft" onClick={() => addService(service)}>
                    <Plus size={16}/> Add
                  </button>
                </article>
              ))}
            </div>
          )}
        </section>

        <aside className="mgmt-panel pos-summary pos-checkout-panel">
          <div className="mgmt-panel-header">
            <h2>Current Walk-in Order</h2>
            <span className="badge badge-blue">{cart.reduce((sum, item) => sum + item.qty, 0)} items</span>
          </div>

          <div className="pos-customer-grid">
            <label className="form-group">
              <span>Customer name</span>
              <input className="form-control" value={customerName} onChange={(event) => setCustomerName(event.target.value)} />
            </label>
            <label className="form-group">
              <span>Phone (optional)</span>
              <input className="form-control" value={customerPhone} onChange={(event) => setCustomerPhone(event.target.value)} placeholder="09xx xxx xxxx" />
            </label>
          </div>

          <label className="form-group">
            <span>Fulfillment</span>
            <select className="form-control" value={fulfillment} onChange={(event) => setFulfillment(event.target.value)}>
              <option>Walk-in / Take-home</option>
              <option>Pickup Later</option>
              <option>Delivery Arrangement</option>
              <option>With Installation / Service</option>
            </select>
          </label>

          <div className="pos-cart-lines">
            {cart.length === 0 ? (
              <div className="pos-empty-cart">
                <ShoppingCart size={27}/>
                <strong>No items yet</strong>
                <span>Select a product or service from the catalog.</span>
              </div>
            ) : (
              cart.map((item) => (
                <div className="pos-cart-line" key={item.key}>
                  <div className="pos-cart-line-main">
                    <span className={`pos-line-type ${item.type.toLowerCase()}`}>{item.type}</span>
                    <strong>{item.name}</strong>
                    <small>{item.detail} · {money(item.price)} each</small>
                  </div>
                  <div className="pos-qty">
                    <button type="button" aria-label="Decrease quantity" onClick={() => changeQty(item.key, -1)}><Minus size={14}/></button>
                    <b>{item.qty}</b>
                    <button type="button" aria-label="Increase quantity" onClick={() => changeQty(item.key, 1)}><Plus size={14}/></button>
                  </div>
                  <strong className="pos-line-total">{money(item.price * item.qty)}</strong>
                  <button type="button" className="pos-remove" aria-label={`Remove ${item.name}`} onClick={() => removeItem(item.key)}>
                    <Trash2 size={15}/>
                  </button>
                </div>
              ))
            )}
          </div>

          <div className="pos-totals">
            <div><span>Subtotal</span><strong>{money(subtotal)}</strong></div>
            <label>
              <span>Discount</span>
              <input type="number" min="0" max={subtotal} value={discount} onChange={(event) => setDiscount(event.target.value)} />
            </label>
            <div className="pos-grand-total"><span>Total</span><strong>{money(total)}</strong></div>
          </div>

          <div className="pos-payment-box">
            <h3>Payment</h3>
            <div className="pos-payment-methods">
              {["Cash", "GCash", "Bank Transfer"].map((method) => (
                <button key={method} type="button" className={paymentMethod === method ? "active" : ""} onClick={() => setPaymentMethod(method)}>
                  {method}
                </button>
              ))}
            </div>

            {paymentMethod === "Cash" ? (
              <>
                <label className="form-group">
                  <span>Cash received</span>
                  <input className="form-control" type="number" min="0" value={cashReceived} onChange={(event) => setCashReceived(event.target.value)} placeholder="0.00" />
                </label>
                <div className="pos-change"><span>Change</span><strong>{money(change)}</strong></div>
              </>
            ) : (
              <label className="form-group">
                <span>{paymentMethod} reference no.</span>
                <input className="form-control" value={reference} onChange={(event) => setReference(event.target.value)} placeholder="Enter payment reference" />
              </label>
            )}
          </div>

          <div className="pos-checkout-actions">
            <button type="button" className="btn btn-soft" onClick={resetSale} disabled={!cart.length}>Clear Sale</button>
            <button type="button" className="btn btn-dark" onClick={processSale} disabled={!canProcess}>
              <ReceiptText size={17}/> Process Walk-in Order
            </button>
          </div>
          {!canProcess && cart.length > 0 && (
            <small className="pos-validation-note">
              {paymentMethod === "Cash" ? "Enter enough cash received to process the order." : `Enter the ${paymentMethod} reference number to process the order.`}
            </small>
          )}
        </aside>
      </div>

      {receipt && (
        <div className="receipt-overlay" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setReceipt(null)}>
          <section className="receipt-modal" role="dialog" aria-modal="true" aria-label="POS receipt">
            <button className="receipt-close" type="button" aria-label="Close receipt" onClick={() => setReceipt(null)}><X size={18}/></button>
            <div className="receipt-success"><CheckCircle2 size={38}/></div>
            <div className="receipt-brand">AV COOLING SYSTEM</div>
            <h2>Walk-in Sale Completed</h2>
            <p className="receipt-id">{receipt.id}</p>
            <div className="receipt-meta">
              <div><span>Customer</span><strong>{receipt.customer}</strong></div>
              <div><span>Cashier</span><strong>{receipt.cashier}</strong></div>
              <div><span>Payment</span><strong>{receipt.paymentMethod}</strong></div>
              <div><span>Date</span><strong>{receipt.createdAt}</strong></div>
            </div>
            <div className="receipt-lines">
              {receipt.items.map((item) => (
                <div key={item.key}>
                  <span>{item.qty} × {item.name} {item.detail ? `(${item.detail})` : ""}</span>
                  <strong>{money(item.price * item.qty)}</strong>
                </div>
              ))}
            </div>
            <div className="receipt-total"><span>Total Paid</span><strong>{money(receipt.total)}</strong></div>
            {receipt.paymentMethod === "Cash" && <div className="receipt-change"><span>Change</span><strong>{money(receipt.change)}</strong></div>}
            <p className="receipt-note">
              The order is now saved in <b>Management → Orders</b>. If the sale includes a service, its order status starts as Processing for scheduling.
            </p>
            <button type="button" className="btn btn-dark" onClick={() => setReceipt(null)}>Done</button>
          </section>
        </div>
      )}
    </>
  );
}
