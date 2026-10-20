function toIso(value) {
  return value instanceof Date ? value.toISOString() : value;
}

function toAppliance(row) {
  return { serialNumber: row.Serial_number, name: row.Name_appliance };
}

function toRoom(row, appliances = []) {
  return {
    roomId: row.RoomID,
    building: row.Building,
    roomType: row.RoomType,
    bedrooms: row.NumberOfBedroom,
    size: row.RoomSize,
    price: row.Price,
    description: row.RoomConditions,
    minimumLease: row.MinimumLeases,
    available: Boolean(row.Availability),
    appliances,
    owner: {
      name: row.OwnerName,
      phone: row.OwnerPhoneNumber,
      email: row.OwnerEmail,
      lineId: row.OwnerLineID,
    },
  };
}

function toAdmin(row) {
  return {
    username: row.Username,
    firstName: row.Fname,
    lastName: row.Lname,
    displayName: `${row.Fname} ${row.Lname}`,
    address: row.Address,
    role: row.Role,
    email: row.Email,
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

module.exports = { toAppliance, toRoom, toAdmin, toLog };
