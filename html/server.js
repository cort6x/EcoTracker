const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const { initializeDatabase, repository } = require('./database'); 
const { EcoService, userSessions } = require('./EcoService');

const app = express();
const PORT = 3000;

const ecoService = new EcoService(repository);

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
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; 

    if (token == null) return res.sendStatus(401);

    const sessionData = ecoService.validateToken(token);

    if (!sessionData) return res.sendStatus(401);
    
    if (sessionData.isBlocked === 1) {
        ecoService.removeToken(token); 
        return res.status(403).send({ message: "Ваша учетная запись заблокирована администратором." });
    }

    req.sessionData = sessionData;
    next();
};

const checkAdmin = (req, res, next) => {
    if (req.sessionData.isAdmin !== 1) {
        return res.status(403).send({ message: "Доступ запрещен. Требуются права администратора." });
    }
    next();
};

// --- AUTH ROUTES ---
app.post('/api/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;
        const result = await ecoService.registerUser(username, email, password);
        res.status(201).send(result);
    } catch (error) {
        console.error("Error in /api/register:", error);
        res.status(error.status || 500).send({ message: error.message || 'Ошибка сервера при регистрации.' });
    }
});

app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const result = await ecoService.loginUser(username, password);
        res.send(result);
    } catch (error) {
        console.error("Error in /api/login:", error);
        res.status(error.status || 500).send({ message: error.message || 'Ошибка сервера при входе.' });
    }
});

app.use('/api', authenticateToken);

app.get('/api/user', async (req, res) => {
    try {
        const user = await ecoService.getCurrentUser(req.sessionData.userId);
        res.send(user);
    } catch (error) {
        res.status(error.status || 500).send({ message: error.message || 'Ошибка сервера.' });
    }
});

app.post('/api/record', async (req, res) => {
    try {
        const { action_id, quantity, record_date } = req.body;
        const result = await ecoService.createRecord(req.sessionData.userId, action_id, quantity, record_date);
        res.status(201).send(result);
    } catch (error) {
        res.status(error.status || 500).send({ message: error.message || 'Ошибка при добавлении записи.' });
    }
});

app.get('/api/records', async (req, res) => {
    try {
        const records = await ecoService.getUserRecords(req.sessionData.userId);
        res.send(records);
    } catch (error) {
        res.status(500).send({ message: 'Ошибка при загрузке записей.' });
    }
});

app.get('/api/report', async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        const report = await ecoService.generateReport(req.sessionData.userId, startDate, endDate);
        res.send(report);
    } catch (error) {
        res.status(500).send({ message: 'Ошибка при генерации отчета.' });
    }
});

app.get('/api/actions', async (req, res) => {
    try {
        const actions = await ecoService.getAllActions();
        res.send(actions);
    } catch (error) {
        res.status(500).send({ message: 'Ошибка при загрузке действий.' });
    }
});

app.use('/api/admin', checkAdmin);
app.post('/api/admin/actions', async (req, res) => {
    try {
        const result = await ecoService.addAction(req.body);
        res.status(201).send(result);
    } catch (error) {
        res.status(error.status || 500).send({ message: error.message || 'Ошибка при добавлении действия.' });
    }
});

app.put('/api/admin/actions/:id', async (req, res) => {
    try {
        const { coefficient_id, coefficient_value } = req.body;
        const result = await ecoService.updateCoefficient(req.params.id, coefficient_id, coefficient_value);
        res.send(result);
    } catch (error) {
        res.status(error.status || 500).send({ message: error.message || 'Ошибка при обновлении коэффициента.' });
    }
});

app.get('/api/admin/users/search', async (req, res) => {
    try {
        const users = await ecoService.searchUsers(req.query.query);
        res.send(users);
    } catch (error) {
        res.status(500).send({ message: 'Ошибка при поиске пользователей.' });
    }
});

app.put('/api/admin/users/:id/block', async (req, res) => {
    try {
        const { is_blocked } = req.body;
        const result = await ecoService.toggleBlockUser(req.sessionData.userId, parseInt(req.params.id), is_blocked);
        res.send(result);
    } catch (error) {
        res.status(error.status || 500).send({ message: error.message || 'Ошибка при обновлении статуса пользователя.' });
    }
});
app.put('/api/admin/users/:id/role', async (req, res) => {
    try {
        const { is_admin } = req.body;
        const result = await ecoService.toggleUserRole(req.sessionData.userId, parseInt(req.params.id), is_admin);
        res.send(result);
    } catch (error) {
        res.status(error.status || 500).send({ message: error.message || 'Ошибка при обновлении роли пользователя.' });
    }
});


app.use(express.static(path.join(__dirname, 'public')));
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

initializeDatabase();

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});