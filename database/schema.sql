-- ============================================================
-- HOSPITAL EMERGENCY SYSTEM — Canonical Database Schema
-- Database: hospital_emergency_system
-- ============================================================

CREATE DATABASE IF NOT EXISTS hospital_emergency_system;
USE hospital_emergency_system;

-- ----------------------------------------------------------------
-- USERS
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    user_id       INT AUTO_INCREMENT PRIMARY KEY,
    username      VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role          ENUM('Admin','Patient','Doctor','HospitalStaff') NOT NULL,
    phone         VARCHAR(15),
    created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ----------------------------------------------------------------
-- LOCATION (Dehradun Predefined Locations)
-- Must be created before HOSPITAL and AMBULANCE
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS location (
    location_id   INT AUTO_INCREMENT PRIMARY KEY,
    location_name VARCHAR(100) NOT NULL UNIQUE,
    is_active     TINYINT(1)   NOT NULL DEFAULT 1
);

-- ----------------------------------------------------------------
-- LOCATION DISTANCE (Configurable Distance Matrix)
-- Stored in normalised order: from_location_id < to_location_id
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS location_distance (
    from_location_id INT NOT NULL,
    to_location_id   INT NOT NULL,
    distance_km      DECIMAL(6,2) NOT NULL,
    PRIMARY KEY (from_location_id, to_location_id),
    FOREIGN KEY (from_location_id) REFERENCES location(location_id) ON DELETE CASCADE,
    FOREIGN KEY (to_location_id)   REFERENCES location(location_id) ON DELETE CASCADE,
    CHECK (from_location_id < to_location_id)
);

-- ----------------------------------------------------------------
-- HOSPITAL
-- location_id references a predefined Dehradun location
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS hospital (
    hospital_id        INT AUTO_INCREMENT PRIMARY KEY,
    hospital_name      VARCHAR(150) NOT NULL,
    location_id        INT NULL,
    total_beds         INT NOT NULL DEFAULT 0,
    available_beds     INT NOT NULL DEFAULT 0,
    emergency_capacity INT NOT NULL DEFAULT 0,
    status             ENUM('Active','Inactive','Full') NOT NULL DEFAULT 'Active',
    FOREIGN KEY (location_id) REFERENCES location(location_id)
        ON UPDATE CASCADE ON DELETE SET NULL
);

-- ----------------------------------------------------------------
-- PATIENT
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS patient (
    patient_id      INT AUTO_INCREMENT PRIMARY KEY,
    user_id         INT NOT NULL UNIQUE,
    name            VARCHAR(100) NOT NULL,
    age             INT,
    gender          ENUM('Male','Female','Other'),
    blood_group     VARCHAR(10),
    contact         VARCHAR(15),
    medical_history TEXT,
    FOREIGN KEY (user_id) REFERENCES users(user_id)
        ON UPDATE CASCADE ON DELETE RESTRICT
);

-- ----------------------------------------------------------------
-- DOCTOR
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS doctor (
    doctor_id    INT AUTO_INCREMENT PRIMARY KEY,
    user_id      INT UNIQUE,
    hospital_id  INT NOT NULL,
    name         VARCHAR(100) NOT NULL,
    availability ENUM('available','not_available') NOT NULL DEFAULT 'available',
    FOREIGN KEY (user_id)     REFERENCES users(user_id)     ON UPDATE CASCADE ON DELETE RESTRICT,
    FOREIGN KEY (hospital_id) REFERENCES hospital(hospital_id) ON UPDATE CASCADE ON DELETE RESTRICT
);

-- ----------------------------------------------------------------
-- AMBULANCE
-- current_location_id references a predefined Dehradun location
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ambulance (
    ambulance_id        INT AUTO_INCREMENT PRIMARY KEY,
    registration_no     VARCHAR(30) NOT NULL UNIQUE,
    type                ENUM('Basic','ALS') NOT NULL,
    driver_name         VARCHAR(100),
    driver_license_no   VARCHAR(50),
    current_location_id INT NULL,
    status              ENUM('available','in_transit') NOT NULL DEFAULT 'available',
    FOREIGN KEY (current_location_id) REFERENCES location(location_id)
        ON UPDATE CASCADE ON DELETE SET NULL
);

-- ----------------------------------------------------------------
-- BED
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bed (
    bed_id      INT AUTO_INCREMENT PRIMARY KEY,
    hospital_id INT NOT NULL,
    bed_number  VARCHAR(30) NOT NULL,
    bed_type    ENUM('General','ICU','Emergency') NOT NULL,
    status      ENUM('available','occupied') NOT NULL DEFAULT 'available',
    UNIQUE KEY uq_hospital_bed (hospital_id, bed_number),
    FOREIGN KEY (hospital_id) REFERENCES hospital(hospital_id)
        ON UPDATE CASCADE ON DELETE RESTRICT
);

-- ----------------------------------------------------------------
-- EMERGENCY
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS emergency (
    emergency_id       INT AUTO_INCREMENT PRIMARY KEY,
    patient_id         INT NOT NULL,
    ambulance_id       INT NULL,
    hospital_id        INT NULL,
    bed_id             INT NULL,
    doctor_id          INT NULL,
    pickup_location_id INT NULL,
    severity           ENUM('Critical','Serious','Moderate','Minor') NOT NULL,
    priority           INT NOT NULL,
    request_time       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    dispatch_time      DATETIME NULL,
    pickup_time        DATETIME NULL,
    admission_time     DATETIME NULL,
    discharge_time     DATETIME NULL,
    status             ENUM('pending','admitted','in_treatment','discharged','cancelled') NOT NULL DEFAULT 'pending',
    FOREIGN KEY (patient_id)         REFERENCES patient(patient_id)     ON UPDATE CASCADE ON DELETE RESTRICT,
    FOREIGN KEY (ambulance_id)       REFERENCES ambulance(ambulance_id) ON UPDATE CASCADE ON DELETE SET NULL,
    FOREIGN KEY (hospital_id)        REFERENCES hospital(hospital_id)   ON UPDATE CASCADE ON DELETE SET NULL,
    FOREIGN KEY (bed_id)             REFERENCES bed(bed_id)             ON UPDATE CASCADE ON DELETE SET NULL,
    FOREIGN KEY (doctor_id)          REFERENCES doctor(doctor_id)       ON UPDATE CASCADE ON DELETE SET NULL,
    FOREIGN KEY (pickup_location_id) REFERENCES location(location_id)   ON UPDATE CASCADE ON DELETE SET NULL,
    CHECK (priority BETWEEN 1 AND 4)
);

-- ----------------------------------------------------------------
-- TREATMENT
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS treatment (
    treatment_id INT AUTO_INCREMENT PRIMARY KEY,
    emergency_id INT NOT NULL,
    doctor_id    INT NOT NULL,
    diagnosis    VARCHAR(255),
    treatment    TEXT,
    start_time   DATETIME,
    end_time     DATETIME,
    status       ENUM('Planned','Ongoing','Completed','Cancelled') NOT NULL DEFAULT 'Planned',
    FOREIGN KEY (emergency_id) REFERENCES emergency(emergency_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    FOREIGN KEY (doctor_id)    REFERENCES doctor(doctor_id)       ON UPDATE CASCADE ON DELETE RESTRICT
);

-- ----------------------------------------------------------------
-- BILL
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bill (
    bill_id        INT AUTO_INCREMENT PRIMARY KEY,
    emergency_id   INT NOT NULL UNIQUE,
    amount         DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    bill_date      DATE NOT NULL,
    payment_status ENUM('Pending','Partially Paid','Paid','Cancelled') NOT NULL DEFAULT 'Pending',
    FOREIGN KEY (emergency_id) REFERENCES emergency(emergency_id) ON UPDATE CASCADE ON DELETE RESTRICT
);

-- ----------------------------------------------------------------
-- PAYMENT
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payment (
    payment_id   INT AUTO_INCREMENT PRIMARY KEY,
    bill_id      INT NOT NULL,
    amount       DECIMAL(10,2) NOT NULL,
    payment_date DATE NOT NULL,
    payment_mode ENUM('Cash','UPI','Card','Net Banking') NOT NULL,
    status       ENUM('Success','Pending','Failed','Refunded') NOT NULL DEFAULT 'Success',
    FOREIGN KEY (bill_id) REFERENCES bill(bill_id) ON UPDATE CASCADE ON DELETE RESTRICT
);

-- ----------------------------------------------------------------
-- SCHEDULING LOG (Member 4 output)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS scheduling_log (
    log_id          INT AUTO_INCREMENT PRIMARY KEY,
    emergency_id    INT NOT NULL,
    algorithm       ENUM('FCFS','Priority','Round Robin') NOT NULL,
    arrival_time    INT NOT NULL COMMENT 'minutes from epoch or relative time unit',
    burst_time      INT NOT NULL COMMENT 'minutes of service time',
    priority_val    INT NOT NULL DEFAULT 1,
    start_time      INT NOT NULL DEFAULT 0,
    completion_time INT NOT NULL DEFAULT 0,
    waiting_time    INT NOT NULL DEFAULT 0,
    turnaround_time INT NOT NULL DEFAULT 0,
    response_time   INT NOT NULL DEFAULT 0,
    quantum         INT NULL COMMENT 'time quantum for Round Robin only',
    run_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (emergency_id) REFERENCES emergency(emergency_id) ON UPDATE CASCADE ON DELETE RESTRICT
);

-- ----------------------------------------------------------------
-- RESOURCE ALLOCATION LOG (Member 5 output)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS resource_allocation_log (
    log_id          INT AUTO_INCREMENT PRIMARY KEY,
    emergency_id    INT NOT NULL,
    resource_type   ENUM('BED','AMBULANCE','DOCTOR') NOT NULL,
    resource_id     INT NOT NULL,
    state           ENUM('Requested','Allocated','Released','Denied','Waiting') NOT NULL,
    decision_reason VARCHAR(255),
    timestamp       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (emergency_id) REFERENCES emergency(emergency_id) ON UPDATE CASCADE ON DELETE RESTRICT
);
