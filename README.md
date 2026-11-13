# Hospital Emergency System — Integrated Project

One full-stack application integrating modules from all four team members.

## Team Members & Modules

| Member | Module | Technology |
|--------|--------|-----------|
| Member 2 | Ambulance management, dispatch, distance ranking | Node.js / MySQL |
| Member 3 | Hospital, bed, doctor management | Node.js / MySQL |
| Member 4 | Emergency scheduling (FCFS, Priority, Round Robin) | C |
| Member 5 | Resource management (Banker's Algorithm, starvation, sync) | C++ |

---

## Project Structure

```
integrated/
├── backend/               Node.js + Express API server
│   ├── server.js          Entry point (port 5000)
│   ├── db.js              Shared MySQL pool
│   ├── middleware/        auth.js, errorHandler.js
│   ├── routes/            One file per resource domain
│   └── .env.example       Environment variable template
├── c_modules/             C and C++ programs
│   ├── member4_simple.c   Member 4 scheduling (unchanged)
│   ├── resource_server.cpp Member 5 JSON wrapper
│   ├── src/               Member 5 source files (unchanged)
│   ├── include/           Member 5 headers (unchanged)
│   └── Makefile           Builds both binaries
├── database/
│   ├── schema.sql         Canonical schema (single DB)
│   └── seed.sql           Demo data
└── frontend/
    ├── index.html         Single-page app
    └── js/app.js          Plain JS (no framework)
```

---

## Prerequisites

- Node.js 18+
- MySQL 8.0+
- GCC (for Member 4)
- G++ with C++14 support (for Member 5)

---

## Installation & Setup

### 1. Database

```bash
# Open MySQL and run both files in order:
mysql -u root -p < database/schema.sql
mysql -u root -p < database/seed.sql
```

### 2. Environment

```bash
cd backend
cp .env.example .env
# Edit .env and set your MySQL password
nano .env
```

Contents of `.env`:
```
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=hospital_emergency_system
DB_PORT=3306
PORT=5000
JWT_SECRET=any_random_secret_here
JWT_EXPIRES_IN=8h
```

### 3. Backend dependencies

```bash
cd backend
npm install
```

### 4. Build C and C++ programs

```bash
cd c_modules
make
```

Expected output:
```
✅ Scheduler built:         ./member4_simple
✅ Resource manager built:  ./resource_server
```

### 5. Start the server

```bash
cd backend
node server.js
```

Open: http://localhost:5000

Default login: **admin / password123**

---

## Running the C Programs Standalone

### Member 4 — Scheduling
```bash
./c_modules/member4_simple
# Follow the interactive prompts to enter emergencies and run all three algorithms.
```

### Member 5 — Resource Manager (JSON interface)
```bash
echo '{"state":{"ambulances":[{"ambulance_id":1,"type":"Basic","status":"Available","current_location":""}],"beds":[],"doctors":[],"emergencies":[{"emergency_id":1,"hospital_id":-1,"priority":1,"status":"Requested"}]},"command":{"action":"processRequest","emergency_id":1,"resource_type":"AMBULANCE","resource_id":1,"hospital_id":-1}}' | ./c_modules/resource_server
```

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/auth/login | Login, returns JWT |
| POST | /api/auth/register | Register user |
| GET | /api/auth/me | Current user |
| GET | /api/patients | List patients |
| GET | /api/ambulances | List ambulances |
| POST | /api/ambulances | Add ambulance |
| PUT | /api/ambulances/:id/status | Update status |
| POST | /api/ambulances/find-suitable | Distance-ranked ambulances |
| GET | /api/hospitals | List hospitals |
| GET | /api/hospitals/filter/suitable | Nearest available hospitals |
| GET | /api/beds | List beds (filterable) |
| PUT | /api/beds/:id/allocate | Mark bed Occupied |
| PUT | /api/beds/:id/release | Mark bed Available |
| GET | /api/doctors | List doctors (filterable) |
| PUT | /api/doctors/:id/assign | Mark doctor Busy |
| PUT | /api/doctors/:id/release | Mark doctor Available |
| GET | /api/emergencies | List emergencies |
| POST | /api/emergencies | Create emergency |
| PUT | /api/emergencies/:id | Update emergency (assign, status) |
| GET | /api/emergencies/dashboard/stats | Dashboard counts + recent list |
| POST | /api/scheduling/run | Run C scheduling program |
| GET | /api/scheduling/logs | Past scheduling results |
| GET | /api/scheduling/status | Check if binary exists |
| POST | /api/resources/request | Banker's algorithm request |
| POST | /api/resources/release | Release resource |
| POST | /api/resources/cancel | Cancel emergency resources |
| GET | /api/resources/logs | Allocation log |
| GET | /api/resources/status | Check if binary exists |
| GET | /api/treatments | List treatments |
| POST | /api/treatments | Add treatment |
| PUT | /api/treatments/:id | Update treatment |
| GET | /api/billing/bills | List bills |
| POST | /api/billing/bills | Create bill |
| GET | /api/billing/payments | List payments |
| POST | /api/billing/payments | Record payment (auto-updates bill status) |

All authenticated routes require: `Authorization: Bearer <token>`

---

## Database Summary

Tables and key relationships:

```
users ──< patient
users ──< doctor
hospital ──< doctor
hospital ──< bed
hospital ──< emergency
patient ──< emergency
ambulance ──< emergency
bed ──< emergency
doctor ──< emergency
emergency ──< treatment
doctor ──< treatment
emergency ──< bill
bill ──< payment
emergency ──< scheduling_log
emergency ──< resource_allocation_log
```

**Schema changes from individual modules:**
- `hospital_emergency` → `hospital_emergency_system` (canonical DB name)
- `hospitals`/`beds`/`doctors` → `hospital`/`bed`/`doctor` (singular)
- `hospital.hospital_name` → `hospital.name`
- `doctor.doctor_name` → `doctor.name`; `doctor.status` → `doctor.availability`
- `ambulance.status` ENUM: `Available/Dispatched/On Trip/Maintenance` (replaces `AVAILABLE/BUSY/MAINTENANCE`)
- Added `latitude`, `longitude` to `ambulance` and `hospital` (from Member 2/3)
- Added `city`, `total_beds` to `hospital` (from Member 3)
- Added `doctor_id` FK to `emergency` (for direct doctor assignment)
- Added `pickup_latitude`, `pickup_longitude` to `emergency` (for distance calc)
- `scheduling_log`: integer time fields instead of DATETIME (matches C program output)
- Added `decision_reason`, `Waiting` state to `resource_allocation_log` (from Member 5)

---

## Important Changes Per Member

### Member 2 (Ambulance)
- Table renamed from `AMBULANCE` (uppercase) to `ambulance`
- Status values lowercased: `AVAILABLE→Available`, `BUSY→Dispatched`, `MAINTENANCE→Maintenance`
- Removed separate `EMERGENCY_REQUEST` table (merged into canonical `emergency`)
- Haversine distance ranking preserved exactly
- Transaction-based assignment logic preserved exactly

### Member 3 (Hospital/Bed/Doctor)
- Tables renamed from plural to singular
- `hospital_name` → `name`, `doctor_name` → `name`, `doctor.status` → `doctor.availability`
- Hospital status `AVAILABLE` → `Active`
- Bed/doctor status `AVAILABLE` → `Available`, `OCCUPIED` → `Occupied`, `BUSY` → `Busy`
- Distance-based hospital selection (`/api/hospitals/filter/suitable`) preserved
- Transaction-based bed allocation/release preserved

### Member 4 (C Scheduler)
- Source code **unchanged**
- New non-interactive stdin protocol (piped input)
- Node.js `schedulingRoutes.js` prepares structured input, captures stdout
- Field mapping: `severity → burst_time` (Critical=10, High=20, Medium=30, Low=40 min)
- Results persisted to `scheduling_log`

### Member 5 (C++ Resource Manager)
- Source code **unchanged**
- New `resource_server.cpp` JSON wrapper for stdin/stdout communication
- Node.js `resourceRoutes.js` loads DB state and calls the binary per request
- Status normalisation: `Available→AVAILABLE`, `Dispatched→BUSY`, `Occupied→OCCUPIED`, etc.
- Results logged to `resource_allocation_log`

---

## Known Limitations

1. **Member 5 per-request process:** The C++ binary starts fresh per HTTP request (no persistent daemon). State is seeded from DB each time. Suitable for demonstration; a production system would use a long-lived process.
2. **Member 4 burst time:** Service time is approximated from severity. A real system would track actual treatment duration.
3. **GPS tracking:** Coordinates are statically entered, not live GPS.
4. **No HTTPS:** For local demonstration only.
5. **Single-user concurrent scheduling:** Running scheduling twice simultaneously could produce duplicates in the log; use a queue for production.
