import {
  getPosCatalog,
  createPosSale,
} from "../../../services/management/sales/posService.js";
import { handle } from "./salesControllerHelpers.js";
export const posCatalogController = handle((req) => getPosCatalog(req.staff));
export const createPosSaleController = handle(
  (req) => createPosSale(req.staff, req.body),
  201,
);
