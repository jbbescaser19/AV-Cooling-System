import {
  listWalkInServices,
  bookWalkInService,
} from "../../../services/management/sales/walkInServiceService.js";
import { handle } from "./salesControllerHelpers.js";
export const walkInServicesController = handle((req) =>
  listWalkInServices(req.staff),
);
export const bookWalkInServiceController = handle(
  (req) => bookWalkInService(req.staff, req.body),
  201,
);
