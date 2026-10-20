-- AURA Sukhumvit 36 — sample data
-- Run after schema.sql (`npm run db:reset` in backend/ does both).
-- Admin passwords are bcrypt hashes (cost 10) of:
--   admin_main   / Admin@1234    (super_admin, active)
--   listing_ploy / Listing@1234  (listing_admin, active)
--   ops_niran    / Ops@12345     (operations, INACTIVE: login is refused with 403)

USE aura_rental;

INSERT INTO AdminAccount (Username, Password, Fname, Lname, Address, Role, Status) VALUES
  ('admin_main',   '$2b$10$8JBCbK6N1QiX96njL0YFueWFIbbnPtdZvvCx3uSMi6DLkRVU3h9ve', 'Somchai', 'Jaidee',   '36 Sukhumvit 36, Khlong Toei, Bangkok 10110', 'super_admin',   'active'),
  ('listing_ploy', '$2b$10$8XiNVFF4ttmpssros1MtE.6maCdF/z7rbHESfuYvGQkRBrgE.1pU2', 'Ploy',    'Srisuk',   NULL,                                          'listing_admin', 'active'),
  ('ops_niran',    '$2b$10$bXE1FZ2sOlzPX90pLi7p4O.8m0Xkb6q9a11b.Gd3zi9Ojqf.Exr4q', 'Niran',   'Thongdee', NULL,                                          'operations',    'inactive');

INSERT INTO AdminEmail (Username, Email) VALUES
  ('admin_main',   'somchai.j@aura36.co.th'),
  ('admin_main',   'admin@aura36.co.th'),
  ('listing_ploy', 'ploy.s@aura36.co.th'),
  ('ops_niran',    'niran.t@aura36.co.th');

INSERT INTO RoomUnit
  (RoomID, Floor, RoomType, NumberOfBedroom, RoomSize, Price, RoomConditions, ConditionRating, MinimumLeases, Availability,
   OwnerName, OwnerPhoneNumber, OwnerEmail, OwnerLineID) VALUES
  (203,  2,  'Standard', 1, 26.00,  9500,  'Garden-facing unit on a low floor, quiet and close to the lobby. Fully furnished.', 3, 12, TRUE,
   'Wanchai Boonmee',      '081-234-5601', 'wanchai.b@gmail.com',    'wanchai203'),
  (207,  2,  'Standard', 0, 22.00,  8500,  'Compact studio, ideal for students. Built-in wardrobe and kitchenette.',          2, 6,  TRUE,
   'Kanokwan Saelim',      '089-552-1407', 'kanokwan.s@hotmail.com', 'kanok_s'),
  (315,  3,  'Standard', 1, 28.00,  10000, 'Renovated in 2025 with new flooring. Pool view from the balcony.',               4, 12, FALSE,
   'Prasert Chaiyaporn',   '086-771-3150', NULL,                     'prasert.c'),
  (508,  5,  'Deluxe',   1, 34.00,  14500, 'Corner Deluxe with two windows and plenty of natural light.',                    3, 12, TRUE,
   'Suda Rattanakul',      '081-908-5080', 'suda.r@gmail.com',       'suda508'),
  (612,  6,  'Standard', 1, 27.00,  9800,  'Simple, clean room facing the inner courtyard. Short lease accepted.',           3, 6,  TRUE,
   'Anan Kittisak',        '092-116-6120', 'anan.k@yahoo.com',       NULL),
  (804,  8,  'Deluxe',   1, 35.00,  15000, 'Bright Deluxe unit with a separate living area and city view.',                  4, 12, FALSE,
   'Malee Wongsawat',      '083-440-8041', 'malee.w@gmail.com',      'malee_w'),
  (1005, 10, 'Deluxe',   2, 48.00,  19500, 'Two-bedroom Deluxe, good for small families. Walk to BTS Thong Lo in 8 minutes.', 4, 12, TRUE,
   'Thanawat Phromma',     '095-330-1005', 'thanawat.p@outlook.com', 'thanawat10'),
  (1201, 12, 'Deluxe',   1, 34.00,  15000, 'A bright, fully furnished Deluxe room with a north-facing balcony.',             3, 12, TRUE,
   'Natthaya Siriwan',     '080-123-1234', 'natthaya.s@gmail.com',   'natthaya1201'),
  (1210, 12, 'Standard', 1, 30.00,  11000, 'Brand-new interior, never lived in after the 2026 renovation.',                  5, 12, TRUE,
   'Chaiwat Inthong',      '084-212-1210', NULL,                     'chaiwat.i'),
  (1407, 14, 'Suite',    2, 62.00,  28000, 'Spacious Suite with a full kitchen and a large living room.',                   4, 12, TRUE,
   'Pimchanok Lertsiri',   '081-614-0707', 'pimchanok.l@gmail.com',  'pim1407'),
  (1503, 15, 'Deluxe',   1, 36.00,  16000, 'Older furniture, priced accordingly. Owner can replace the sofa on request.',   2, 6,  FALSE,
   'Somsak Prasertsuk',    '087-150-3150', 'somsak.p@gmail.com',     NULL),
  (1711, 17, 'Standard', 1, 29.00,  10500, 'Mid-floor Standard room with an east-facing window and morning sun.',          3, 12, TRUE,
   'Jiraporn Kaewmanee',   '090-171-1711', 'jiraporn.k@hotmail.com', 'jiraporn17'),
  (1802, 18, 'Suite',    2, 68.00,  32000, 'Premium Suite with a bathtub and two balconies over Sukhumvit.',                5, 12, FALSE,
   'Kittipong Wattanakul', '081-818-0218', 'kittipong.w@gmail.com',  'kittipong.w'),
  (2006, 20, 'Deluxe',   2, 45.00,  21000, 'High-floor Deluxe with two bedrooms and a skyline view.',                       4, 12, TRUE,
   'Orawan Chantarasri',   '093-200-6200', 'orawan.c@gmail.com',     'orawan2006'),
  (2209, 22, 'Standard', 1, 30.00,  12000, 'Well kept Standard room, quiet floor, close to the sky garden.',                 4, 6,  TRUE,
   'Phongsakorn Meesuk',   '086-220-9220', NULL,                     'phongsakorn'),
  (2401, 24, 'Suite',    3, 95.00,  45000, 'Three-bedroom family Suite with a maid room and two parking spaces.',           5, 24, TRUE,
   'Rattana Sukjai',       '081-240-1240', 'rattana.s@gmail.com',    'rattana2401'),
  (2512, 25, 'Deluxe',   1, 38.00,  17500, 'Deluxe room with a work-from-home corner and fibre internet ready.',            3, 12, FALSE,
   'Teerapat Wongchai',    '089-251-2251', 'teerapat.w@gmail.com',   'teerapat.w'),
  (2708, 27, 'Suite',    2, 72.00,  36000, 'Suite with panoramic windows and a large dining area.',                         4, 12, TRUE,
   'Sirilak Panyawong',    '082-270-8270', 'sirilak.p@gmail.com',    'sirilak27'),
  (2903, 29, 'Deluxe',   2, 50.00,  23000, 'Recently refurbished two-bedroom Deluxe near the rooftop pool.',                5, 12, TRUE,
   'Weerachai Thammasat',  '091-290-3290', 'weerachai.t@gmail.com',  NULL),
  (3001, 30, 'Suite',    3, 110.00, 55000, 'Penthouse Suite on the top floor with a private terrace.',                      5, 24, TRUE,
   'Arunee Sombat',        '081-300-1300', 'arunee.s@gmail.com',     'arunee.penthouse');

INSERT INTO RoomAppliance (RoomID, Appliance) VALUES
  (203, 'Air conditioner'), (203, 'Fridge'), (203, 'Water heater'), (203, 'TV'),
  (207, 'Air conditioner'), (207, 'Water heater'), (207, 'Microwave'),
  (315, 'Air conditioner'), (315, 'Fridge'), (315, 'Water heater'), (315, 'Sofa'), (315, 'TV'),
  (508, 'Air conditioner'), (508, 'Fridge'), (508, 'Water heater'), (508, 'Sofa'), (508, 'TV'), (508, 'Microwave'),
  (612, 'Air conditioner'), (612, 'Water heater'),
  (804, 'Air conditioner'), (804, 'Fridge'), (804, 'Water heater'), (804, 'Sofa'), (804, 'TV'), (804, 'Washing machine'),
  (1005, 'Air conditioner'), (1005, 'Fridge'), (1005, 'Water heater'), (1005, 'Sofa'), (1005, 'TV'), (1005, 'Washing machine'), (1005, 'Induction stove'),
  (1201, 'Sofa'), (1201, 'Fridge'), (1201, 'Air conditioner'), (1201, 'Water heater'), (1201, 'TV'),
  (1210, 'Air conditioner'), (1210, 'Fridge'), (1210, 'Water heater'), (1210, 'Microwave'),
  (1407, 'Air conditioner'), (1407, 'Fridge'), (1407, 'Water heater'), (1407, 'Sofa'), (1407, 'TV'), (1407, 'Washing machine'), (1407, 'Induction stove'), (1407, 'Microwave'),
  (1503, 'Air conditioner'), (1503, 'Sofa'), (1503, 'Water heater'),
  (1711, 'Air conditioner'), (1711, 'Fridge'), (1711, 'Water heater'), (1711, 'TV'),
  (1802, 'Air conditioner'), (1802, 'Fridge'), (1802, 'Water heater'), (1802, 'Heater'), (1802, 'Sofa'), (1802, 'TV'), (1802, 'HomePhone'), (1802, 'Washing machine'), (1802, 'Induction stove'), (1802, 'Microwave'),
  (2006, 'Air conditioner'), (2006, 'Fridge'), (2006, 'Water heater'), (2006, 'Sofa'), (2006, 'TV'), (2006, 'Washing machine'),
  (2209, 'Air conditioner'), (2209, 'Fridge'), (2209, 'Water heater'),
  (2401, 'Air conditioner'), (2401, 'Fridge'), (2401, 'Water heater'), (2401, 'Heater'), (2401, 'Sofa'), (2401, 'TV'), (2401, 'HomePhone'), (2401, 'Washing machine'), (2401, 'Induction stove'), (2401, 'Microwave'),
  (2512, 'Air conditioner'), (2512, 'Fridge'), (2512, 'Water heater'), (2512, 'Sofa'), (2512, 'TV'),
  (2708, 'Air conditioner'), (2708, 'Fridge'), (2708, 'Water heater'), (2708, 'Sofa'), (2708, 'TV'), (2708, 'Washing machine'), (2708, 'Induction stove'),
  (2903, 'Air conditioner'), (2903, 'Fridge'), (2903, 'Water heater'), (2903, 'Sofa'), (2903, 'TV'), (2903, 'Washing machine'), (2903, 'Microwave'),
  (3001, 'Air conditioner'), (3001, 'Fridge'), (3001, 'Water heater'), (3001, 'Heater'), (3001, 'Sofa'), (3001, 'TV'), (3001, 'HomePhone'), (3001, 'Washing machine'), (3001, 'Induction stove'), (3001, 'Microwave');

INSERT INTO Booking (RoomID, FullName, IdentityNumber, Phone, Email, MoveInDate, Status) VALUES
  (1201, 'Kamonchanok Jaiyen', '1103700123456', '0812345678', 'kamonchanok.j@gmail.com', '2026-12-01', 'pending'),
  (2006, 'David Miller',       '1100800456789', '0898765432', 'david.miller@gmail.com',  '2026-11-15', 'confirmed'),
  (1407, 'Supansa Thongkam',   '3101200987654', '0861112222', 'supansa.t@hotmail.com',   '2027-01-05', 'cancelled');
