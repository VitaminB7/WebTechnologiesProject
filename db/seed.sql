-- AURA Sukhumvit 36 — sample data (matches the Data Dictionary in the report)
-- Run after schema.sql (`npm run db:reset` in backend/ does both).
-- TODO(ยังขาด): ห้องตัวอย่างยังไม่มีรูป (ตาราง RoomImage ว่าง) หน้า Detail จึงเป็นกล่องเทา ต้องอัปโหลดรูปจริง
-- TODO(ยังขาด): ส่งงานต้อง export ฐานข้อมูลเป็นไฟล์เดียวชื่อ sec2_gr1_database.sql (โครงสร้าง + ข้อมูล)
-- Admin passwords are bcrypt hashes (cost 10) of:
--   admin_main   / Admin@1234    (SuperAdmin, can also log in with admin@aura36.co.th)
--   listing_ploy / Listing@1234  (Admin)
--   ops_niran    / Ops@12345     (Admin, no email)

USE aura_rental;

INSERT INTO AdminAccount (Username, Password, Fname, Lname, Address, Role, Email) VALUES
  ('admin_main',   '$2b$10$8JBCbK6N1QiX96njL0YFueWFIbbnPtdZvvCx3uSMi6DLkRVU3h9ve', 'Somchai', 'Jaidee',   '36 Sukhumvit 36, Khlong Toei, Bangkok 10110', 'SuperAdmin', 'admin@aura36.co.th'),
  ('listing_ploy', '$2b$10$8XiNVFF4ttmpssros1MtE.6maCdF/z7rbHESfuYvGQkRBrgE.1pU2', 'Ploy',    'Srisuk',   NULL,                                          'Admin',      'ploy.s@aura36.co.th'),
  ('ops_niran',    '$2b$10$bXE1FZ2sOlzPX90pLi7p4O.8m0Xkb6q9a11b.Gd3zi9Ojqf.Exr4q', 'Niran',   'Thongdee', NULL,                                          'Admin',      NULL);

INSERT INTO RoomUnit
  (RoomID, Building, Floor, RoomType, NumberOfBedroom, RoomSize, Price, RoomConditions, ConditionRating, MinimumLeases, Availability,
   OwnerName, OwnerPhoneNumber, OwnerEmail, OwnerLineID) VALUES
  ('L-0203', 'Building A', 2, '1 Bedroom', 1, 26.00, 9500, 'Garden-facing unit on a low floor, quiet and close to the lobby. Fully furnished.', 3, 12, TRUE,
   'Wanchai Boonmee', '081-234-5601', 'wanchai.b@gmail.com', 'wanchai203'),
  ('L-0207', 'Building A', 2, 'Studio', 0, 22.00, 8500, 'Compact studio, ideal for students. Built-in wardrobe and kitchenette.', 2, 6, TRUE,
   'Kanokwan Saelim', '089-552-1407', 'kanokwan.s@hotmail.com', 'kanok_s'),
  ('L-0315', 'Building A', 3, '1 Bedroom', 1, 28.00, 10000, 'Renovated in 2025 with new flooring. Pool view from the balcony.', 4, 12, FALSE,
   'Prasert Chaiyaporn', '086-771-3150', NULL, 'prasert.c'),
  ('L-0508', 'Building A', 5, 'Deluxe room', 1, 34.00, 14500, 'Corner Deluxe with two windows and plenty of natural light.', 3, 12, TRUE,
   'Suda Rattanakul', '081-908-5080', 'suda.r@gmail.com', 'suda508'),
  ('L-0612', 'Building A', 6, '1 Bedroom', 1, 27.00, 9800, 'Simple, clean room facing the inner courtyard. Short lease accepted.', 3, 6, TRUE,
   'Anan Kittisak', '092-116-6120', 'anan.k@yahoo.com', NULL),
  ('L-0804', 'Building A', 8, 'Deluxe room', 1, 35.00, 15000, 'Bright Deluxe unit with a separate living area and city view.', 4, 12, FALSE,
   'Malee Wongsawat', '083-440-8041', 'malee.w@gmail.com', 'malee_w'),
  ('L-1005', 'Building A', 10, '2 Bedroom', 2, 48.00, 19500, 'Two-bedroom Deluxe, good for small families. Walk to BTS Thong Lo in 8 minutes.', 4, 12, TRUE,
   'Thanawat Phromma', '095-330-1005', 'thanawat.p@outlook.com', 'thanawat10'),
  ('L-1201', 'Building A', 12, 'Deluxe room', 1, 34.00, 15000, 'A bright, fully furnished Deluxe room with a north-facing balcony.', 3, 12, TRUE,
   'Natthaya Siriwan', '080-123-1234', 'natthaya.s@gmail.com', 'natthaya1201'),
  ('L-1210', 'Building A', 12, '1 Bedroom', 1, 30.00, 11000, 'Brand-new interior, never lived in after the 2026 renovation.', 5, 12, TRUE,
   'Chaiwat Inthong', '084-212-1210', NULL, 'chaiwat.i'),
  ('L-1407', 'Building A', 14, 'Deluxe room', 2, 62.00, 28000, 'Spacious Suite with a full kitchen and a large living room.', 4, 12, TRUE,
   'Pimchanok Lertsiri', '081-614-0707', 'pimchanok.l@gmail.com', 'pim1407'),
  ('L-1503', 'Building A', 15, 'Deluxe room', 1, 36.00, 16000, 'Older furniture, priced accordingly. Owner can replace the sofa on request.', 2, 6, FALSE,
   'Somsak Prasertsuk', '087-150-3150', 'somsak.p@gmail.com', NULL),
  ('L-1711', 'Building B', 17, '1 Bedroom', 1, 29.00, 10500, 'Mid-floor Standard room with an east-facing window and morning sun.', 3, 12, TRUE,
   'Jiraporn Kaewmanee', '090-171-1711', 'jiraporn.k@hotmail.com', 'jiraporn17'),
  ('L-1802', 'Building B', 18, 'Deluxe room', 2, 68.00, 32000, 'Premium Suite with a bathtub and two balconies over Sukhumvit.', 5, 12, FALSE,
   'Kittipong Wattanakul', '081-818-0218', 'kittipong.w@gmail.com', 'kittipong.w'),
  ('L-2006', 'Building B', 20, '2 Bedroom', 2, 45.00, 21000, 'High-floor Deluxe with two bedrooms and a skyline view.', 4, 12, TRUE,
   'Orawan Chantarasri', '093-200-6200', 'orawan.c@gmail.com', 'orawan2006'),
  ('L-2209', 'Building B', 22, '1 Bedroom', 1, 30.00, 12000, 'Well kept Standard room, quiet floor, close to the sky garden.', 4, 6, TRUE,
   'Phongsakorn Meesuk', '086-220-9220', NULL, 'phongsakorn'),
  ('L-2401', 'Building B', 24, 'Deluxe room', 3, 95.00, 45000, 'Three-bedroom family Suite with a maid room and two parking spaces.', 5, 24, TRUE,
   'Rattana Sukjai', '081-240-1240', 'rattana.s@gmail.com', 'rattana2401'),
  ('L-2512', 'Building B', 25, 'Deluxe room', 1, 38.00, 17500, 'Deluxe room with a work-from-home corner and fibre internet ready.', 3, 12, FALSE,
   'Teerapat Wongchai', '089-251-2251', 'teerapat.w@gmail.com', 'teerapat.w'),
  ('L-2708', 'Building B', 27, 'Deluxe room', 2, 72.00, 36000, 'Suite with panoramic windows and a large dining area.', 4, 12, TRUE,
   'Sirilak Panyawong', '082-270-8270', 'sirilak.p@gmail.com', 'sirilak27'),
  ('L-2903', 'Building B', 29, '2 Bedroom', 2, 50.00, 23000, 'Recently refurbished two-bedroom Deluxe near the rooftop pool.', 5, 12, TRUE,
   'Weerachai Thammasat', '091-290-3290', 'weerachai.t@gmail.com', NULL),
  ('L-3001', 'Building B', 30, 'Deluxe room', 3, 110.00, 55000, 'Penthouse Suite on the top floor with a private terrace.', 5, 24, TRUE,
   'Arunee Sombat', '081-300-1300', 'arunee.s@gmail.com', 'arunee.penthouse');

INSERT INTO Appliance (Serial_number, RoomID, Name_appliance) VALUES
  ('AC-0203-01', 'L-0203', 'Air conditioner'), ('FR-0203-02', 'L-0203', 'Fridge'), ('WH-0203-03', 'L-0203', 'Water heater'), ('TV-0203-04', 'L-0203', 'TV'),
  ('AC-0207-01', 'L-0207', 'Air conditioner'), ('WH-0207-02', 'L-0207', 'Water heater'), ('MW-0207-03', 'L-0207', 'Microwave'),
  ('AC-0315-01', 'L-0315', 'Air conditioner'), ('FR-0315-02', 'L-0315', 'Fridge'), ('WH-0315-03', 'L-0315', 'Water heater'), ('SF-0315-04', 'L-0315', 'Sofa'), ('TV-0315-05', 'L-0315', 'TV'),
  ('AC-0508-01', 'L-0508', 'Air conditioner'), ('FR-0508-02', 'L-0508', 'Fridge'), ('WH-0508-03', 'L-0508', 'Water heater'), ('SF-0508-04', 'L-0508', 'Sofa'), ('TV-0508-05', 'L-0508', 'TV'), ('MW-0508-06', 'L-0508', 'Microwave'),
  ('AC-0612-01', 'L-0612', 'Air conditioner'), ('WH-0612-02', 'L-0612', 'Water heater'),
  ('AC-0804-01', 'L-0804', 'Air conditioner'), ('FR-0804-02', 'L-0804', 'Fridge'), ('WH-0804-03', 'L-0804', 'Water heater'), ('SF-0804-04', 'L-0804', 'Sofa'), ('TV-0804-05', 'L-0804', 'TV'), ('WM-0804-06', 'L-0804', 'Washing machine'),
  ('AC-1005-01', 'L-1005', 'Air conditioner'), ('FR-1005-02', 'L-1005', 'Fridge'), ('WH-1005-03', 'L-1005', 'Water heater'), ('SF-1005-04', 'L-1005', 'Sofa'), ('TV-1005-05', 'L-1005', 'TV'), ('WM-1005-06', 'L-1005', 'Washing machine'), ('IS-1005-07', 'L-1005', 'Induction stove'),
  ('SF-1201-01', 'L-1201', 'Sofa'), ('FR-1201-02', 'L-1201', 'Fridge'), ('AC-1201-03', 'L-1201', 'Air conditioner'), ('WH-1201-04', 'L-1201', 'Water heater'), ('TV-1201-05', 'L-1201', 'TV'),
  ('AC-1210-01', 'L-1210', 'Air conditioner'), ('FR-1210-02', 'L-1210', 'Fridge'), ('WH-1210-03', 'L-1210', 'Water heater'), ('MW-1210-04', 'L-1210', 'Microwave'),
  ('AC-1407-01', 'L-1407', 'Air conditioner'), ('FR-1407-02', 'L-1407', 'Fridge'), ('WH-1407-03', 'L-1407', 'Water heater'), ('SF-1407-04', 'L-1407', 'Sofa'), ('TV-1407-05', 'L-1407', 'TV'), ('WM-1407-06', 'L-1407', 'Washing machine'), ('IS-1407-07', 'L-1407', 'Induction stove'), ('MW-1407-08', 'L-1407', 'Microwave'),
  ('AC-1503-01', 'L-1503', 'Air conditioner'), ('SF-1503-02', 'L-1503', 'Sofa'), ('WH-1503-03', 'L-1503', 'Water heater'),
  ('AC-1711-01', 'L-1711', 'Air conditioner'), ('FR-1711-02', 'L-1711', 'Fridge'), ('WH-1711-03', 'L-1711', 'Water heater'), ('TV-1711-04', 'L-1711', 'TV'),
  ('AC-1802-01', 'L-1802', 'Air conditioner'), ('FR-1802-02', 'L-1802', 'Fridge'), ('WH-1802-03', 'L-1802', 'Water heater'), ('HT-1802-04', 'L-1802', 'Heater'), ('SF-1802-05', 'L-1802', 'Sofa'), ('TV-1802-06', 'L-1802', 'TV'), ('HP-1802-07', 'L-1802', 'HomePhone'), ('WM-1802-08', 'L-1802', 'Washing machine'), ('IS-1802-09', 'L-1802', 'Induction stove'), ('MW-1802-10', 'L-1802', 'Microwave'),
  ('AC-2006-01', 'L-2006', 'Air conditioner'), ('FR-2006-02', 'L-2006', 'Fridge'), ('WH-2006-03', 'L-2006', 'Water heater'), ('SF-2006-04', 'L-2006', 'Sofa'), ('TV-2006-05', 'L-2006', 'TV'), ('WM-2006-06', 'L-2006', 'Washing machine'),
  ('AC-2209-01', 'L-2209', 'Air conditioner'), ('FR-2209-02', 'L-2209', 'Fridge'), ('WH-2209-03', 'L-2209', 'Water heater'),
  ('AC-2401-01', 'L-2401', 'Air conditioner'), ('FR-2401-02', 'L-2401', 'Fridge'), ('WH-2401-03', 'L-2401', 'Water heater'), ('HT-2401-04', 'L-2401', 'Heater'), ('SF-2401-05', 'L-2401', 'Sofa'), ('TV-2401-06', 'L-2401', 'TV'), ('HP-2401-07', 'L-2401', 'HomePhone'), ('WM-2401-08', 'L-2401', 'Washing machine'), ('IS-2401-09', 'L-2401', 'Induction stove'), ('MW-2401-10', 'L-2401', 'Microwave'),
  ('AC-2512-01', 'L-2512', 'Air conditioner'), ('FR-2512-02', 'L-2512', 'Fridge'), ('WH-2512-03', 'L-2512', 'Water heater'), ('SF-2512-04', 'L-2512', 'Sofa'), ('TV-2512-05', 'L-2512', 'TV'),
  ('AC-2708-01', 'L-2708', 'Air conditioner'), ('FR-2708-02', 'L-2708', 'Fridge'), ('WH-2708-03', 'L-2708', 'Water heater'), ('SF-2708-04', 'L-2708', 'Sofa'), ('TV-2708-05', 'L-2708', 'TV'), ('WM-2708-06', 'L-2708', 'Washing machine'), ('IS-2708-07', 'L-2708', 'Induction stove'),
  ('AC-2903-01', 'L-2903', 'Air conditioner'), ('FR-2903-02', 'L-2903', 'Fridge'), ('WH-2903-03', 'L-2903', 'Water heater'), ('SF-2903-04', 'L-2903', 'Sofa'), ('TV-2903-05', 'L-2903', 'TV'), ('WM-2903-06', 'L-2903', 'Washing machine'), ('MW-2903-07', 'L-2903', 'Microwave'),
  ('AC-3001-01', 'L-3001', 'Air conditioner'), ('FR-3001-02', 'L-3001', 'Fridge'), ('WH-3001-03', 'L-3001', 'Water heater'), ('HT-3001-04', 'L-3001', 'Heater'), ('SF-3001-05', 'L-3001', 'Sofa'), ('TV-3001-06', 'L-3001', 'TV'), ('HP-3001-07', 'L-3001', 'HomePhone'), ('WM-3001-08', 'L-3001', 'Washing machine'), ('IS-3001-09', 'L-3001', 'Induction stove'), ('MW-3001-10', 'L-3001', 'Microwave');
