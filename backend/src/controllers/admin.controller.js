const adminService = require('../services/admin.service');
const assertValid = require('../utils/assert-valid');
const {
  validateAdmin, validateAdminFilters, validatePasswordReset,
} = require('../validators/admin.validator');

async function list(req, res) {
  const filters = assertValid(validateAdminFilters(req.query));
  res.json({ data: await adminService.listAdmins(filters) });
}

async function getOne(req, res) {
  res.json({ data: await adminService.getAdmin(req.params.username) });
}

async function create(req, res) {
  const input = assertValid(validateAdmin(req.body, { isCreate: true }));
  res.status(201).json({ data: await adminService.createAdmin(input, req.admin.username) });
}

async function update(req, res) {
  const input = assertValid(validateAdmin(req.body, { isCreate: false }));
  res.json({ data: await adminService.updateAdmin(req.params.username, input, req.admin.username) });
}

async function remove(req, res) {
  await adminService.deleteAdmin(req.params.username, req.admin.username);
  res.json({ data: { ok: true } });
}

async function resetPassword(req, res) {
  const { password } = assertValid(validatePasswordReset(req.body));
  await adminService.resetPassword(req.params.username, password, req.admin.username);
  res.json({ data: { ok: true } });
}

module.exports = { list, getOne, create, update, remove, resetPassword };
