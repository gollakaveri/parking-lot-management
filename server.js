
require("dotenv").config();

const express = require("express");
const path = require("path");
const db = require("./db");

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

// Generate next ID for tables without AUTO_INCREMENT
async function nextId(connection, table, column) {
    const allowed = {
        vehicles: "vehicle_id",
        parking_slots: "slot_id",
        parking_records: "record_id"
    };

    if (allowed[table] !== column) {
        throw new Error("Invalid table or column");
    }

    const [rows] = await connection.query(
        `SELECT COALESCE(MAX(${column}), 0) + 1 AS nextId FROM ${table}`
    );

    return rows[0].nextId;
}

// DATABASE CONNECTION
app.get("/api/health", async (req, res) => {
    try {
        const [rows] = await db.query(
            "SELECT DATABASE() AS database_name"
        );

        res.json({
            connected: true,
            database: rows[0].database_name
        });
    } catch (error) {
        res.status(500).json({
            connected: false,
            message: error.message
        });
    }
});

// PERSON LIST
app.get("/api/person", async (req, res) => {
    try {
        const [rows] = await db.query(
            "SELECT * FROM person ORDER BY user_id"
        );
        res.json(rows);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// DASHBOARD
app.get("/api/dashboard", async (req, res) => {
    try {
        const [[slots]] = await db.query(`
            SELECT
                COUNT(*) AS total,
                SUM(status = 'Available') AS available,
                SUM(status = 'Occupied') AS occupied
            FROM parking_slots
        `);

        const [[vehicles]] = await db.query(
            "SELECT COUNT(*) AS total FROM vehicles"
        );

        const [[active]] = await db.query(`
            SELECT COUNT(*) AS total
            FROM parking_records
            WHERE exit_time IS NULL
        `);

        const [[income]] = await db.query(`
            SELECT COALESCE(SUM(parking_fee), 0) AS total
            FROM parking_records
            WHERE status = 'Completed'
        `);

        res.json({
            slots,
            vehicles: vehicles.total,
            active: active.total,
            income: income.total
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// GET VEHICLES
app.get("/api/vehicles", async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT
                v.vehicle_id,
                v.vehicle_number,
                v.vehicle_type,
                v.user_id,
                p.user_name AS owner_name
            FROM vehicles v
            LEFT JOIN person p
            ON p.user_id = CAST(v.user_id AS UNSIGNED)
            ORDER BY v.vehicle_id DESC
        `);

        res.json(rows);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// ADD VEHICLE
app.post("/api/vehicles", async (req, res) => {
    try {
        const {
            vehicle_number,
            vehicle_type,
            user_id
        } = req.body;

        if (!vehicle_number || !vehicle_type || !user_id) {
            return res.status(400).json({
                message: "Vehicle number, type and user ID are required"
            });
        }

        const [person] = await db.query(
            "SELECT user_id FROM person WHERE user_id = ?",
            [user_id]
        );

        if (!person.length) {
            return res.status(400).json({
                message: "Person user ID not found"
            });
        }

        const id = await nextId(db, "vehicles", "vehicle_id");

        await db.query(`
            INSERT INTO vehicles
            (vehicle_id, user_id, vehicle_number, vehicle_type)
            VALUES (?, ?, ?, ?)
        `, [
            id,
            String(user_id),
            vehicle_number.trim().toUpperCase(),
            vehicle_type
        ]);

        res.status(201).json({
            message: "Vehicle added successfully",
            vehicle_id: id
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// UPDATE VEHICLE
app.put("/api/vehicles/:id", async (req, res) => {
    try {
        const {
            vehicle_number,
            vehicle_type,
            user_id
        } = req.body;

        await db.query(`
            UPDATE vehicles
            SET vehicle_number = ?,
                vehicle_type = ?,
                user_id = ?
            WHERE vehicle_id = ?
        `, [
            vehicle_number.trim().toUpperCase(),
            vehicle_type,
            String(user_id),
            req.params.id
        ]);

        res.json({ message: "Vehicle updated successfully" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// DELETE VEHICLE
app.delete("/api/vehicles/:id", async (req, res) => {
    try {
        const [active] = await db.query(`
            SELECT record_id
            FROM parking_records
            WHERE vehicle_id = ? AND exit_time IS NULL
        `, [req.params.id]);

        if (active.length) {
            return res.status(400).json({
                message: "Vehicle is currently parked"
            });
        }

        await db.query(
            "DELETE FROM vehicles WHERE vehicle_id = ?",
            [req.params.id]
        );

        res.json({ message: "Vehicle deleted successfully" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// GET PARKING SLOTS
app.get("/api/slots", async (req, res) => {
    try {
        const [rows] = await db.query(
            "SELECT * FROM parking_slots ORDER BY slot_id"
        );
        res.json(rows);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// ADD PARKING SLOT
app.post("/api/slots", async (req, res) => {
    try {
        const {
            slot_number,
            vehicle_type,
            location
        } = req.body;

        if (!slot_number || !vehicle_type) {
            return res.status(400).json({
                message: "Slot number and vehicle type are required"
            });
        }

        const id = await nextId(db, "parking_slots", "slot_id");

        await db.query(`
            INSERT INTO parking_slots
            (slot_id, slot_number, vehicle_type, location, status)
            VALUES (?, ?, ?, ?, 'Available')
        `, [
            id,
            slot_number.trim().toUpperCase(),
            vehicle_type,
            location || null
        ]);

        res.status(201).json({
            message: "Parking slot added successfully",
            slot_id: id
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// UPDATE PARKING SLOT
app.put("/api/slots/:id", async (req, res) => {
    try {
        const {
            slot_number,
            vehicle_type,
            location,
            status
        } = req.body;

        await db.query(`
            UPDATE parking_slots
            SET slot_number = ?,
                vehicle_type = ?,
                location = ?,
                status = ?
            WHERE slot_id = ?
        `, [
            slot_number,
            vehicle_type,
            location || null,
            status,
            req.params.id
        ]);

        res.json({ message: "Slot updated successfully" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// DELETE PARKING SLOT
app.delete("/api/slots/:id", async (req, res) => {
    try {
        const [records] = await db.query(`
            SELECT record_id
            FROM parking_records
            WHERE slot_id = ?
        `, [req.params.id]);

        if (records.length) {
            return res.status(400).json({
                message: "This slot has parking history and cannot be deleted"
            });
        }

        await db.query(
            "DELETE FROM parking_slots WHERE slot_id = ?",
            [req.params.id]
        );

        res.json({ message: "Slot deleted successfully" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// VEHICLE ENTRY
app.post("/api/entry", async (req, res) => {
    const conn = await db.getConnection();

    try {
        const { vehicle_id, slot_id } = req.body;

        await conn.beginTransaction();

        const [vehicles] = await conn.query(
            "SELECT * FROM vehicles WHERE vehicle_id = ?",
            [vehicle_id]
        );

        if (!vehicles.length) {
            throw new Error("Vehicle not found");
        }

        const [slots] = await conn.query(
            "SELECT * FROM parking_slots WHERE slot_id = ? FOR UPDATE",
            [slot_id]
        );

        if (!slots.length) {
            throw new Error("Parking slot not found");
        }

        if (slots[0].status !== "Available") {
            throw new Error("Parking slot is not available");
        }

        if (
            String(slots[0].vehicle_type).toLowerCase() !==
            String(vehicles[0].vehicle_type).toLowerCase()
        ) {
            throw new Error("Vehicle type does not match parking slot");
        }

        const [active] = await conn.query(`
            SELECT record_id FROM parking_records
            WHERE vehicle_id = ? AND exit_time IS NULL
        `, [vehicle_id]);

        if (active.length) {
            throw new Error("Vehicle is already parked");
        }

        const recordId = await nextId(
            conn, "parking_records", "record_id"
        );

        await conn.query(`
            INSERT INTO parking_records
            (record_id, vehicle_id, slot_id, entry_time,
             exit_time, parking_fee, status)
            VALUES (?, ?, ?, NOW(), NULL, 0, 'Parked')
        `, [recordId, vehicle_id, slot_id]);

        await conn.query(`
            UPDATE parking_slots
            SET status = 'Occupied'
            WHERE slot_id = ?
        `, [slot_id]);

        await conn.commit();

        res.json({
            message: "Vehicle entry successful",
            record_id: recordId
        });
    } catch (error) {
        await conn.rollback();
        res.status(400).json({ message: error.message });
    } finally {
        conn.release();
    }
});

// ACTIVE PARKING
app.get("/api/active", async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT
                r.record_id,
                r.vehicle_id,
                r.slot_id,
                r.entry_time,
                r.status,
                v.vehicle_number,
                v.vehicle_type,
                p.user_name AS owner_name,
                s.slot_number
            FROM parking_records r
            JOIN vehicles v ON r.vehicle_id = v.vehicle_id
            LEFT JOIN person p
                ON p.user_id = CAST(v.user_id AS UNSIGNED)
            JOIN parking_slots s ON r.slot_id = s.slot_id
            WHERE r.exit_time IS NULL
            ORDER BY r.entry_time DESC
        `);

        res.json(rows);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// VEHICLE EXIT
app.post("/api/exit", async (req, res) => {
    const conn = await db.getConnection();

    try {
        const { record_id } = req.body;

        await conn.beginTransaction();

        const [records] = await conn.query(`
            SELECT
                r.*,
                v.vehicle_type
            FROM parking_records r
            JOIN vehicles v ON r.vehicle_id = v.vehicle_id
            WHERE r.record_id = ? AND r.exit_time IS NULL
            FOR UPDATE
        `, [record_id]);

        if (!records.length) {
            throw new Error("Active parking record not found");
        }

        const record = records[0];

        const rate =
            String(record.vehicle_type).toLowerCase() === "car"
                ? 20 : 10;

        const entryTime = new Date(record.entry_time);
        const exitTime = new Date();

        const hours = Math.max(
            1,
            Math.ceil((exitTime - entryTime) / 3600000)
        );

        const fee = hours * rate;

        await conn.query(`
            UPDATE parking_records
            SET exit_time = NOW(),
                parking_fee = ?,
                status = 'Completed'
            WHERE record_id = ?
        `, [fee, record_id]);

        await conn.query(`
            UPDATE parking_slots
            SET status = 'Available'
            WHERE slot_id = ?
        `, [record.slot_id]);

        await conn.commit();

        res.json({
            message: "Vehicle exit successful",
            hours,
            parking_fee: fee
        });
    } catch (error) {
        await conn.rollback();
        res.status(400).json({ message: error.message });
    } finally {
        conn.release();
    }
});

// PARKING HISTORY
app.get("/api/history", async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT
                r.record_id,
                r.vehicle_id,
                r.slot_id,
                r.entry_time,
                r.exit_time,
                r.parking_fee,
                r.status,
                v.vehicle_number,
                v.vehicle_type,
                p.user_name AS owner_name,
                s.slot_number
            FROM parking_records r
            LEFT JOIN vehicles v ON r.vehicle_id = v.vehicle_id
            LEFT JOIN person p
                ON p.user_id = CAST(v.user_id AS UNSIGNED)
            LEFT JOIN parking_slots s ON r.slot_id = s.slot_id
            ORDER BY r.record_id DESC
        `);

        res.json(rows);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// SERVER
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(
        `Kaveri Parking Lot Management System running at http://localhost:${PORT}`
    );
});
