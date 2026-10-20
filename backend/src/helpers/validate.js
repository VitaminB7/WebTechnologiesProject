// validate.js — ฟังก์ชันตรวจข้อมูลเล็ก ๆ ที่หลาย route ใช้ร่วมกัน
// ทุกฟังก์ชันตอบแค่ true / false (หรือแปลงค่าให้) ส่วนข้อความ error ให้ route เขียนเอง
// หมายเหตุ: ข้อมูลจากฟอร์ม/URL มักมาเป็น "ข้อความ" เช่น "15000" จึงยอมรับตัวเลขที่เป็นข้อความด้วย

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ว่างหรือไม่: undefined, null, "" หรือมีแต่ช่องว่าง
function isBlank(value) {
  if (value === undefined || value === null) {
    return true;
  }
  if (typeof value === 'string' && value.trim() === '') {
    return true;
  }
  return false;
}

// เป็น object ธรรมดา { ... } หรือไม่ (ไม่ใช่ array ไม่ใช่ null)
function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

// เป็นข้อความที่ยาวไม่เกิน maxLength ตัวอักษร (นับหลังตัดช่องว่างหัวท้าย)
function isText(value, maxLength) {
  return typeof value === 'string' && value.trim().length <= maxLength;
}

// แปลงเป็นตัวเลข: รับทั้ง 15000 และ "15000" ถ้าแปลงไม่ได้ได้ NaN
function toNumber(value) {
  if (typeof value === 'number') {
    return value;
  }
  if (typeof value === 'string' && value.trim() !== '') {
    return Number(value);
  }
  return NaN;
}

// เป็นจำนวนเต็มในช่วง min..max หรือไม่
function isIntBetween(value, min, max) {
  const number = toNumber(value);
  return Number.isInteger(number) && number >= min && number <= max;
}

// เป็นตัวเลข (มีทศนิยมได้) ในช่วง min..max หรือไม่
function isNumberBetween(value, min, max) {
  const number = toNumber(value);
  return Number.isFinite(number) && number >= min && number <= max;
}

// เป็นอีเมลที่ถูกรูปแบบ และยาวไม่เกิน 100 ตัวอักษร
function isEmail(value) {
  return isText(value, 100) && EMAIL_PATTERN.test(value.trim());
}

// เป็นค่าหนึ่งในรายการที่อนุญาตหรือไม่ เช่น isOneOf('Admin', ['Admin', 'SuperAdmin'])
function isOneOf(value, allowedList) {
  return typeof value === 'string' && allowedList.includes(value);
}

// เป็น true/false หรือไม่ (รับ "true"/"false" ที่มาจาก URL ด้วย)
function isBoolean(value) {
  return value === true || value === false || value === 'true' || value === 'false';
}

function toBoolean(value) {
  return value === true || value === 'true';
}

// ข้อความที่ไม่บังคับกรอก: ว่าง -> null, ไม่ว่าง -> ตัดช่องว่างหัวท้าย
function textOrNull(value) {
  if (isBlank(value)) {
    return null;
  }
  return value.trim();
}

// มี error อย่างน้อยหนึ่งข้อหรือไม่
function hasErrors(errors) {
  return Object.keys(errors).length > 0;
}

// ทำข้อความค้นหาให้ใช้กับ SQL LIKE ได้อย่างปลอดภัย:
// ใส่ \ หน้า % _ \ เพื่อให้ค้นตามตัวอักษรจริง แล้วครอบด้วย % (= "มีคำนี้อยู่ตรงไหนก็ได้")
function toLikePattern(text) {
  let escaped = '';
  for (const char of text) {
    if (char === '%' || char === '_' || char === '\\') {
      escaped += '\\';
    }
    escaped += char;
  }
  return `%${escaped}%`;
}

module.exports = {
  isBlank,
  isObject,
  isText,
  toNumber,
  isIntBetween,
  isNumberBetween,
  isEmail,
  isOneOf,
  isBoolean,
  toBoolean,
  textOrNull,
  hasErrors,
  toLikePattern,
};
