function toIso(value) {
  return value instanceof Date ? value.toISOString() : value;
}

function toRoom(row, appliances = [], images = []) {
  return {
    roomId: row.RoomID,
    building: row.Building,
    floor: row.Floor,
    roomType: row.RoomType,
    bedrooms: row.NumberOfBedroom,
    size: row.RoomSize,
    price: row.Price,
    description: row.RoomConditions,
    conditionRating: row.ConditionRating,
    minimumLease: row.MinimumLeases,
    available: Boolean(row.Availability),
    appliances,
    images,
    owner: {
      name: row.OwnerName,
      phone: row.OwnerPhoneNumber,
      email: row.OwnerEmail,
      lineId: row.OwnerLineID,
    },
    updatedAt: toIso(row.UpdatedAt),
  };
}

function toRoomImage(row) {
  return { imageId: row.ImageID, url: row.FilePath };
}

function toAdmin(row, emails = []) {
  return {
    username: row.Username,
    firstName: row.Fname,
    lastName: row.Lname,
    displayName: `${row.Fname} ${row.Lname}`,
    address: row.Address,
    role: row.Role,
    status: row.Status,
    emails,
    updatedAt: toIso(row.UpdatedAt),
  };
}

function toBooking(row) {
  return {
    bookingId: row.BookingID,
    roomId: row.RoomID,
    fullName: row.FullName,
    identityNumber: row.IdentityNumber,
    phone: row.Phone,
    email: row.Email,
    moveInDate: row.MoveInDate,
    status: row.Status,
    createdAt: toIso(row.CreatedAt),
  };
}

function toLog(row) {
  return {
    logId: row.LogID,
    username: row.Username,
    changed: row.Changed,
    dateTime: toIso(row.DateTime),
  };
}

module.exports = { toRoom, toRoomImage, toAdmin, toBooking, toLog };
