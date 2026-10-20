-- AURA Sukhumvit 36 — Room Rental Management System
-- Based on Phase 1 Data Dictionary (AdminAccount / RoomUnit / Log)
-- + multivalued attrs split into tables (AdminEmail, RoomAppliance)
-- + additions required by the wireframes (Status/UpdatedAt, ConditionRating, Floor, RoomImage, Booking)

DROP DATABASE IF EXISTS aura_rental;
CREATE DATABASE aura_rental CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE aura_rental;

CREATE TABLE AdminAccount (
  Username    VARCHAR(50)  NOT NULL,
  Password    VARCHAR(255) NOT NULL,              -- bcrypt hash only
  Fname       VARCHAR(100) NOT NULL,
  Lname       VARCHAR(100) NOT NULL,
  Address     VARCHAR(255) NULL,
  Role        ENUM('super_admin','listing_admin','operations') NOT NULL DEFAULT 'listing_admin',
  `Require`   VARCHAR(255) NULL,                  -- reserved word in MySQL: always quote with backticks
  Status      ENUM('active','inactive') NOT NULL DEFAULT 'active',
  CreatedAt   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UpdatedAt   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (Username)
);

CREATE TABLE AdminEmail (
  Username VARCHAR(50)  NOT NULL,
  Email    VARCHAR(100) NOT NULL,
  PRIMARY KEY (Username, Email),
  UNIQUE KEY uq_admin_email (Email),             -- login accepts an email, so it must identify one admin
  FOREIGN KEY (Username) REFERENCES AdminAccount(Username)
    ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE TABLE RoomUnit (
  RoomID           INT           NOT NULL,          -- room number, e.g. 1201
  Building         VARCHAR(100)  NOT NULL DEFAULT 'AURA Sukhumvit 36',
  Floor            INT           NOT NULL,
  RoomType         ENUM('Standard','Deluxe','Suite') NOT NULL,
  NumberOfBedroom  INT           NOT NULL DEFAULT 1,
  RoomSize         DECIMAL(6,2)  NOT NULL,          -- sq.m.
  Price            DECIMAL(10,2) NOT NULL,          -- THB per month
  RoomConditions   TEXT          NULL,              -- "About this room" description
  ConditionRating  TINYINT       NOT NULL DEFAULT 3, -- 1-5 (shown as "สภาพห้อง 3.0")
  MinimumLeases    INT           NOT NULL DEFAULT 12, -- months
  Availability     BOOLEAN       NOT NULL DEFAULT TRUE,
  OwnerName        VARCHAR(150)  NOT NULL,
  OwnerPhoneNumber VARCHAR(20)   NULL,
  OwnerEmail       VARCHAR(100)  NULL,
  OwnerLineID      VARCHAR(50)   NULL,
  CreatedAt        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UpdatedAt        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (RoomID),
  CHECK (Price >= 0),
  CHECK (RoomSize > 0),
  CHECK (ConditionRating BETWEEN 1 AND 5),
  CHECK (MinimumLeases >= 1)
);

CREATE TABLE RoomAppliance (
  RoomID    INT         NOT NULL,
  Appliance VARCHAR(50) NOT NULL,
  PRIMARY KEY (RoomID, Appliance),
  FOREIGN KEY (RoomID) REFERENCES RoomUnit(RoomID)
    ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE TABLE RoomImage (
  ImageID   INT          NOT NULL AUTO_INCREMENT,
  RoomID    INT          NOT NULL,
  FilePath  VARCHAR(255) NOT NULL,                  -- e.g. /uploads/1201-abc.jpg
  SortOrder INT          NOT NULL DEFAULT 0,
  PRIMARY KEY (ImageID),
  FOREIGN KEY (RoomID) REFERENCES RoomUnit(RoomID)
    ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE TABLE Booking (
  BookingID      INT          NOT NULL AUTO_INCREMENT,
  RoomID         INT          NOT NULL,
  FullName       VARCHAR(150) NOT NULL,
  IdentityNumber VARCHAR(20)  NOT NULL,
  Phone          VARCHAR(20)  NOT NULL,
  Email          VARCHAR(100) NOT NULL,
  MoveInDate     DATE         NOT NULL,
  Status         ENUM('pending','confirmed','cancelled') NOT NULL DEFAULT 'pending',
  CreatedAt      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (BookingID),
  FOREIGN KEY (RoomID) REFERENCES RoomUnit(RoomID)
    ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE TABLE Log (
  LogID    INT          NOT NULL AUTO_INCREMENT,
  Username VARCHAR(50)  NULL,                       -- NULL if the admin was later deleted
  Changed  VARCHAR(500) NOT NULL,
  DateTime DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (LogID),
  FOREIGN KEY (Username) REFERENCES AdminAccount(Username)
    ON UPDATE CASCADE ON DELETE SET NULL
);
