const fs = require('fs');
const path = require('path');

// These originals are versioned in Git, unlike files uploaded at runtime.
const SOURCE_DIR = path.join(__dirname, '..', '..', '..', 'prototype_rooms');
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '..', '..', 'uploads');

function isFile(file) {
  try {
    return fs.statSync(file).isFile();
  } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'ENOTDIR') return false;
    throw error;
  }
}

function bundledImagePath(filename) {
  // Accept only the public filenames created by seedRoomImages().
  // Do not allow arbitrary paths or access to other project files.
  const match = /^prototype-(L-\d{4})-\d+\.(jpg|jpeg|png|webp)$/.exec(filename);
  if (!match) return null;
  const file = path.join(SOURCE_DIR, match[1], filename.slice('prototype-'.length));
  return isFile(file) ? file : null;
}

function resolveRoomImagePath(filePath) {
  if (typeof filePath !== 'string' || filePath === '') return null;
  const filename = path.basename(filePath);
  const uploaded = path.join(UPLOAD_DIR, filename);
  if (isFile(uploaded)) return uploaded;
  return bundledImagePath(filename);
}

module.exports = { SOURCE_DIR, UPLOAD_DIR, bundledImagePath, resolveRoomImagePath };
