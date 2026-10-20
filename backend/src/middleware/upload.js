const crypto = require('crypto');
const fs = require('fs');
const fsp = require('fs/promises');
const multer = require('multer');
const HttpError = require('../utils/http-error');
const { uploadDir } = require('../config/uploads');

const MAX_FILES = 5;
const MAX_FILE_SIZE = 2 * 1024 * 1024;
// The saved extension comes from this map, never from the client's file name.
const EXTENSIONS = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const NOT_AN_IMAGE = 'file is not a valid jpg, png or webp image';

// File signatures ("magic bytes"): the declared mimetype is client input and cannot be trusted.
const SIGNATURES = {
  'image/jpeg': (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  'image/png': (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  'image/webp': (b) => b.toString('latin1', 0, 4) === 'RIFF' && b.toString('latin1', 8, 12) === 'WEBP',
};

const MULTER_MESSAGES = {
  LIMIT_FILE_SIZE: 'each image must be 2 MB or smaller',
  LIMIT_FILE_COUNT: `at most ${MAX_FILES} images per upload`,
  LIMIT_UNEXPECTED_FILE: `use the field "images" (at most ${MAX_FILES} files)`,
};

fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (req, file, cb) => {
    // Digits only: the URL segment must never be able to steer the path (e.g. "..").
    const prefix = String(req.params.id).replace(/\D/g, '').slice(0, 5) || 'room';
    const suffix = crypto.randomBytes(6).toString('hex');
    cb(null, `${prefix}-${suffix}.${EXTENSIONS[file.mimetype]}`);
  },
});

const multerUpload = multer({
  storage,
  limits: { files: MAX_FILES, fileSize: MAX_FILE_SIZE },
  fileFilter: (req, file, cb) => {
    if (EXTENSIONS[file.mimetype]) return cb(null, true);
    return cb(new HttpError(400, 'Invalid image', { images: 'only jpg, png or webp images are allowed' }));
  },
}).array('images', MAX_FILES);

async function readHeader(filePath) {
  const handle = await fsp.open(filePath, 'r');
  try {
    const buffer = Buffer.alloc(12);
    await handle.read(buffer, 0, 12, 0);
    return buffer;
  } finally {
    await handle.close();
  }
}

async function hasValidSignature(file) {
  return SIGNATURES[file.mimetype](await readHeader(file.path));
}

/** One bad file rejects the whole request, so every file it saved is deleted. */
async function assertRealImages(files) {
  const results = await Promise.all(files.map(hasValidSignature));
  if (results.every(Boolean)) return;
  await Promise.all(files.map((file) => fsp.rm(file.path, { force: true })));
  throw new HttpError(400, 'Invalid image', { images: NOT_AN_IMAGE });
}

/** Multipart field `images`; multer errors and fake images become 400 in the API error shape. */
function uploadRoomImages(req, res, next) {
  multerUpload(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      return next(new HttpError(400, 'Invalid upload', { images: MULTER_MESSAGES[err.code] || err.message }));
    }
    if (err) return next(err);
    if (!req.files || req.files.length === 0) {
      return next(new HttpError(400, 'No images uploaded', { images: 'choose at least one image' }));
    }
    return assertRealImages(req.files).then(() => next(), next);
  });
}

module.exports = { uploadRoomImages };
