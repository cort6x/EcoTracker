const { db } = require('./database');

class DataRepository {
    constructor(db) {
        this.db = db;
    }

    _run(sql, params = []) {
        return new Promise((resolve, reject) => {
        this.db.run(sql, params, function (err) {
            if (err) return reject(err);
            resolve({ id: this.lastID, changes: this.changes });
        });
        });
    }

    _get(sql, params = []) {
        return new Promise((resolve, reject) => {
        this.db.get(sql, params, (err, row) => {
            if (err) return reject(err);
            resolve(row);
        });
        });
    }

    _all(sql, params = []) {
        return new Promise((resolve, reject) => {
        this.db.all(sql, params, (err, rows) => {
            if (err) return reject(err);
            resolve(rows);
        });
        });
    }


    async findUserByUsername(username) {
        return this._get(`SELECT * FROM Users WHERE username = ?`, [username]);
    }

    async findUserById(id) {
        return this._get(`SELECT id, username, email, is_admin, is_blocked, registration_date FROM Users WHERE id = ?`, [id]);
    }

    async createUser(username, passwordHash, email) {
        return this._run(`INSERT INTO Users (username, password_hash, email) VALUES (?, ?, ?)`, 
            [username, passwordHash, email]);
    }

    async updateUserStatus(userId, isBlocked) {
        return this._run(`UPDATE Users SET is_blocked = ? WHERE id = ?`, [isBlocked, userId]);
    }

    async updateUserRole(userId, isAdmin) {
        return this._run(`UPDATE Users SET is_admin = ? WHERE id = ?`, [isAdmin, userId]);
    }

    async searchUsers(query) {
        const sql = `SELECT id, username, email, is_admin, is_blocked FROM Users WHERE username LIKE ? OR email LIKE ?`;
        const search = `%${query}%`;
        return this._all(sql, [search, search]);
    }
    async getAllActions() {
        return this._all(`
            SELECT 
                A.id, A.name, A.description, A.category, A.unit_of_measure, 
                C.id AS coefficient_id, C.value AS coefficient_value, C.emission_unit 
            FROM Actions A
            JOIN Coefficients C ON A.coefficient_id = C.id
            ORDER BY A.name
        `);
    }

    async createAction(name, description, category, unitOfMeasure, coefficientId) {
        return this._run(`INSERT INTO Actions (name, description, category, unit_of_measure, coefficient_id) VALUES (?, ?, ?, ?, ?)`,
            [name, description, category, unitOfMeasure, coefficientId]);
    }
    
    async createCoefficient(value, emissionUnit) {
        return this._run(`INSERT INTO Coefficients (value, emission_unit) VALUES (?, ?)`, [value, emissionUnit]);
    }

    async updateCoefficientValue(coefficientId, value) {
        return this._run(`UPDATE Coefficients SET value = ? WHERE id = ?`, [value, coefficientId]);
    }
    async createRecord(userId, actionId, quantity, recordDate) {
        return this._run(`INSERT INTO Records (user_id, action_id, quantity, record_date) VALUES (?, ?, ?, ?)`,
            [userId, actionId, quantity, recordDate]);
    }

    async getRecordsByUserId(userId) {
        return this._all(`
            SELECT R.*, A.name AS action_name, A.unit_of_measure, C.value AS coefficient_value, C.emission_unit 
            FROM Records R
            JOIN Actions A ON R.action_id = A.id
            JOIN Coefficients C ON A.coefficient_id = C.id
            WHERE R.user_id = ?
            ORDER BY R.record_date DESC
        `, [userId]);
    }

    async getReportData(userId, startDate, endDate) {
        let sql = `
            SELECT 
                A.category, 
                SUM(R.quantity * C.value) AS contribution 
            FROM Records R
            JOIN Actions A ON R.action_id = A.id
            JOIN Coefficients C ON A.coefficient_id = C.id
            WHERE R.user_id = ? 
        `;
        const params = [userId];

        if (startDate) {
            sql += ` AND R.record_date >= ?`;
            params.push(startDate);
        }
        if (endDate) {
            sql += ` AND R.record_date <= ?`;
            params.push(endDate);
        }

        sql += ` GROUP BY A.category ORDER BY contribution DESC`;
        
        return this._all(sql, params);
    }
}

module.exports = DataRepository;