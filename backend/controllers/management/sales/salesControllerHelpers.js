export function handle(fn, status = 200) {
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
