import connectDB from "../../utils/dbConn.js";
import { dashboardModel } from "../../models/management/dashboardModel.js";
import { workOrderModel } from "../../models/management/services/workOrderModel.js";

const SALES_ROLES = new Set(["OWNER", "MANAGER", "SALES_CASHIER"]);
const SERVICE_ROLES = new Set(["OWNER", "MANAGER", "TECHNICIAN"]);
const OWNER_MANAGER = new Set(["OWNER", "MANAGER"]);

function asCount(value) {
  return Math.max(0, Number(value) || 0);
}

function counts(row) {
  return {
    total: asCount(row?.total),
    pending: asCount(row?.pending),
    active: asCount(row?.active),
    completed: asCount(row?.completed),
    cancelled: asCount(row?.cancelled),
  };
}

/** Build a role-limited snapshot without returning data outside staff permissions. */
export async function getManagementDashboard(staff) {
  const role = staff?.role;
  if (!SALES_ROLES.has(role) && !SERVICE_ROLES.has(role)) {
    const error = new Error("Dashboard access is not available for this role.");
    error.status = 403;
    throw error;
  }

  // Technicians must see their own assigned jobs, never all customers'
  // pending service requests. Assignment is what makes a job actionable.
  if (role === "TECHNICIAN") {
    const raw = await workOrderModel(connectDB).techJobSummary(staff.id);
    const technician = Object.fromEntries(
      [
        "active",
        "awaitingStart",
        "pendingServices",
        "pendingOrderJobs",
        "inProgress",
        "completed",
        "dueToday",
      ].map((key) => [key, asCount(raw[key])]),
    );
    return {
      dashboard: {
        permissions: {
          sales: false,
          services: false,
          inventory: false,
          technician: true,
        },
        technician,
        orders: null,
        payments: null,
        monthlyPayments: [],
        paymentTrends: null,
        customers: null,
        services: null,
        inventory: null,
        recentRecords: [],
        upcomingServices: [],
        feedbackSentiment: null,
      },
      generatedAt: new Date().toISOString(),
    };
  }

  const canSales = SALES_ROLES.has(role);
  const canServices = SERVICE_ROLES.has(role);
  const canInventory = OWNER_MANAGER.has(role);
  const connection = await connectDB.getConnection();

  try {
    // A consistent read-only snapshot of the dashboard's multiple metrics.
    await connection.beginTransaction();
    const model = dashboardModel(connection);
    const dashboard = {
      permissions: {
        sales: canSales,
        services: canServices,
        inventory: canInventory,
      },
      orders: null,
      payments: null,
      monthlyPayments: [],
      paymentTrends: null,
      customers: null,
      services: null,
      inventory: null,
      recentRecords: [],
      upcomingServices: [],
      feedbackSentiment: null,
    };

    if (canSales) {
      const orderRow = await model.orderSummary();
      const paymentRow = await model.paymentSummary();
      dashboard.orders = {
        ...counts(orderRow),
        awaitingPaymentAmount: asCount(orderRow?.awaitingPaymentAmount),
      };
      dashboard.payments = {
        paidCount: asCount(paymentRow?.paidCount),
        paidAmount: asCount(paymentRow?.paidAmount),
      };
      // Only PAID payments are included. Keep the existing monthlyPayments
      // response for compatibility with older dashboard clients.
      const dailyRows = await model.dailyPaidPayments();
      const weeklyRows = await model.weeklyPaidPayments();
      const monthlyRows = await model.monthlyPaidPayments();
      const yearlyRows = await model.yearlyPaidPayments();
      const normalize = (rows) =>
        rows.map((row) => ({
          key: String(row.bucket),
          amount: asCount(row.amount),
          paymentCount: asCount(row.paymentCount),
        }));

      dashboard.monthlyPayments = monthlyRows.map((row) => ({
        month: row.month,
        amount: asCount(row.amount),
        paymentCount: asCount(row.paymentCount),
      }));
      dashboard.paymentTrends = {
        daily: normalize(dailyRows),
        weekly: normalize(weeklyRows),
        monthly: dashboard.monthlyPayments.map((row) => ({
          key: row.month,
          amount: row.amount,
          paymentCount: row.paymentCount,
        })),
        yearly: normalize(yearlyRows),
      };
      dashboard.customers = {
        active: asCount((await model.customerSummary())?.active),
      };
      dashboard.recentRecords.push(
        ...(await model.recentOrders()).map((row) => ({
          kind: "ORDER",
          id: row.id,
          reference: row.reference,
          title: row.customer,
          detail: row.channel === "POS" ? "POS order" : "Online order",
          status: row.status,
          amount: asCount(row.amount),
          paymentStatus: row.paymentStatus,
          updatedAt: row.updatedAt,
        })),
      );
    }

    if (canServices) {
      dashboard.services = counts(await model.serviceSummary());
      dashboard.recentRecords.push(
        ...(await model.recentServices()).map((row) => ({
          kind: "SERVICE",
          id: row.id,
          reference: `Service #${row.id}`,
          title: row.customer || "Customer",
          detail: row.serviceName,
          status: row.status,
          updatedAt: row.updatedAt,
        })),
      );
      dashboard.upcomingServices = (await model.upcomingServices()).map(
        (row) => ({
          id: row.id,
          serviceName: row.serviceName,
          customer: row.customer || "Customer",
          status: row.status,
          preferredStart: row.preferredStart,
        }),
      );
    }

    // The feedback overview is limited to owners and managers. It contains
    // aggregate counts only; no customer names or private comments.
    if (OWNER_MANAGER.has(role)) {
      const sentiment = await model.feedbackSentimentSummary();
      dashboard.feedbackSentiment = Object.fromEntries(
        ["total", "positive", "neutral", "negative", "unanalyzed"].map(
          (key) => [key, asCount(sentiment[key])],
        ),
      );
    }

    if (canInventory) {
      const row = await model.inventorySummary();
      dashboard.inventory = {
        tracked: asCount(row?.tracked),
        lowStock: asCount(row?.lowStock),
      };
    }

    dashboard.recentRecords = dashboard.recentRecords
      .sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      )
      .slice(0, 8);

    await connection.commit();
    return { dashboard, generatedAt: new Date().toISOString() };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
