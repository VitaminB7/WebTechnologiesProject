-- AURA Sukhumvit 36 — Room Rental Management System
-- Follows the group's Data Dictionary (report section 3.2): AdminAccount, RoomUnit, Log, Appliance.
-- Additions the wireframe needs (add them to the Data Dictionary in the report too):
--   RoomUnit.Floor, RoomUnit.ConditionRating  -> search filters + detail page
--   RoomImage table                           -> room photos (detail page + upload in room management)
-- Also: CHECK constraints for the "range" column of the dictionary,
-- and UNIQUE(Email) because admins can log in with their email.

DROP DATABASE IF EXISTS aura_rental;
CREATE DATABASE aura_rental CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE aura_rental;

CREATE TABLE AdminAccount (
  Username VARCHAR(50)  NOT NULL,
  Password VARCHAR(255) NOT NULL,                  -- bcrypt hash only
  Fname    VARCHAR(100) NOT NULL,
  Lname    VARCHAR(100) NOT NULL,
  Address  VARCHAR(255) NULL,
  Role     VARCHAR(30)  NOT NULL,
  Email    VARCHAR(100) NULL,
  PRIMARY KEY (Username),
  UNIQUE KEY uq_admin_email (Email),
  CHECK (Role IN ('Admin', 'SuperAdmin'))
);

CREATE TABLE RoomUnit (
  RoomID           CHAR(8)       NOT NULL,          -- format L-xxxx, e.g. L-1201
  Building         VARCHAR(100)  NOT NULL,
  Floor            INT           NOT NULL,          -- added for the wireframe
  RoomType         VARCHAR(50)   NOT NULL,
  NumberOfBedroom  INT           NOT NULL,
  RoomSize         DECIMAL(6,2)  NULL,              -- sq.m.
  Price            DECIMAL(10,2) NOT NULL,          -- THB per month
  RoomConditions   TEXT          NULL,              -- "About this room" description
  ConditionRating  INT           NOT NULL,          -- added for the wireframe: 1-5 ("สภาพห้อง 3.0")
  MinimumLeases    INT           NULL,              -- months
  Availability     BOOLEAN       NOT NULL,
  OwnerName        VARCHAR(150)  NOT NULL,
  OwnerPhoneNumber VARCHAR(20)   NOT NULL,          -- format 000-000-0000
  OwnerEmail       VARCHAR(100)  NULL,
  OwnerLineID      VARCHAR(50)   NULL,
  PRIMARY KEY (RoomID),
  CHECK (RoomID REGEXP '^L-[0-9]{4}$'),
  CHECK (RoomType IN ('Studio', '1 Bedroom', '2 Bedroom', 'Deluxe room')),
  CHECK (Floor BETWEEN 1 AND 99),
  CHECK (ConditionRating BETWEEN 1 AND 5),
  CHECK (NumberOfBedroom BETWEEN 0 AND 10),
  CHECK (RoomSize BETWEEN 1.00 AND 500.00),
  CHECK (Price BETWEEN 0.00 AND 999999.99),
  CHECK (MinimumLeases BETWEEN 1 AND 36)
);

CREATE TABLE Log (
  LogID    VARCHAR(50)  NOT NULL,                  -- format L-x, e.g. L-1, L-2 (assigned by the back end)
  Username VARCHAR(50)  NOT NULL,
  Changed  VARCHAR(500) NOT NULL,
  DateTime DATETIME     NOT NULL,
  PRIMARY KEY (LogID),
  -- Username is NOT NULL, so deleting an admin also deletes that admin's log rows.
  FOREIGN KEY (Username) REFERENCES AdminAccount(Username)
    ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE TABLE Appliance (
  Serial_number  VARCHAR(50)  NOT NULL,
  RoomID         VARCHAR(8)   NOT NULL,
  Name_appliance VARCHAR(100) NOT NULL,
  PRIMARY KEY (Serial_number, RoomID),
  FOREIGN KEY (RoomID) REFERENCES RoomUnit(RoomID)
    ON UPDATE CASCADE ON DELETE CASCADE
);

-- Added for the wireframe: room photos. The files live in the web service's uploads/ folder.
CREATE TABLE RoomImage (
  ImageID   INT          NOT NULL AUTO_INCREMENT,
  RoomID    VARCHAR(8)   NOT NULL,
  FilePath  VARCHAR(255) NOT NULL,                  -- e.g. /uploads/L-1201-a1b2c3.jpg
  SortOrder INT          NOT NULL DEFAULT 0,
  PRIMARY KEY (ImageID),
  FOREIGN KEY (RoomID) REFERENCES RoomUnit(RoomID)
    ON UPDATE CASCADE ON DELETE CASCADE
);
