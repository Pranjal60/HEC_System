-- ============================================================
-- DEMO SEED — Indian / Dehradun context
-- Run: mysql -u root -p emergency_management < seed_demo.sql
-- ============================================================

USE emergency_management;
SET FOREIGN_KEY_CHECKS = 0;

-- ── Wipe existing demo data (preserve admin user id=100) ────
DELETE FROM RESOURCE_ALLOCATION_LOG;
DELETE FROM SCHEDULING_LOG;
DELETE FROM PAYMENT;
DELETE FROM BILL;
DELETE FROM TREATMENT;
DELETE FROM EMERGENCY;
DELETE FROM BED;
DELETE FROM DOCTOR;
DELETE FROM AMBULANCE;
DELETE FROM PATIENT;
DELETE FROM HOSPITAL;
DELETE FROM USER WHERE user_id != 100;

SET FOREIGN_KEY_CHECKS = 1;

-- ── USER — Doctors ────────────────────────────────────────────
-- password for all: password123
INSERT INTO USER (username, password_hash, role, phone) VALUES
  ('dr_rajesh_sharma',   '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Doctor', '9412345601'),
  ('dr_priya_mehra',     '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Doctor', '9412345602'),
  ('dr_anil_kapoor',     '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Doctor', '9412345603'),
  ('dr_sunita_rawat',    '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Doctor', '9412345604'),
  ('dr_vikram_negi',     '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Doctor', '9412345605'),
  ('dr_kavita_bhandari', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Doctor', '9412345606');

-- ── USER — Patients ───────────────────────────────────────────
INSERT INTO USER (username, password_hash, role, phone) VALUES
  ('arjun_thakur',    '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Patient', '9412001001'),
  ('meena_devi',      '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Patient', '9412001002'),
  ('ravi_bisht',      '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Patient', '9412001003'),
  ('pooja_chauhan',   '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Patient', '9412001004'),
  ('suresh_joshi',    '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Patient', '9412001005'),
  ('anita_verma',     '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Patient', '9412001006'),
  ('deepak_rana',     '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Patient', '9412001007'),
  ('kavya_singh',     '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Patient', '9412001008');

-- ── PATIENT — lookup user_ids by username ─────────────────────
INSERT INTO PATIENT (user_id, name, age, gender, blood_group, contact, medical_history)
SELECT u.user_id, p.name, p.age, p.gender, p.bg, p.contact, p.history
FROM (
  SELECT 'arjun_thakur'  AS uname, 'Arjun Thakur'   AS name, 34 AS age, 'M' AS gender, 'B+'  AS bg, '9412001001' AS contact, 'No known allergies'             AS history UNION ALL
  SELECT 'meena_devi',              'Meena Devi',      62, 'F', 'O+',  '9412001002', 'Hypertension, Type-2 Diabetes'  UNION ALL
  SELECT 'ravi_bisht',              'Ravi Bisht',      28, 'M', 'A+',  '9412001003', 'Asthma'                         UNION ALL
  SELECT 'pooja_chauhan',           'Pooja Chauhan',   45, 'F', 'AB+', '9412001004', 'Hypothyroidism'                 UNION ALL
  SELECT 'suresh_joshi',            'Suresh Joshi',    58, 'M', 'O-',  '9412001005', 'Heart disease, previous MI'     UNION ALL
  SELECT 'anita_verma',             'Anita Verma',     22, 'F', 'B-',  '9412001006', 'No known conditions'            UNION ALL
  SELECT 'deepak_rana',             'Deepak Rana',     41, 'M', 'A-',  '9412001007', 'Chronic back pain'              UNION ALL
  SELECT 'kavya_singh',             'Kavya Singh',     19, 'F', 'AB-', '9412001008', 'Epilepsy'
) AS p
JOIN USER u ON u.username = p.uname;

-- ── HOSPITAL ─────────────────────────────────────────────────
-- location_id: 1=Clock Tower, 2=Railway Station, 3=ISBT,
--   4=Ballupur Chowk, 5=FRI, 6=Pacific Mall, 7=Sahastradhara, 8=Graphic Era
INSERT INTO HOSPITAL (hospital_name, location_id, available_beds, emergency_capacity, status) VALUES
  ('Doon Medical College & Hospital', 2, 0, 60, 'active'),
  ('Max Super Speciality Hospital',   4, 0, 40, 'active'),
  ('Shri Mahant Indiresh Hospital',   1, 0, 50, 'active'),
  ('Himalayan Institute Hospital',    5, 0, 35, 'active');

-- ── AMBULANCE ─────────────────────────────────────────────────
INSERT INTO AMBULANCE (hospital_id, vehicle_number, type, driver_name, driver_license, current_location_id, status)
SELECT h.hospital_id, a.vnum, a.atype, a.driver, a.lic, a.loc_id, 'available'
FROM (
  SELECT 'Doon Medical College & Hospital' AS hname, 'UK07PA0101' AS vnum, 'Advanced Life Support' AS atype, 'Ramesh Kumar'  AS driver, 'UK0720210001' AS lic, 1 AS loc_id UNION ALL
  SELECT 'Doon Medical College & Hospital',            'UK07PA0102',         'Basic Life Support',    'Mohan Singh',    'UK0720210002',             3                        UNION ALL
  SELECT 'Max Super Speciality Hospital',              'UK07PA0201',         'Advanced Life Support', 'Dinesh Rawat',   'UK0720210003',             4                        UNION ALL
  SELECT 'Max Super Speciality Hospital',              'UK07PA0202',         'Basic Life Support',    'Sanjay Bisht',   'UK0720210004',             6                        UNION ALL
  SELECT 'Shri Mahant Indiresh Hospital',              'UK07PA0301',         'Advanced Life Support', 'Prakash Negi',   'UK0720210005',             2                        UNION ALL
  SELECT 'Shri Mahant Indiresh Hospital',              'UK07PA0302',         'Basic Life Support',    'Ajay Thakur',    'UK0720210006',             7                        UNION ALL
  SELECT 'Himalayan Institute Hospital',               'UK07PA0401',         'Advanced Life Support', 'Harish Joshi',   'UK0720210007',             5                        UNION ALL
  SELECT 'Himalayan Institute Hospital',               'UK07PA0402',         'Basic Life Support',    'Vikas Chamoli',  'UK0720210008',             8
) AS a
JOIN HOSPITAL h ON h.hospital_name = a.hname;

-- ── DOCTOR ────────────────────────────────────────────────────
INSERT INTO DOCTOR (user_id, hospital_id, name, specialization, availability)
SELECT u.user_id, h.hospital_id, d.name, d.spec, 'available'
FROM (
  SELECT 'dr_rajesh_sharma'   AS uname, 'Doon Medical College & Hospital' AS hname, 'Dr. Rajesh Sharma'   AS name, 'Emergency Medicine' AS spec UNION ALL
  SELECT 'dr_priya_mehra',              'Doon Medical College & Hospital',            'Dr. Priya Mehra',     'Cardiology'                        UNION ALL
  SELECT 'dr_anil_kapoor',              'Max Super Speciality Hospital',              'Dr. Anil Kapoor',     'Trauma Surgery'                    UNION ALL
  SELECT 'dr_sunita_rawat',             'Max Super Speciality Hospital',              'Dr. Sunita Rawat',    'Internal Medicine'                 UNION ALL
  SELECT 'dr_vikram_negi',              'Shri Mahant Indiresh Hospital',              'Dr. Vikram Negi',     'Neurology'                         UNION ALL
  SELECT 'dr_kavita_bhandari',          'Himalayan Institute Hospital',               'Dr. Kavita Bhandari', 'Orthopaedics'
) AS d
JOIN USER    u ON u.username    = d.uname
JOIN HOSPITAL h ON h.hospital_name = d.hname;

-- ── BED ───────────────────────────────────────────────────────
INSERT INTO BED (hospital_id, bed_number, bed_type, status)
SELECT h.hospital_id, b.bnum, b.btype, 'available'
FROM (
  SELECT 'Doon Medical College & Hospital' AS hname, 'ICU-101' AS bnum, 'ICU'       AS btype UNION ALL
  SELECT 'Doon Medical College & Hospital',            'ICU-102',         'ICU'                UNION ALL
  SELECT 'Doon Medical College & Hospital',            'ICU-103',         'ICU'                UNION ALL
  SELECT 'Doon Medical College & Hospital',            'EMG-101',         'Emergency'          UNION ALL
  SELECT 'Doon Medical College & Hospital',            'EMG-102',         'Emergency'          UNION ALL
  SELECT 'Doon Medical College & Hospital',            'GEN-101',         'General'            UNION ALL
  SELECT 'Doon Medical College & Hospital',            'GEN-102',         'General'            UNION ALL
  SELECT 'Doon Medical College & Hospital',            'GEN-103',         'General'            UNION ALL
  SELECT 'Max Super Speciality Hospital',              'ICU-201',         'ICU'                UNION ALL
  SELECT 'Max Super Speciality Hospital',              'ICU-202',         'ICU'                UNION ALL
  SELECT 'Max Super Speciality Hospital',              'EMG-201',         'Emergency'          UNION ALL
  SELECT 'Max Super Speciality Hospital',              'GEN-201',         'General'            UNION ALL
  SELECT 'Max Super Speciality Hospital',              'GEN-202',         'General'            UNION ALL
  SELECT 'Max Super Speciality Hospital',              'GEN-203',         'General'            UNION ALL
  SELECT 'Shri Mahant Indiresh Hospital',              'ICU-301',         'ICU'                UNION ALL
  SELECT 'Shri Mahant Indiresh Hospital',              'EMG-301',         'Emergency'          UNION ALL
  SELECT 'Shri Mahant Indiresh Hospital',              'GEN-301',         'General'            UNION ALL
  SELECT 'Shri Mahant Indiresh Hospital',              'GEN-302',         'General'            UNION ALL
  SELECT 'Himalayan Institute Hospital',               'ICU-401',         'ICU'                UNION ALL
  SELECT 'Himalayan Institute Hospital',               'EMG-401',         'Emergency'          UNION ALL
  SELECT 'Himalayan Institute Hospital',               'GEN-401',         'General'            UNION ALL
  SELECT 'Himalayan Institute Hospital',               'GEN-402',         'General'
) AS b
JOIN HOSPITAL h ON h.hospital_name = b.hname;

-- ── EMERGENCY ─────────────────────────────────────────────────
INSERT INTO EMERGENCY
  (patient_id, ambulance_id, hospital_id, bed_id, doctor_id,
   pickup_location_id, severity, priority,
   request_time, dispatch_time, pickup_time, admission_time, discharge_time, status)
SELECT
  (SELECT patient_id FROM PATIENT WHERE name='Suresh Joshi'),
  (SELECT ambulance_id FROM AMBULANCE WHERE vehicle_number='UK07PA0101'),
  (SELECT hospital_id FROM HOSPITAL WHERE hospital_name='Doon Medical College & Hospital'),
  (SELECT bed_id FROM BED b JOIN HOSPITAL h ON b.hospital_id=h.hospital_id WHERE h.hospital_name='Doon Medical College & Hospital' AND b.bed_number='ICU-102'),
  (SELECT doctor_id FROM DOCTOR WHERE name='Dr. Rajesh Sharma'),
  5,'critical',1,'2026-10-14 08:10:00','2026-10-14 08:13:00','2026-10-14 08:28:00','2026-10-14 08:45:00',NULL,'admitted'
UNION ALL
SELECT
  (SELECT patient_id FROM PATIENT WHERE name='Meena Devi'),
  (SELECT ambulance_id FROM AMBULANCE WHERE vehicle_number='UK07PA0102'),
  (SELECT hospital_id FROM HOSPITAL WHERE hospital_name='Doon Medical College & Hospital'),
  (SELECT bed_id FROM BED b JOIN HOSPITAL h ON b.hospital_id=h.hospital_id WHERE h.hospital_name='Doon Medical College & Hospital' AND b.bed_number='EMG-102'),
  (SELECT doctor_id FROM DOCTOR WHERE name='Dr. Priya Mehra'),
  3,'serious',2,'2026-10-14 09:30:00','2026-10-14 09:33:00','2026-10-14 09:50:00','2026-10-14 10:05:00',NULL,'in_treatment'
UNION ALL
SELECT
  (SELECT patient_id FROM PATIENT WHERE name='Deepak Rana'),
  (SELECT ambulance_id FROM AMBULANCE WHERE vehicle_number='UK07PA0201'),
  (SELECT hospital_id FROM HOSPITAL WHERE hospital_name='Max Super Speciality Hospital'),
  NULL,NULL,
  7,'moderate',3,'2026-10-15 07:45:00','2026-10-15 07:48:00',NULL,NULL,NULL,'pending'
UNION ALL
SELECT
  (SELECT patient_id FROM PATIENT WHERE name='Kavya Singh'),
  (SELECT ambulance_id FROM AMBULANCE WHERE vehicle_number='UK07PA0402'),
  (SELECT hospital_id FROM HOSPITAL WHERE hospital_name='Max Super Speciality Hospital'),
  NULL,NULL,
  8,'minor',4,'2026-10-15 08:00:00','2026-10-15 08:03:00',NULL,NULL,NULL,'pending'
UNION ALL
SELECT
  (SELECT patient_id FROM PATIENT WHERE name='Ravi Bisht'),
  (SELECT ambulance_id FROM AMBULANCE WHERE vehicle_number='UK07PA0301'),
  (SELECT hospital_id FROM HOSPITAL WHERE hospital_name='Shri Mahant Indiresh Hospital'),
  NULL,
  (SELECT doctor_id FROM DOCTOR WHERE name='Dr. Vikram Negi'),
  2,'critical',1,'2026-10-13 14:00:00','2026-10-13 14:04:00','2026-10-13 14:18:00','2026-10-13 14:35:00','2026-10-15 06:00:00','discharged'
UNION ALL
SELECT
  (SELECT patient_id FROM PATIENT WHERE name='Pooja Chauhan'),
  (SELECT ambulance_id FROM AMBULANCE WHERE vehicle_number='UK07PA0302'),
  (SELECT hospital_id FROM HOSPITAL WHERE hospital_name='Shri Mahant Indiresh Hospital'),
  (SELECT bed_id FROM BED b JOIN HOSPITAL h ON b.hospital_id=h.hospital_id WHERE h.hospital_name='Shri Mahant Indiresh Hospital' AND b.bed_number='GEN-301'),
  (SELECT doctor_id FROM DOCTOR WHERE name='Dr. Vikram Negi'),
  6,'serious',2,'2026-10-15 06:30:00','2026-10-15 06:34:00','2026-10-15 06:52:00','2026-10-15 07:10:00',NULL,'admitted'
UNION ALL
SELECT
  (SELECT patient_id FROM PATIENT WHERE name='Arjun Thakur'),
  (SELECT ambulance_id FROM AMBULANCE WHERE vehicle_number='UK07PA0401'),
  (SELECT hospital_id FROM HOSPITAL WHERE hospital_name='Himalayan Institute Hospital'),
  (SELECT bed_id FROM BED b JOIN HOSPITAL h ON b.hospital_id=h.hospital_id WHERE h.hospital_name='Himalayan Institute Hospital' AND b.bed_number='ICU-401'),
  (SELECT doctor_id FROM DOCTOR WHERE name='Dr. Kavita Bhandari'),
  1,'moderate',3,'2026-10-14 15:20:00','2026-10-14 15:23:00','2026-10-14 15:40:00','2026-10-14 16:00:00',NULL,'in_treatment'
UNION ALL
SELECT
  (SELECT patient_id FROM PATIENT WHERE name='Anita Verma'),
  NULL,
  (SELECT hospital_id FROM HOSPITAL WHERE hospital_name='Doon Medical College & Hospital'),
  NULL,NULL,
  4,'minor',4,'2026-10-15 05:00:00',NULL,NULL,NULL,NULL,'cancelled';

-- ── Mark occupied beds ────────────────────────────────────────
UPDATE BED b JOIN HOSPITAL h ON b.hospital_id=h.hospital_id
SET b.status='occupied'
WHERE (h.hospital_name='Doon Medical College & Hospital' AND b.bed_number='ICU-102')
   OR (h.hospital_name='Doon Medical College & Hospital' AND b.bed_number='EMG-102')
   OR (h.hospital_name='Shri Mahant Indiresh Hospital'   AND b.bed_number='GEN-301')
   OR (h.hospital_name='Himalayan Institute Hospital'    AND b.bed_number='ICU-401');

-- ── Mark busy doctors ─────────────────────────────────────────
UPDATE DOCTOR SET availability='busy'
WHERE name IN ('Dr. Rajesh Sharma','Dr. Priya Mehra','Dr. Vikram Negi','Dr. Kavita Bhandari');

-- ── Mark ambulances in transit ────────────────────────────────
UPDATE AMBULANCE SET status='in_transit'
WHERE vehicle_number IN ('UK07PA0101','UK07PA0201','UK07PA0301','UK07PA0302','UK07PA0401','UK07PA0402');

UPDATE AMBULANCE SET dispatched_to=(SELECT emergency_id FROM EMERGENCY WHERE patient_id=(SELECT patient_id FROM PATIENT WHERE name='Suresh Joshi') AND status='admitted')    WHERE vehicle_number='UK07PA0101';
UPDATE AMBULANCE SET dispatched_to=(SELECT emergency_id FROM EMERGENCY WHERE patient_id=(SELECT patient_id FROM PATIENT WHERE name='Deepak Rana'))   WHERE vehicle_number='UK07PA0201';
UPDATE AMBULANCE SET dispatched_to=(SELECT emergency_id FROM EMERGENCY WHERE patient_id=(SELECT patient_id FROM PATIENT WHERE name='Ravi Bisht'))    WHERE vehicle_number='UK07PA0301';
UPDATE AMBULANCE SET dispatched_to=(SELECT emergency_id FROM EMERGENCY WHERE patient_id=(SELECT patient_id FROM PATIENT WHERE name='Pooja Chauhan')) WHERE vehicle_number='UK07PA0302';
UPDATE AMBULANCE SET dispatched_to=(SELECT emergency_id FROM EMERGENCY WHERE patient_id=(SELECT patient_id FROM PATIENT WHERE name='Arjun Thakur')) WHERE vehicle_number='UK07PA0401';
UPDATE AMBULANCE SET dispatched_to=(SELECT emergency_id FROM EMERGENCY WHERE patient_id=(SELECT patient_id FROM PATIENT WHERE name='Kavya Singh'))   WHERE vehicle_number='UK07PA0402';

-- ── TREATMENT ─────────────────────────────────────────────────
INSERT INTO TREATMENT (emergency_id, doctor_id, diagnosis, treatment, start_time, end_time, status)
SELECT
  (SELECT emergency_id FROM EMERGENCY WHERE patient_id=(SELECT patient_id FROM PATIENT WHERE name='Suresh Joshi') AND status='admitted'),
  (SELECT doctor_id FROM DOCTOR WHERE name='Dr. Rajesh Sharma'),
  'Acute Myocardial Infarction',
  'Thrombolysis administered, ECG monitoring, aspirin 300mg, transferred to CCU',
  '2026-10-14 08:50:00', NULL, 'ongoing'
UNION ALL
SELECT
  (SELECT emergency_id FROM EMERGENCY WHERE patient_id=(SELECT patient_id FROM PATIENT WHERE name='Meena Devi')),
  (SELECT doctor_id FROM DOCTOR WHERE name='Dr. Priya Mehra'),
  'Hypoglycaemic Episode with Fall',
  'IV dextrose 25%, wound dressing on right knee, glucose monitoring every 2 hours',
  '2026-10-14 10:10:00', NULL, 'ongoing'
UNION ALL
SELECT
  (SELECT emergency_id FROM EMERGENCY WHERE patient_id=(SELECT patient_id FROM PATIENT WHERE name='Ravi Bisht')),
  (SELECT doctor_id FROM DOCTOR WHERE name='Dr. Vikram Negi'),
  'Polytrauma — Road Traffic Accident',
  'Stabilisation, CT head and chest, ORIF right femur, discharged with follow-up',
  '2026-10-13 14:40:00', '2026-10-15 06:00:00', 'completed'
UNION ALL
SELECT
  (SELECT emergency_id FROM EMERGENCY WHERE patient_id=(SELECT patient_id FROM PATIENT WHERE name='Pooja Chauhan')),
  (SELECT doctor_id FROM DOCTOR WHERE name='Dr. Vikram Negi'),
  'Thyroid Storm',
  'Beta-blocker IV, PTU loading dose, cooling measures, ICU observation',
  '2026-10-15 07:15:00', NULL, 'ongoing'
UNION ALL
SELECT
  (SELECT emergency_id FROM EMERGENCY WHERE patient_id=(SELECT patient_id FROM PATIENT WHERE name='Arjun Thakur')),
  (SELECT doctor_id FROM DOCTOR WHERE name='Dr. Kavita Bhandari'),
  'Closed Fracture — Right Radius',
  'X-ray confirmed, POP cast applied, analgesics, ortho follow-up in 1 week',
  '2026-10-14 16:05:00', NULL, 'ongoing';

-- ── BILL ──────────────────────────────────────────────────────
INSERT INTO BILL (emergency_id, patient_id, amount, bill_date, payment_status)
SELECT e.emergency_id, e.patient_id, b.amount, b.bdate, b.pstatus
FROM (
  SELECT 'Suresh Joshi'  AS pname, 42500.00 AS amount, '2026-10-14' AS bdate, 'pending'  AS pstatus UNION ALL
  SELECT 'Meena Devi',              18750.00,            '2026-10-14',           'pending'            UNION ALL
  SELECT 'Ravi Bisht',              67000.00,            '2026-10-13',           'paid'               UNION ALL
  SELECT 'Pooja Chauhan',           35000.00,            '2026-10-15',           'pending'            UNION ALL
  SELECT 'Arjun Thakur',            12500.00,            '2026-10-14',           'pending'
) AS b
JOIN PATIENT pt ON pt.name = b.pname
JOIN EMERGENCY e ON e.patient_id = pt.patient_id AND e.status != 'cancelled';

-- ── PAYMENT — for the discharged/paid case ────────────────────
INSERT INTO PAYMENT (bill_id, amount, payment_date, payment_mode)
SELECT bill_id, 67000.00, '2026-10-15', 'UPI'
FROM BILL WHERE payment_status='paid' LIMIT 1;

-- ── Sync available_beds ───────────────────────────────────────
UPDATE HOSPITAL h SET available_beds = (
  SELECT COUNT(*) FROM BED WHERE hospital_id = h.hospital_id AND status = 'available'
);

-- ── Final check ───────────────────────────────────────────────
SELECT 'patients'   AS tbl, COUNT(*) AS cnt FROM PATIENT   UNION ALL
SELECT 'hospitals',                  COUNT(*)               FROM HOSPITAL  UNION ALL
SELECT 'ambulances',                 COUNT(*)               FROM AMBULANCE UNION ALL
SELECT 'doctors',                    COUNT(*)               FROM DOCTOR    UNION ALL
SELECT 'beds',                       COUNT(*)               FROM BED       UNION ALL
SELECT 'emergencies',                COUNT(*)               FROM EMERGENCY UNION ALL
SELECT 'treatments',                 COUNT(*)               FROM TREATMENT UNION ALL
SELECT 'bills',                      COUNT(*)               FROM BILL      UNION ALL
SELECT 'payments',                   COUNT(*)               FROM PAYMENT;
