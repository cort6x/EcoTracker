const express = require('express');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const path = require('path');
const { db, initializeDatabase } = require('./database'); 
const app = express();
const PORT = 3000;

app.use(bodyParser.json());
app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});
const userSessions = new Map(); 

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; 

    if (token == null) return res.sendStatus(401);

    const sessionData = userSessions.get(token);

    if (!sessionData) return res.sendStatus(401);
    if (sessionData.isBlocked === 1) {
        userSessions.delete(token); 
        return res.status(403).send({ message: "Ваша учетная запись заблокирована администратором." });
    }

    req.userId = sessionData.userId;
    next();
};

const adminMiddleware = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    const sessionData = userSessions.get(token);

    if (!sessionData || sessionData.isAdmin !== 1) {
        return res.status(403).send({ message: "Доступ запрещен. Требуются права администратора." });
    }
    req.sessionData = sessionData;
    next();
};

app.post('/api/register', async (req, res) => {
    const { username, email, password } = req.body;
    if (!username || !password || !email) {
        return res.status(400).send({ message: "Требуются имя пользователя, email и пароль." });
    }

    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);
    db.run(`INSERT INTO Users (username, email, password_hash, is_admin, is_blocked) VALUES (?, ?, ?, 0, 0)`,
        [username, email, password_hash],
        function(err) {
            if (err) {
                if (err.message.includes('UNIQUE constraint failed')) {
                    return res.status(409).send({ message: "Пользователь с таким именем или email уже существует." });
                }
                console.error(err.message);
                return res.status(500).send({ message: "Ошибка сервера при регистрации." });
            }
            res.status(201).send({ message: "Регистрация прошла успешно!" });
        }
    );
});

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).send({ message: "Требуется имя пользователя и пароль." });
    }

    db.get(`SELECT id, username, password_hash, is_admin, is_blocked FROM Users WHERE username = ?`, [username], async (err, user) => {
        if (err || !user) {
            return res.status(401).send({ message: "Неверное имя пользователя или пароль." });
        }

        const isMatch = await bcrypt.compare(password, user.password_hash);

        if (!isMatch) {
            return res.status(401).send({ message: "Неверное имя пользователя или пароль." });
        }
        if (user.is_blocked === 1) {
            return res.status(403).send({ message: "Ваша учетная запись заблокирована администратором." });
        }

        const token = require('crypto').randomBytes(64).toString('hex');
        userSessions.set(token, { 
            userId: user.id, 
            username: user.username, 
            isAdmin: user.is_admin,
            isBlocked: user.is_blocked 
        });

        res.send({
            message: "Авторизация прошла успешно!",
            token: token,
            user: { id: user.id, username: user.username, isAdmin: user.is_admin, isBlocked: user.is_blocked } 
        });
    });
});

app.get('/api/user', authenticateToken, (req, res) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader.split(' ')[1];
    const sessionData = userSessions.get(token); 
    if (!sessionData) {
        return res.sendStatus(401);
    }
    res.send({ 
        userId: sessionData.userId, 
        username: sessionData.username, 
        isAdmin: sessionData.isAdmin, 
        isBlocked: sessionData.isBlocked 
    });
});

app.get('/api/actions', (req, res) => {
    const sql = `
        SELECT 
            a.id, a.name, a.description, a.category, a.unit_of_measure, 
            c.value AS coefficient_value, c.emission_unit, c.id AS coefficient_id
        FROM Actions a
        JOIN Coefficients c ON a.coefficient_id = c.id
    `;
    db.all(sql, [], (err, rows) => {
        if (err) {
            console.error("SQL Error in /api/actions:", err.message);
            return res.status(500).send({ message: "Ошибка при получении списка действий." });
        }
        res.send(rows);
    });
});

app.post('/api/record', authenticateToken, (req, res) => {
    const { action_id, quantity, record_date } = req.body;
    const user_id = req.userId;

    if (!action_id || quantity <= 0 || !record_date) {
        return res.status(400).send({ message: "Некорректные данные для записи." });
    }

    db.run(`INSERT INTO Records (user_id, action_id, quantity, record_date) VALUES (?, ?, ?, ?)`,
        [user_id, action_id, quantity, record_date],
        function(err) {
            if (err) {
                console.error("SQL Error in /api/record:", err.message);
                return res.status(500).send({ message: "Ошибка при сохранении записи." });
            }
            res.send({ message: "Запись успешно сохранена!", recordId: this.lastID });
        }
    );
});

app.get('/api/report', authenticateToken, (req, res) => {
    const user_id = req.userId;
    const { startDate, endDate } = req.query;

    let dateFilter = '';
    const params = [user_id];

    if (startDate && endDate) {
        dateFilter = 'AND r.record_date BETWEEN ? AND ?';
        params.push(startDate, endDate);
    }
    
    const sql = `
        SELECT 
            a.category,
            SUM(r.quantity * c.value) AS total_contribution,
            c.emission_unit
        FROM Records r
        JOIN Actions a ON r.action_id = a.id
        JOIN Coefficients c ON a.coefficient_id = c.id
        WHERE r.user_id = ? ${dateFilter}
        GROUP BY a.category, c.emission_unit
    `;

    db.all(sql, params, (err, rows) => {
        if (err) {
            console.error("--- КРИТИЧЕСКАЯ SQL ОШИБКА В /api/report ---");
            console.error(err.message);
            console.error("Запрос:", sql, "Параметры:", params);
            return res.status(500).send({ message: "Ошибка при генерации отчета. Проверьте консоль сервера!" });
        }

        const totalContribution = rows.reduce((sum, row) => sum + row.total_contribution, 0);

        const report = {
            total_contribution: parseFloat(totalContribution.toFixed(2)),
            unit: rows.length > 0 ? rows[0].emission_unit : 'kg CO2e',
            details_by_category: rows.map(row => ({
                category: row.category,
                contribution: parseFloat(row.total_contribution.toFixed(2))
            }))
        };

        res.send(report);
    });
});

app.get('/api/records', authenticateToken, (req, res) => {
    const user_id = req.userId;
    
    const sql = `
        SELECT 
            r.id, r.quantity, r.record_date, 
            a.name AS action_name, a.unit_of_measure, a.category,
            c.value AS coefficient_value, c.emission_unit
        FROM Records r
        JOIN Actions a ON r.action_id = a.id
        JOIN Coefficients c ON a.coefficient_id = c.id
        WHERE r.user_id = ?
        ORDER BY r.record_date DESC, r.id DESC 
    `;

    db.all(sql, [user_id], (err, rows) => {
        if (err) {
            console.error("SQL Error in /api/records:", err.message);
            return res.status(500).send({ message: "Ошибка при получении списка записей." });
        }
        
        const recordsWithContribution = rows.map(record => ({
            ...record,
            contribution: parseFloat((record.quantity * record.coefficient_value).toFixed(2))
        }));

        res.send(recordsWithContribution);
    });
});


app.put('/api/actions/:id', authenticateToken, adminMiddleware, (req, res) => {
    const actionId = req.params.id;
    const { coefficient_value, coefficient_id } = req.body;
    if (typeof coefficient_value !== 'number' || isNaN(coefficient_value) || coefficient_value <= 0 || !coefficient_id) {
        return res.status(400).send({ 
            message: 'Неверное значение коэффициента или отсутствует ID коэффициента. Убедитесь, что coefficient_value - это число > 0, и coefficient_id присутствует.' 
        });
    }

    db.run(`UPDATE Coefficients SET value = ?, last_updated = CURRENT_TIMESTAMP WHERE id = ?`, 
        [coefficient_value, coefficient_id], 
        function(err) {
            if (err) {
                console.error("SQL Error in PUT /api/actions/:id:", err.message);
                return res.status(500).send({ message: 'Ошибка сервера при обновлении коэффициента.' });
            }
            if (this.changes === 0) {
                return res.status(404).send({ message: 'Коэффициент не найден или не был обновлен.' });
            }

            res.send({ message: `Коэффициент для действия #${actionId} (ID коэффициента: ${coefficient_id}) успешно обновлен до ${coefficient_value}.` });
        }
    );
});

app.post('/api/actions', authenticateToken, adminMiddleware, (req, res) => {
    const { name, description, category, unit_of_measure, coefficient_value, emission_unit } = req.body;
    
    if (!name || !category || !unit_of_measure || typeof coefficient_value !== 'number' || coefficient_value <= 0) {
        return res.status(400).send({ message: 'Отсутствуют обязательные поля: название, категория, единица измерения, значение коэффициента.' });
    }

    db.run(`INSERT INTO Coefficients (value, emission_unit) VALUES (?, ?)`, 
        [coefficient_value, emission_unit || 'kg CO2e'], 
        function(err) {
            if (err) {
                console.error("SQL Error in POST /api/actions (Coefficients):", err.message);
                return res.status(500).send({ message: 'Ошибка сервера при добавлении коэффициента.' });
            }
            const coefficientId = this.lastID;

            db.run(`INSERT INTO Actions (name, description, category, unit_of_measure, coefficient_id) VALUES (?, ?, ?, ?, ?)`,
                [name, description || '', category, unit_of_measure, coefficientId],
                function(err) {
                    if (err) {
                        console.error("SQL Error in POST /api/actions (Actions):", err.message);
                        return res.status(500).send({ message: 'Ошибка сервера при добавлении действия.' });
                    }
                    res.status(201).send({ message: `Действие "${name}" успешно добавлено.`, actionId: this.lastID });
                }
            );
        }
    );
});
app.get('/api/users/search', authenticateToken, adminMiddleware, (req, res) => {
    const query = req.query.query;

    if (!query || query.length < 2) {
        return res.status(400).send({ message: "Слишком короткий поисковый запрос (минимум 2 символа)." });
    }

    const searchPattern = `%${query}%`;
    const sql = `
        SELECT id, username, email, is_admin, is_blocked
        FROM Users 
        WHERE username LIKE ? OR email LIKE ?
    `;

    db.all(sql, [searchPattern, searchPattern], (err, users) => {
        if (err) {
            console.error("SQL Error in GET /api/users/search:", err.message);
            return res.status(500).send({ message: 'Ошибка сервера при поиске пользователей.' });
        }
        res.send(users);
    });
});
app.put('/api/admin/users/:id/block', authenticateToken, adminMiddleware, (req, res) => {
    const userIdToBlock = parseInt(req.params.id, 10);
    const { is_blocked } = req.body; 

    if (userIdToBlock === req.sessionData.userId) {
        return res.status(403).send({ message: "Администратор не может заблокировать сам себя." });
    }
    const newBlockStatus = is_blocked === 1 ? 1 : 0; 

    db.run(`UPDATE Users SET is_blocked = ? WHERE id = ?`, 
        [newBlockStatus, userIdToBlock], 
        function(err) {
            if (err) {
                console.error("SQL Error in PUT /api/admin/users/:id/block:", err.message);
                return res.status(500).send({ message: 'Ошибка сервера при обновлении статуса пользователя.' });
            }
            if (this.changes === 0) {
                return res.status(404).send({ message: 'Пользователь не найден или статус не изменился.' });
            }

            const statusMessage = newBlockStatus === 1 ? 'заблокирован' : 'разблокирован';
            
            if (newBlockStatus === 1) {
                userSessions.forEach((session, token) => {
                    if (session.userId === userIdToBlock) {
                        userSessions.delete(token);
                    }
                });
            }

            res.send({ message: `Пользователь ID ${userIdToBlock} успешно ${statusMessage}.` });
        }
    );
});
app.put('/api/admin/users/:id/role', authenticateToken, adminMiddleware, (req, res) => {
    const userIdToChange = parseInt(req.params.id, 10);
    const { is_admin } = req.body;

    if (userIdToChange === req.sessionData.userId) {
        return res.status(403).send({ message: "Администратор не может изменить собственную роль через API." });
    }
    const newAdminStatus = is_admin === 1 ? 1 : 0; 
    db.run(`UPDATE Users SET is_admin = ? WHERE id = ?`, 
        [newAdminStatus, userIdToChange], 
        function(err) {
            if (err) {
                console.error("SQL Error in PUT /api/admin/users/:id/role:", err.message);
                return res.status(500).send({ message: 'Ошибка сервера при обновлении роли пользователя.' });
            }
            if (this.changes === 0) {
                return res.status(404).send({ message: 'Пользователь не найден или роль не изменилась.' });
            }
            const roleMessage = newAdminStatus === 1 ? 'назначена администратором' : 'назначена обычным пользователем';
            userSessions.forEach((session, token) => {
                if (session.userId === userIdToChange) {
                    userSessions.delete(token);
                }
            });
            res.send({ message: `Пользователю ID ${userIdToChange} успешно ${roleMessage}.` });
        }
    );
});
app.use(express.static(path.join(__dirname, 'public')));
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
    console.log(`Open http://localhost:${PORT}/ in your browser.`);
});