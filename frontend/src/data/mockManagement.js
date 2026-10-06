export const orders = [
  {
    id: "AV-1048",
    customer: "Maria Santos",
    type: "Delivery",
    source: "Online",
    total: 42800,
    status: "Processing",
    payment: "Paid",
    createdAt: "2026-10-06 09:12",
  },
  {
    id: "AV-1047",
    customer: "John Reyes",
    type: "Pickup",
    source: "Online",
    total: 31900,
    status: "Ready for Pickup",
    payment: "Paid",
    createdAt: "2026-10-06 08:35",
  },
  {
    id: "AV-1046",
    customer: "Nina Cruz",
    type: "Delivery",
    source: "Online",
    total: 57500,
    status: "Out for Delivery",
    payment: "Partially Paid",
    createdAt: "2026-10-05 16:48",
  },
  {
    id: "AV-1045",
    customer: "Paolo Lim",
    type: "Service",
    source: "Walk-in",
    total: 2500,
    status: "Completed",
    payment: "Paid",
    createdAt: "2026-10-05 14:20",
  },
];

export const customers = [
  { name: "Maria Santos", phone: "0917 555 0123", status: "Active", orders: 4 },
  { name: "John Reyes", phone: "0918 555 0441", status: "Active", orders: 2 },
  { name: "Nina Cruz", phone: "0995 555 0155", status: "Pending Verification", orders: 1 },
  { name: "Paolo Lim", phone: "0920 555 0911", status: "Active", orders: 6 },
];

export const payments = [
  { id: "PAY-2218", order: "AV-1048", customer: "Maria Santos", method: "GCash", amount: 42800, status: "Paid", date: "Oct 6, 2026 · 9:15 AM" },
  { id: "PAY-2217", order: "AV-1047", customer: "John Reyes", method: "Cash", amount: 31900, status: "Paid", date: "Oct 6, 2026 · 8:42 AM" },
  { id: "PAY-2216", order: "AV-1046", customer: "Nina Cruz", method: "Bank Transfer", amount: 30000, status: "Partially Paid", date: "Oct 5, 2026 · 5:02 PM" },
  { id: "PAY-2215", order: "AV-1045", customer: "Paolo Lim", method: "Cash", amount: 2500, status: "Paid", date: "Oct 5, 2026 · 2:22 PM" },
];

export const stockMovements = [
  { id: "STM-0812", product: "Midea Celest Pro 1.5HP", type: "Stock Out", qty: 1, reference: "AV-1048", user: "Sales Cashier", date: "Oct 6 · 9:18 AM" },
  { id: "STM-0811", product: "Daikin D-Smart 1.0HP", type: "Stock In", qty: 6, reference: "RESTOCK-118", user: "Manager", date: "Oct 6 · 8:10 AM" },
  { id: "STM-0810", product: "Carrier Nexus 1.5HP", type: "Stock Out", qty: 1, reference: "AV-1047", user: "Sales Cashier", date: "Oct 6 · 8:45 AM" },
  { id: "STM-0809", product: "Hisense Hi-Smart 2.0HP", type: "Adjustment", qty: -1, reference: "COUNT-026", user: "Manager", date: "Oct 5 · 4:30 PM" },
];

export const serviceTypes = [
  { id: "SVT-001", name: "Installation", category: "Installation", basePrice: 2500, duration: "2–4 hrs", status: "Active", description: "Standard split-type installation with mounting, drainage, testing, and up to the package allowance." },
  { id: "SVT-002", name: "Cleaning & Maintenance", category: "Maintenance", basePrice: 1500, duration: "1–2 hrs", status: "Active", description: "Deep cleaning and preventive maintenance for indoor and outdoor units." },
  { id: "SVT-003", name: "Repair", category: "Repair", basePrice: 1200, duration: "Assessment based", status: "Active", description: "Cooling, electrical, drainage, control, and component repair. Parts quoted separately." },
  { id: "SVT-004", name: "Troubleshooting", category: "Diagnostic", basePrice: 800, duration: "45–90 mins", status: "Active", description: "On-site diagnosis to identify the cause of performance or electrical issues." },
  { id: "SVT-005", name: "Emergency Service", category: "Priority", basePrice: 2000, duration: "Priority dispatch", status: "Active", description: "Urgent service request handled based on technician availability and location." },
];

export const serviceRequests = [
  { id: "SR-0318", customer: "Angela Ramos", service: "Cleaning & Maintenance", preferred: "Oct 7 · 9:00 AM", location: "Calamba, Laguna", status: "Pending Approval", technician: "Unassigned" },
  { id: "SR-0317", customer: "Mark Villanueva", service: "Repair", preferred: "Oct 7 · 1:00 PM", location: "Cabuyao, Laguna", status: "Approved", technician: "J. Mendoza" },
  { id: "SR-0316", customer: "Liza Flores", service: "Installation", preferred: "Oct 8 · 10:00 AM", location: "Sta. Rosa, Laguna", status: "Scheduled", technician: "R. Garcia" },
  { id: "SR-0315", customer: "Paolo Lim", service: "Troubleshooting", preferred: "Oct 6 · 2:00 PM", location: "Calamba, Laguna", status: "Completed", technician: "M. Santos" },
];

export const workOrders = [
  { id: "WO-0142", serviceRequest: "SR-0317", customer: "Mark Villanueva", job: "Repair · No cooling", technician: "J. Mendoza", schedule: "Oct 7 · 1:00 PM", status: "Assigned" },
  { id: "WO-0141", serviceRequest: "SR-0316", customer: "Liza Flores", job: "Installation · 1.5HP Split Type", technician: "R. Garcia", schedule: "Oct 8 · 10:00 AM", status: "Scheduled" },
  { id: "WO-0140", serviceRequest: "SR-0315", customer: "Paolo Lim", job: "Troubleshooting · Water leak", technician: "M. Santos", schedule: "Oct 6 · 2:00 PM", status: "Completed" },
];

export const technicians = [
  { id: "TECH-01", name: "Joel Mendoza", skills: "Repair, Troubleshooting", jobsToday: 2, status: "Available" },
  { id: "TECH-02", name: "Ramon Garcia", skills: "Installation, Maintenance", jobsToday: 3, status: "Busy" },
  { id: "TECH-03", name: "Miguel Santos", skills: "Maintenance, Troubleshooting", jobsToday: 1, status: "Available" },
  { id: "TECH-04", name: "Carlo Reyes", skills: "Installation, Repair", jobsToday: 0, status: "Off Duty" },
];

export const schedules = [
  { id: "SCH-908", time: "8:00–10:00 AM", technician: "Miguel Santos", customer: "Rhea Cruz", service: "Cleaning & Maintenance", area: "Calamba", status: "Confirmed" },
  { id: "SCH-909", time: "10:00 AM–1:00 PM", technician: "Ramon Garcia", customer: "Liza Flores", service: "Installation", area: "Sta. Rosa", status: "Confirmed" },
  { id: "SCH-910", time: "1:00–3:00 PM", technician: "Joel Mendoza", customer: "Mark Villanueva", service: "Repair", area: "Cabuyao", status: "Pending" },
];

export const websiteContent = [
  { id: "WEB-01", section: "Hero", content: "Comfort engineered for every space.", status: "Published", updated: "Oct 5, 2026" },
  { id: "WEB-02", section: "Our Expertise", content: "Installation, cleaning, repair, troubleshooting, emergency support.", status: "Published", updated: "Oct 4, 2026" },
  { id: "WEB-03", section: "Why Partner With Us", content: "Transparent pricing, trained technicians, responsive support.", status: "Published", updated: "Oct 2, 2026" },
];

export const feedback = [
  { id: "FB-121", customer: "Maria Santos", category: "Installation", rating: 5, sentiment: "Positive", comment: "Technician arrived on time and explained everything clearly.", date: "Oct 6" },
  { id: "FB-120", customer: "John Reyes", category: "Product Quality", rating: 4, sentiment: "Positive", comment: "Unit is quiet and cools the room quickly.", date: "Oct 5" },
  { id: "FB-119", customer: "Nina Cruz", category: "Communication", rating: 3, sentiment: "Neutral", comment: "Order was okay but I wanted more delivery updates.", date: "Oct 5" },
];

export const contactMessages = [
  { id: "MSG-440", name: "Karen Dela Cruz", subject: "2.5HP recommendation", channel: "Website", status: "New", date: "Oct 6 · 10:12 AM" },
  { id: "MSG-439", name: "James Co", subject: "Installation outside Calamba", channel: "Website", status: "Replied", date: "Oct 6 · 8:05 AM" },
  { id: "MSG-438", name: "Anne Mercado", subject: "Request for commercial quotation", channel: "Website", status: "For Follow-up", date: "Oct 5 · 5:18 PM" },
];

export const facebookRequests = [
  { id: "FBREQ-71", customer: "Lea Bautista", message: "How much is Midea Celest Pro 1.5HP with installation?", category: "Product Inquiry", status: "New", date: "Oct 6 · 10:40 AM" },
  { id: "FBREQ-70", customer: "Bryan Tan", message: "Can I book cleaning tomorrow morning?", category: "Service Inquiry", status: "Replied", date: "Oct 6 · 9:28 AM" },
  { id: "FBREQ-69", customer: "Mika Reyes", message: "Do you accept GCash for walk-in purchase?", category: "Payment Inquiry", status: "Replied", date: "Oct 5 · 7:14 PM" },
];

export const reports = [
  { id: "RPT-01", title: "Sales Today", value: "₱128,497", detail: "7 completed transactions", trend: "+12% vs yesterday" },
  { id: "RPT-02", title: "Orders This Month", value: "146", detail: "Online + walk-in", trend: "+8% vs last month" },
  { id: "RPT-03", title: "Service Completion", value: "92%", detail: "46 of 50 jobs completed", trend: "4 jobs pending" },
  { id: "RPT-04", title: "Low Stock Items", value: "5", detail: "Need restock review", trend: "2 urgent" },
];

export const notifications = [
  { id: "NTF-901", type: "Order", title: "New online order AV-1048", message: "Maria Santos placed a delivery order worth ₱42,800.", time: "4 min ago", read: false, priority: "Normal" },
  { id: "NTF-900", type: "Inventory", title: "Low stock warning", message: "Midea Celest Pro 1.5HP is down to 2 units.", time: "18 min ago", read: false, priority: "High" },
  { id: "NTF-899", type: "Service", title: "Service request awaiting approval", message: "SR-0318 requested Cleaning & Maintenance for Oct 7 at 9:00 AM.", time: "31 min ago", read: false, priority: "Normal" },
  { id: "NTF-898", type: "Payment", title: "Payment verified", message: "GCash payment for AV-1048 has been marked Paid.", time: "1 hr ago", read: true, priority: "Normal" },
  { id: "NTF-897", type: "Schedule", title: "Technician schedule updated", message: "Ramon Garcia has 3 assigned jobs for Oct 7.", time: "2 hrs ago", read: true, priority: "Normal" },
];

export const auditLogs = [
  { id: "LOG-3001", user: "OWNER", action: "Updated promo poster", module: "Promos", record: "PROMO-CURRENT", time: "Oct 6 · 10:02 AM" },
  { id: "LOG-3000", user: "MANAGER", action: "Adjusted stock quantity", module: "Inventory", record: "Hisense Hi-Smart 2.0HP", time: "Oct 6 · 9:44 AM" },
  { id: "LOG-2999", user: "SALES_CASHIER", action: "Completed walk-in sale", module: "POS", record: "POS-20261006-004", time: "Oct 6 · 9:21 AM" },
  { id: "LOG-2998", user: "MANAGER", action: "Assigned technician", module: "Work Orders", record: "WO-0142", time: "Oct 6 · 8:57 AM" },
];
