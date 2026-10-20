const path = require('path');

// Tests point UPLOAD_DIR at a temp folder so they never touch real room images.
const uploadDir = process.env.UPLOAD_DIR || path.join(__dirname, '..', '..', 'uploads');

module.exports = { uploadDir, publicPrefix: '/uploads' };
