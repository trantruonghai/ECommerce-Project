// Standard JSON response format agreed in the Checkpoint 02 plan:
//   success: { success: true,  message: "...", data: ... }
//   error:   { success: false, message: "...", data: null }

function sendSuccess(res, status, message, data = null) {
  return res.status(status).json({ success: true, message, data });
}

function sendError(res, status, message) {
  return res.status(status).json({ success: false, message, data: null });
}

module.exports = { sendSuccess, sendError };
