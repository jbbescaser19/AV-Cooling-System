import {
  listWorkspace,
  createWorkspace,
  updateWorkspace,
} from "../../services/management/workspaceService.js";

function handle(fn, status = 200) {
  return async (req, res) => {
    try {
      const data = await fn(req);

      return res.status(status).json({
        success: true,
        ...data,
      });
    } catch (error) {
      const code =
        Number(error.status) >= 400 && Number(error.status) < 500
          ? Number(error.status)
          : 500;

      if (code === 500) {
        console.error("Management workspace:", error);
      }

      return res.status(code).json({
        success: false,
        message:
          code === 500
            ? "The management request could not be processed."
            : error.message,
      });
    }
  };
}

// Existing workspace controllers
export const listWorkspaceController = handle((req) =>
  listWorkspace(req.staff, req.params.module),
);

export const createWorkspaceController = handle(
  (req) => createWorkspace(req.staff, req.params.module, req.body),
  201,
);

export const updateWorkspaceController = handle((req) =>
  updateWorkspace(req.staff, req.params.module, req.params.id, req.body),
);

// Shared controller factory for Management modules
export function createModuleControllers(module) {
  return {
    list: handle((req) => listWorkspace(req.staff, module)),

    create: handle((req) => createWorkspace(req.staff, module, req.body), 201),

    update: handle((req) =>
      updateWorkspace(req.staff, module, req.params.id, req.body),
    ),
  };
}
