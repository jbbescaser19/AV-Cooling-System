import {
  getSourceTeam,
  saveSourceTeam,
} from "../../../services/management/services/sourceTeamService.js";
import {
  validateSourceParams,
  validateSourceTeam,
} from "../../../validators/management/services/sourceTeamValidator.js";

function respondError(res, error) {
  const status = error.status >= 400 && error.status < 500 ? error.status : 500;
  if (status === 500) console.error("Management team assignment:", error);
  return res.status(status).json({
    success: false,
    message:
      status === 500
        ? "Unable to load or update the technician team."
        : error.message,
  });
}
export async function getSourceTeamController(req, res) {
  try {
    const { kind, id } = validateSourceParams(req.params);
    const data = await getSourceTeam(req.staff, kind, id);
    return res.json({ success: true, ...data });
  } catch (error) {
    return respondError(res, error);
  }
}
export async function saveSourceTeamController(req, res) {
  try {
    const { kind, id } = validateSourceParams(req.params);
    const { technicianIds, workType } = validateSourceTeam(req.body);
    const data = await saveSourceTeam(
      req.staff,
      kind,
      id,
      technicianIds,
      workType,
    );
    return res.json({
      success: true,
      message: "Technician team assigned.",
      ...data,
    });
  } catch (error) {
    return respondError(res, error);
  }
}
