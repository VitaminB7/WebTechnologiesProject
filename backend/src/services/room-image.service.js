const HttpError = require('../utils/http-error');
const withTransaction = require('../utils/transaction');
const { logAction } = require('../utils/log-action');
const { removeUploadedFiles } = require('../utils/files');
const { publicPrefix } = require('../config/uploads');
const { getRoom, findRoomRow, notFound } = require('./room.service');

/** Save already-uploaded files (multer) as images of a room. Files are removed on any failure. */
async function addImages(roomId, files, actor) {
  const publicPaths = files.map((file) => `${publicPrefix}/${file.filename}`);
  try {
    await withTransaction(async (db) => {
      if (!(await findRoomRow(db, roomId, { lock: true }))) throw notFound(roomId);
      const [[{ maxOrder }]] = await db.execute(
        'SELECT COALESCE(MAX(SortOrder), -1) AS maxOrder FROM RoomImage WHERE RoomID = ?', [roomId],
      );
      for (const [index, filePath] of publicPaths.entries()) {
        await db.execute(
          'INSERT INTO RoomImage (RoomID, FilePath, SortOrder) VALUES (?, ?, ?)',
          [roomId, filePath, Number(maxOrder) + 1 + index],
        );
      }
      await db.execute('UPDATE RoomUnit SET UpdatedAt = CURRENT_TIMESTAMP WHERE RoomID = ?', [roomId]);
      await logAction(db, actor, `UPDATE RoomUnit ${roomId}: added ${files.length} image(s)`);
    });
  } catch (err) {
    await removeUploadedFiles(publicPaths);
    throw err;
  }
  return getRoom(roomId);
}

/** Remove one image of this room (an image of another room is "not found"). */
async function removeImage(roomId, imageId, actor) {
  const filePath = await withTransaction(async (db) => {
    if (!(await findRoomRow(db, roomId, { lock: true }))) throw notFound(roomId);
    const [rows] = await db.execute(
      'SELECT ImageID, FilePath FROM RoomImage WHERE RoomID = ? AND ImageID = ?',
      [roomId, imageId],
    );
    if (rows.length === 0) throw new HttpError(404, 'Image not found');
    await db.execute('DELETE FROM RoomImage WHERE ImageID = ?', [rows[0].ImageID]);
    await db.execute('UPDATE RoomUnit SET UpdatedAt = CURRENT_TIMESTAMP WHERE RoomID = ?', [roomId]);
    await logAction(db, actor, `UPDATE RoomUnit ${roomId}: removed image ${rows[0].FilePath}`);
    return rows[0].FilePath;
  });
  await removeUploadedFiles([filePath]);
  return getRoom(roomId);
}

module.exports = { addImages, removeImage };
