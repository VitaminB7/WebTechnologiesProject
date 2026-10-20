const fs = require('fs/promises');
const path = require('path');
const { uploadDir } = require('../config/uploads');

/** Delete uploaded files by their public path ("/uploads/x.jpg"). Missing files are ignored. */
async function removeUploadedFiles(publicPaths) {
  await Promise.all(publicPaths.map(async (publicPath) => {
    // basename() keeps the delete inside uploadDir whatever the stored path says.
    const filePath = path.join(uploadDir, path.basename(publicPath));
    try {
      await fs.unlink(filePath);
    } catch (err) {
      if (err.code !== 'ENOENT') console.error(`Could not delete ${filePath}:`, err.message);
    }
  }));
}

module.exports = { removeUploadedFiles };
