export const seedOrders = [
  {
    id: "AV-1048",
    date: "Oct 6, 2026",
    total: 42800,
    status: "Processing",
    type: "Delivery",
    payment: "GCash",
  },
  {
    id: "AV-1022",
    date: "Sep 22, 2026",
    total: 23499,
    status: "Completed",
    type: "Pickup",
    payment: "Cash",
  },
];

export const seedServices = [
  {
    id: "SR-0318",
    service: "Cleaning & Maintenance",
    schedule: "Oct 7 · 9:00 AM",
    status: "Pending Approval",
    address: "Calamba, Laguna",
  },
  {
    id: "SR-0291",
    service: "Installation",
    schedule: "Sep 18 · 1:00 PM",
    status: "Completed",
    address: "Calamba, Laguna",
  },
];

export const seedPayments = [
  {
    id: "PAY-2218",
    order: "AV-1048",
    method: "GCash",
    amount: 42800,
    status: "Paid",
  },
  {
    id: "PAY-2102",
    order: "AV-1022",
    method: "Cash",
    amount: 23499,
    status: "Paid",
  },
];

export const seedNotices = [
  {
    id: "CN-1",
    title: "Order AV-1048 is processing",
    text: "Your payment is verified and the order is being prepared.",
    time: "10 min ago",
    read: false,
  },
  {
    id: "CN-2",
    title: "Service request received",
    text: "Cleaning & Maintenance request SR-0318 is waiting for schedule approval.",
    time: "35 min ago",
    read: false,
  },
  {
    id: "CN-3",
    title: "Promo update",
    text: "A new AV Cooling promotional poster is available on the homepage.",
    time: "Yesterday",
    read: true,
  },
];
