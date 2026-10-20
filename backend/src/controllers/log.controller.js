const logService = require('../services/log.service');

async function list(req, res) {
  res.json({ data: await logService.listLatestLogs() });
}

module.exports = { list };
