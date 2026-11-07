# Kaveri – Parking Lot Management System

A multi-page Parking Lot Management System built using HTML, CSS, JavaScript, Node.js, Express and MySQL.

## Pages
- Dashboard
- Vehicles (Add, List, Update, Delete)
- Parking Slots (Add, List, Update, Delete)
- Vehicle Entry
- Vehicle Exit (automatic fee calculation)
- Parking History

## Existing database (important)
This project connects to your existing MySQL schema named `users`. It does **not** create, drop, rename or recreate your database or tables.

The code expects these existing tables and columns:

- `person(user_id, user_name, phonenumber, email, role)`
- `parking_slots(slot_id, slot_number, vehicle_type, status)`
- `vehicles(vehicle_id, vehicle_number, owner_name, vehicle_type, user_id)`
- `parking_records(record_id, vehicle_id, slot_id, entry_time, exit_time, parking_fee, status)`

The app does not expect `parking_records.user_id`.

## Setup in Windows / VS Code

1. Install Node.js and make sure MySQL Server is running.
2. Open this project folder in VS Code.
3. In the project root, copy `.env.example` and rename the copy to `.env`.
4. Open `.env` and enter your own MySQL Workbench connection details:

```env
PORT=3000
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_actual_mysql_password
DB_NAME=users
```

Do not share your password or upload `.env` to GitHub.

5. Open VS Code Terminal in the project folder and run:

```bash
npm install
npm start
```

6. Open `http://localhost:3000`.

Do not open the HTML files directly with Chrome/Edge for database operations. Start the Node server first, then open the localhost address.

## Test database connection

Open this URL after starting the server:

`http://localhost:3000/api/health`

Expected success response includes:

```json
{
  "connected": true,
  "database": "users"
}
```

The Dashboard also displays the MySQL connection status.

## Check tables in MySQL Workbench

Run:

```sql
USE users;
SHOW TABLES;
DESCRIBE person;
DESCRIBE parking_slots;
DESCRIBE vehicles;
DESCRIBE parking_records;
```

Compare the actual columns and spelling with the list above. If any column name or type is different, update the application queries to match your existing schema; do not alter your existing database without a backup.

## Parking fee rule
- Car: ₹20 per hour
- Bike: ₹10 per hour
- Partial hours are rounded up; minimum charge is one hour.

## Notes
- Vehicle entry and exit use database transactions.
- SQL values are passed as parameters.
- `parking_records.exit_time` must allow NULL for an active parking record.
- Slot status values used by this app are `Available` and `Occupied`.
- Parking record status values used by this app are `Parked` and `Completed`.
