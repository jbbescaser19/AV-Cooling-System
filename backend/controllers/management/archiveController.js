import {
  archiveCatalogRecord,
  getArchive,
  restoreCatalogRecord,
} from "../../services/management/archiveService.js";
function handle(fn) {
  return async (req, res) => {
    try {
      return res.json({ success: true, ...(await fn(req)) });
    } catch (error) {
      const status =
        error.status >= 400 && error.status < 500 ? error.status : 500;
      if (status === 500) console.error("Management archive:", error);
      return res
        .status(status)
        .json({
          success: false,
          message:
            status === 500 ? "Could not update the archive." : error.message,
        });
    }
  };
}
export const listArchiveController = handle((req) => getArchive(req.staff));
export const archiveRecordController = handle((req) =>
  archiveCatalogRecord(req.staff, req.params.module, req.params.id, req.body),
);
export const restoreArchiveController = handle((req) =>
  restoreCatalogRecord(req.staff, req.params.archiveId),
);
