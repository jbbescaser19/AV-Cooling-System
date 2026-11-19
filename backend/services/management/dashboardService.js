import connectDB from "../../utils/dbConn.js";
import { dashboardModel } from "../../models/management/dashboardModel.js";
import { workOrderModel } from "../../models/management/services/workOrderModel.js";

const SALES_ROLES = new Set(["OWNER", "MANAGER", "SALES_CASHIER"]);
const SERVICE_ROLES = new Set(["OWNER", "MANAGER", "TECHNICIAN"]);
const OWNER_MANAGER = new Set(["OWNER", "MANAGER"]);

function asCount(value) {
  return Math.max(0, Number(value) || 0);
}

function asAmount(value) {
  const amount = Number(value);

  return Number.isFinite(amount) ? amount : 0;
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

export async function getManagementDashboard(staff) {
  const role = staff?.role;

  if (!SALES_ROLES.has(role) && !SERVICE_ROLES.has(role)) {
    const error = new Error("Dashboard access is not available for this role.");

    error.status = 403;

    throw error;
  }

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
          financials: false,
          technician: true,
        },

        technician,
        financials: null,
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
  const canFinancials = OWNER_MANAGER.has(role);

  const connection = await connectDB.getConnection();

  try {
    await connection.beginTransaction();

    const model = dashboardModel(connection);

    const dashboard = {
      permissions: {
        sales: canSales,
        services: canServices,
        inventory: canInventory,
        financials: canFinancials,
      },

      financials: null,
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

        awaitingPaymentAmount: asAmount(orderRow?.awaitingPaymentAmount),
      };

      dashboard.payments = {
        paidCount: asCount(paymentRow?.paidCount),
        paidAmount: asAmount(paymentRow?.paidAmount),
      };

      // Company financial breakdown for Owner and Manager.
      if (canFinancials) {
        const pendingServiceRow = await model.pendingServicePayments();

        const pendingOrders = asAmount(orderRow?.awaitingPaymentAmount);

        const pendingServices = asAmount(pendingServiceRow?.amount);

        dashboard.financials = {
          totalRevenue: asAmount(paymentRow?.paidAmount),

          productSales: asAmount(paymentRow?.productSales),

          serviceRevenue: asAmount(paymentRow?.serviceRevenue),

          pendingPayments: Number((pendingOrders + pendingServices).toFixed(2)),

          pendingOrders,
          pendingServices,
        };
      }

      // Signed amounts preserve refund-only periods.
      const dailyRows = await model.dailyPaidPayments();
      const weeklyRows = await model.weeklyPaidPayments();
      const monthlyRows = await model.monthlyPaidPayments();
      const yearlyRows = await model.yearlyPaidPayments();

      const normalize = (rows) =>
        rows.map((row) => ({
          key: String(row.bucket),
          amount: asAmount(row.amount),
          paymentCount: asCount(row.paymentCount),
        }));

      dashboard.monthlyPayments = monthlyRows.map((row) => ({
        month: row.month,
        amount: asAmount(row.amount),
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

          detail:
            row.channel === "POS"
              ? "POS order"
              : row.channel === "FACEBOOK"
                ? "Facebook order"
                : "Online order",

          status: row.status,
          amount: asAmount(row.amount),
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

    return {
      dashboard,
      generatedAt: new Date().toISOString(),
    };
  } catch (error) {
    await connection.rollback();

    throw error;
  } finally {
    connection.release();
  }
}
