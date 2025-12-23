const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const DataRepository = require('./DataRepository'); 
const db = new sqlite3.Database('./eco_contribution.db');
const repository = new DataRepository(db);

const salt = bcrypt.genSaltSync(10);
const adminPasswordHash = bcrypt.hashSync('adminpass', salt);

function initializeDatabase() {
    db.serialize(() => {
        db.run(`CREATE TABLE IF NOT EXISTS Users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            email TEXT UNIQUE,
            registration_date DATETIME DEFAULT CURRENT_TIMESTAMP,
            is_admin BOOLEAN DEFAULT 0,
            is_blocked BOOLEAN DEFAULT 0
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS Coefficients (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            value REAL NOT NULL,
            unit_description TEXT,
            emission_unit TEXT DEFAULT 'kg CO2e', 
            last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS Actions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            description TEXT,
            category TEXT NOT NULL, 
            unit_of_measure TEXT NOT NULL, 
            coefficient_id INTEGER,
            FOREIGN KEY (coefficient_id) REFERENCES Coefficients(id)
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS Records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            action_id INTEGER,
            quantity REAL NOT NULL,
            record_date DATE DEFAULT (strftime('%Y-%m-%d', 'now')),
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES Users(id),
            FOREIGN KEY (action_id) REFERENCES Actions(id)
        )`);
        

        db.get("SELECT COUNT(*) AS count FROM Coefficients", (err, row) => {
            if (row.count === 0) {
                const coeffStmt = db.prepare("INSERT INTO Coefficients (value, emission_unit) VALUES (?, ?)");
                coeffStmt.run(0.12, 'kg CO2e'); 
                coeffStmt.run(0.20, 'kg CO2e'); 
                coeffStmt.run(0.50, 'kg CO2e'); 
                coeffStmt.finalize(() => {
                    db.all("SELECT id FROM Coefficients ORDER BY id ASC LIMIT 3", (err, rows) => {
                        if (rows && rows.length === 3) {
                            const actionStmt = db.prepare("INSERT INTO Actions (name, description, category, unit_of_measure, coefficient_id) VALUES (?, ?, ?, ?, ?)");
                            actionStmt.run("Сортировка мусора", "Передача отходов на переработку.", "Отходы", "кг", rows[0].id);
                            actionStmt.run("Использование велосипеда", "Использование велосипеда вместо автомобиля.", "Транспорт", "км", rows[1].id);
                            actionStmt.run("Экономия энергии", "Снижение потребления электроэнергии.", "Энергия", "кВт*ч", rows[2].id);
                            actionStmt.finalize();
                            console.log("Initial actions added.");
                        }
                    });
                });
            }
        });

        db.get("SELECT COUNT(*) AS count FROM Users WHERE is_admin = 1", (err, row) => {
            if (row.count === 0) {
                db.run("INSERT INTO Users (username, password_hash, email, is_admin) VALUES (?, ?, ?, ?)",
                    ['admin', adminPasswordHash, 'admin@eco.com', 1],
                    (err) => {
                        if (err) { console.error("Error adding admin:", err.message); }
                        else { console.log("Admin user 'admin' added (password: adminpass)"); }
                    });

                db.run("INSERT INTO Users (username, password_hash, email, is_admin) VALUES (?, ?, ?, ?)",
                    ['testuser', bcrypt.hashSync('testpass', salt), 'test@eco.com', 0],
                    (err) => {
                        if (err) { console.error("Error adding test user:", err.message); }
                        else { console.log("Test user 'testuser' added (password: testpass)"); }
                    });
            }
        });
    });
}

module.exports = { db, initializeDatabase, repository };