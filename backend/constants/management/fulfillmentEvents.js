export const EVENT_LABELS = {
  ORDER_ACCEPTED: [
    "Order accepted",
    "Your air conditioner order has been accepted.",
  ],
  INSTALLATION_SCHEDULED: [
    "Installation scheduled",
    "Your delivery and installation appointment has been scheduled.",
  ],
  SCHEDULE_CHANGED: [
    "Order appointment rescheduled",
    "The appointment for your order has changed.",
  ],
  ORDER_OUT_FOR_DELIVERY: [
    "Out for delivery",
    "Your air conditioner is on its way.",
  ],
  ORDER_DELIVERED: [
    "Order delivered",
    "Your air conditioner has been delivered.",
  ],
  INSTALLATION_STARTED: [
    "Installation started",
    "The installation work has started.",
  ],
  INSTALLATION_COMPLETED: [
    "Installation completed",
    "Your air conditioner installation has been completed.",
  ],
  PAYMENT_CONFIRMED: [
    "Payment confirmed",
    "Your cash payment has been received and recorded.",
  ],
  EXTRA_CHARGES_PROPOSED: [
    "Additional work needs approval",
    "The store has proposed additional installation work. No extra charge has been added to your order.",
  ],
  ORDER_DECLINED: ["Order declined", "The store could not accept your order."],
  ORDER_CANCELLED_BY_STAFF: [
    "Order cancelled by store",
    "The store cancelled your order.",
  ],
  SERVICE_ACCEPTED: [
    "Service accepted",
    "Your service request has been approved.",
  ],
  SERVICE_SCHEDULED: [
    "Service scheduled",
    "Your service appointment has been scheduled.",
  ],
  SERVICE_RESCHEDULED: [
    "Service rescheduled",
    "Your service appointment has been changed.",
  ],
  SERVICE_STARTED: [
    "Service started",
    "A technician has started your requested service.",
  ],
  SERVICE_COMPLETED: [
    "Service completed",
    "Your requested service has been completed.",
  ],
  SERVICE_CANCELLED: [
    "Service cancelled",
    "Your service appointment has been cancelled.",
  ],
  SERVICE_DECLINED: [
    "Service declined",
    "Your service request could not be accepted.",
  ],
};
export const scheduleEvents = new Set([
  "INSTALLATION_SCHEDULED",
  "SCHEDULE_CHANGED",
  "SERVICE_SCHEDULED",
  "SERVICE_RESCHEDULED",
]);
export const requiredNotes = new Set([
  "ORDER_DECLINED",
  "ORDER_CANCELLED_BY_STAFF",
  "SCHEDULE_CHANGED",
  "EXTRA_CHARGES_PROPOSED",
  "SERVICE_DECLINED",
  "SERVICE_CANCELLED",
  "SERVICE_RESCHEDULED",
]);
export const orderEvents = new Set([
  "ORDER_ACCEPTED",
  "INSTALLATION_SCHEDULED",
  "SCHEDULE_CHANGED",
  "ORDER_OUT_FOR_DELIVERY",
  "ORDER_DELIVERED",
  "INSTALLATION_STARTED",
  "INSTALLATION_COMPLETED",
  "PAYMENT_CONFIRMED",
  "EXTRA_CHARGES_PROPOSED",
  "ORDER_DECLINED",
  "ORDER_CANCELLED_BY_STAFF",
]);
