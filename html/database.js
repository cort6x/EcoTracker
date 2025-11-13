const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./eco_contribution.db');
const bcrypt = require('bcryptjs');

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
            is_admin BOOLEAN DEFAULT 0
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS Coefficients (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            value REAL NOT NULL,
            unit_description TEXT,
            emission_unit TEXT DEFAULT 'kg CO2e', -- Например, kg эквивалента CO2
            last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS Actions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            description TEXT,
            category TEXT NOT NULL, -- Категория: 'Отходы', 'Транспорт', 'Энергия'
            unit_of_measure TEXT NOT NULL, -- Единицы: 'кг', 'км', 'кВт*ч'
            coefficient_id INTEGER,
            FOREIGN KEY (coefficient_id) REFERENCES Coefficients(id)
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS Records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            action_id INTEGER NOT NULL,
            quantity REAL NOT NULL, -- Количество совершенных единиц
            record_date DATE NOT NULL,
            FOREIGN KEY (user_id) REFERENCES Users(id),
            FOREIGN KEY (action_id) REFERENCES Actions(id)
        )`);
        db.get("SELECT COUNT(*) AS count FROM Coefficients", (err, row) => {
            if (row.count === 0) {
                const stmt = db.prepare("INSERT INTO Coefficients (value, unit_description) VALUES (?, ?)");
                stmt.run(2.5, "Сокращение выбросов CO2 на 2.5 кг за каждый 1 кг переработанного пластика.");
                stmt.run(0.2, "Сокращение выбросов CO2 на 0.2 кг за каждый 1 км, пройденный пешком/велосипедом.");
                stmt.run(0.7, "Сокращение выбросов CO2 на 0.7 кг за каждый 1 кВт*ч сэкономленной энергии.");
                stmt.finalize();
                console.log("Initial coefficients added.");
                db.all("SELECT id FROM Coefficients", (err, rows) => {
                    if (rows.length >= 3) {
                        const actionStmt = db.prepare("INSERT INTO Actions (name, description, category, unit_of_measure, coefficient_id) VALUES (?, ?, ?, ?, ?)");
                        actionStmt.run("Переработка пластика", "Отправка пластика на переработку.", "Отходы", "кг", rows[0].id);
                        actionStmt.run("Поездка на велосипеде", "Использование велосипеда вместо автомобиля.", "Транспорт", "км", rows[1].id);
                        actionStmt.run("Экономия энергии", "Снижение потребления электроэнергии.", "Энергия", "кВт*ч", rows[2].id);
                        actionStmt.finalize();
                        console.log("Initial actions added.");
                    }
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
module.exports = {
    db,
    initializeDatabase
};
