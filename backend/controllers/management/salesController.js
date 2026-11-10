import {
  getPosCatalog,
  createPosSale,
  getSalesOrders,
  getSalesOrderDetails,
  getSalesPayments,
  confirmCollectedCash,
} from "../../services/management/salesService.js";

function handle(fn, status = 200) {
  return async (req, res) => {
    try {
      const result = await fn(req);

      res.status(status).json({
        success: true,
        ...result,
      });
    } catch (error) {
      const code =
        error.status >= 400 && error.status < 500 ? error.status : 500;

      if (code === 500) {
        console.error("Management sales:", error);
      }

      res.status(code).json({
        success: false,
        message:
          code === 500
            ? "Could not process this sales request."
            : error.message,
      });
    }
  };
}

export const posCatalogController = handle((req) => getPosCatalog(req.staff));

export const createPosSaleController = handle(
  (req) => createPosSale(req.staff, req.body),
  201,
);

export const listSalesOrdersController = handle((req) =>
  getSalesOrders(req.staff),
);

export const salesOrderDetailController = handle((req) =>
  getSalesOrderDetails(req.staff, req.params.id),
);

export const listSalesPaymentsController = handle((req) =>
  getSalesPayments(req.staff),
);

export const confirmCashController = handle((req) =>
  confirmCollectedCash(req.staff, req.params.paymentId, req.body),
);
