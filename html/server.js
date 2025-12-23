const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const { initializeDatabase, repository } = require('./database'); 
const { EcoService, userSessions } = require('./EcoService');
<<<<<<< HEAD
const { specs, swaggerUi } = require('./swagger');

const app = express();
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));
=======

const app = express();
>>>>>>> 421e573558b9ea4c8c85f141fb2c7eada2638fe2
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
<<<<<<< HEAD

=======
>>>>>>> 421e573558b9ea4c8c85f141fb2c7eada2638fe2
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
<<<<<<< HEAD

/**
 * @swagger
 * /api/register:
 *   post:
 *     summary: Регистрация нового пользователя
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - email
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *                 example: testuser
 *                 description: Уникальное имя пользователя
 *               email:
 *                 type: string
 *                 example: test@example.com
 *                 description: Адрес электронной почты
 *               password:
 *                 type: string
 *                 example: password123
 *                 description: Пароль (минимум 6 символов)
 *     responses:
 *       201:
 *         description: Пользователь успешно зарегистрирован
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Регистрация прошла успешно
 *       400:
 *         description: Ошибка валидации данных
 *       500:
 *         description: Ошибка сервера
 */
=======
>>>>>>> 421e573558b9ea4c8c85f141fb2c7eada2638fe2
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

<<<<<<< HEAD
/**
 * @swagger
 * /api/login:
 *   post:
 *     summary: Вход в систему
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *                 example: testuser
 *               password:
 *                 type: string
 *                 example: password123
 *     responses:
 *       200:
 *         description: Успешный вход, возвращает JWT токен
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *                   example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *                 message:
 *                   type: string
 *                   example: Вход выполнен успешно
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                     username:
 *                       type: string
 *                     isAdmin:
 *                       type: integer
 *                     isBlocked:
 *                       type: integer
 *       401:
 *         description: Неверные учётные данные
 *       500:
 *         description: Ошибка сервера
 */
=======
>>>>>>> 421e573558b9ea4c8c85f141fb2c7eada2638fe2
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

<<<<<<< HEAD
/**
 * @swagger
 * /api/user:
 *   get:
 *     summary: Получить информацию о текущем пользователе
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Данные пользователя
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: integer
 *                 username:
 *                   type: string
 *                 email:
 *                   type: string
 *                 isAdmin:
 *                   type: integer
 *                 isBlocked:
 *                   type: integer
 *       401:
 *         description: Не авторизован
 */
=======
>>>>>>> 421e573558b9ea4c8c85f141fb2c7eada2638fe2
app.get('/api/user', async (req, res) => {
    try {
        const user = await ecoService.getCurrentUser(req.sessionData.userId);
        res.send(user);
    } catch (error) {
        res.status(error.status || 500).send({ message: error.message || 'Ошибка сервера.' });
    }
});

<<<<<<< HEAD
/**
 * @swagger
 * /api/record:
 *   post:
 *     summary: Добавить запись об экологическом действии
 *     tags: [Records]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - action_id
 *               - quantity
 *               - record_date
 *             properties:
 *               action_id:
 *                 type: integer
 *                 example: 1
 *                 description: ID экологического действия
 *               quantity:
 *                 type: number
 *                 example: 10
 *                 description: Количество (должно быть положительным)
 *               record_date:
 *                 type: string
 *                 format: date
 *                 example: 2024-12-21
 *                 description: Дата выполнения действия
 *     responses:
 *       201:
 *         description: Запись успешно добавлена
 *       400:
 *         description: Ошибка валидации
 *       401:
 *         description: Не авторизован
 */
=======
>>>>>>> 421e573558b9ea4c8c85f141fb2c7eada2638fe2
app.post('/api/record', async (req, res) => {
    try {
        const { action_id, quantity, record_date } = req.body;
        const result = await ecoService.createRecord(req.sessionData.userId, action_id, quantity, record_date);
        res.status(201).send(result);
    } catch (error) {
        res.status(error.status || 500).send({ message: error.message || 'Ошибка при добавлении записи.' });
    }
});

<<<<<<< HEAD
/**
 * @swagger
 * /api/records:
 *   get:
 *     summary: Получить все записи текущего пользователя
 *     tags: [Records]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Список записей пользователя
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: integer
 *                   action_name:
 *                     type: string
 *                   quantity:
 *                     type: number
 *                   record_date:
 *                     type: string
 *                   category:
 *                     type: string
 *       401:
 *         description: Не авторизован
 */
=======
>>>>>>> 421e573558b9ea4c8c85f141fb2c7eada2638fe2
app.get('/api/records', async (req, res) => {
    try {
        const records = await ecoService.getUserRecords(req.sessionData.userId);
        res.send(records);
    } catch (error) {
        res.status(500).send({ message: 'Ошибка при загрузке записей.' });
    }
});

<<<<<<< HEAD
/**
 * @swagger
 * /api/report:
 *   get:
 *     summary: Получить отчёт об экологическом вкладе
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Дата начала периода (необязательно)
 *         example: 2024-01-01
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Дата окончания периода (необязательно)
 *         example: 2024-12-31
 *     responses:
 *       200:
 *         description: Данные отчёта
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 total_contribution:
 *                   type: number
 *                   example: 25.5
 *                   description: Общий экологический вклад
 *                 unit:
 *                   type: string
 *                   example: kg CO2e
 *                 details_by_category:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       category:
 *                         type: string
 *                         example: Транспорт
 *                       contribution:
 *                         type: number
 *                         example: 15.5
 *       401:
 *         description: Не авторизован
 */
=======
>>>>>>> 421e573558b9ea4c8c85f141fb2c7eada2638fe2
app.get('/api/report', async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        const report = await ecoService.generateReport(req.sessionData.userId, startDate, endDate);
        res.send(report);
    } catch (error) {
        res.status(500).send({ message: 'Ошибка при генерации отчета.' });
    }
});

<<<<<<< HEAD
/**
 * @swagger
 * /api/actions:
 *   get:
 *     summary: Получить список доступных экологических действий
 *     tags: [Actions]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Список действий
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: integer
 *                   name:
 *                     type: string
 *                     example: Поездка на велосипеде
 *                   description:
 *                     type: string
 *                   category:
 *                     type: string
 *                     example: Транспорт
 *                   unit_of_measure:
 *                     type: string
 *                     example: км
 *                   coefficient_value:
 *                     type: number
 *                     example: 0.21
 *       401:
 *         description: Не авторизован
 */
=======
>>>>>>> 421e573558b9ea4c8c85f141fb2c7eada2638fe2
app.get('/api/actions', async (req, res) => {
    try {
        const actions = await ecoService.getAllActions();
        res.send(actions);
    } catch (error) {
        res.status(500).send({ message: 'Ошибка при загрузке действий.' });
    }
});

app.use('/api/admin', checkAdmin);
<<<<<<< HEAD

/**
 * @swagger
 * /api/admin/actions:
 *   post:
 *     summary: Добавить новое экологическое действие (только для администратора)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - description
 *               - category
 *               - unit_of_measure
 *               - coefficient_value
 *             properties:
 *               name:
 *                 type: string
 *                 example: Использование общественного транспорта
 *               description:
 *                 type: string
 *                 example: Поездка на автобусе или метро
 *               category:
 *                 type: string
 *                 example: Транспорт
 *               unit_of_measure:
 *                 type: string
 *                 example: км
 *               coefficient_value:
 *                 type: number
 *                 example: 0.05
 *     responses:
 *       201:
 *         description: Действие успешно добавлено
 *       401:
 *         description: Не авторизован
 *       403:
 *         description: Доступ запрещен (не администратор)
 */
=======
>>>>>>> 421e573558b9ea4c8c85f141fb2c7eada2638fe2
app.post('/api/admin/actions', async (req, res) => {
    try {
        const result = await ecoService.addAction(req.body);
        res.status(201).send(result);
    } catch (error) {
        res.status(error.status || 500).send({ message: error.message || 'Ошибка при добавлении действия.' });
    }
});

<<<<<<< HEAD
/**
 * @swagger
 * /api/admin/actions/{id}:
 *   put:
 *     summary: Обновить коэффициент действия (только для администратора)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID действия
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - coefficient_id
 *               - coefficient_value
 *             properties:
 *               coefficient_id:
 *                 type: integer
 *                 example: 1
 *               coefficient_value:
 *                 type: number
 *                 example: 0.25
 *     responses:
 *       200:
 *         description: Коэффициент успешно обновлён
 *       401:
 *         description: Не авторизован
 *       403:
 *         description: Доступ запрещен
 */
=======
>>>>>>> 421e573558b9ea4c8c85f141fb2c7eada2638fe2
app.put('/api/admin/actions/:id', async (req, res) => {
    try {
        const { coefficient_id, coefficient_value } = req.body;
        const result = await ecoService.updateCoefficient(req.params.id, coefficient_id, coefficient_value);
        res.send(result);
    } catch (error) {
        res.status(error.status || 500).send({ message: error.message || 'Ошибка при обновлении коэффициента.' });
    }
});

<<<<<<< HEAD
/**
 * @swagger
 * /api/admin/users/search:
 *   get:
 *     summary: Поиск пользователей (только для администратора)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: query
 *         schema:
 *           type: string
 *         description: Поисковый запрос (имя пользователя или email)
 *         example: testuser
 *     responses:
 *       200:
 *         description: Результаты поиска
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: integer
 *                   username:
 *                     type: string
 *                   email:
 *                     type: string
 *                   is_admin:
 *                     type: integer
 *                   is_blocked:
 *                     type: integer
 *       401:
 *         description: Не авторизован
 *       403:
 *         description: Доступ запрещен
 */
=======
>>>>>>> 421e573558b9ea4c8c85f141fb2c7eada2638fe2
app.get('/api/admin/users/search', async (req, res) => {
    try {
        const users = await ecoService.searchUsers(req.query.query);
        res.send(users);
    } catch (error) {
        res.status(500).send({ message: 'Ошибка при поиске пользователей.' });
    }
});

<<<<<<< HEAD
/**
 * @swagger
 * /api/admin/users/{id}/block:
 *   put:
 *     summary: Заблокировать или разблокировать пользователя (только для администратора)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID пользователя
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - is_blocked
 *             properties:
 *               is_blocked:
 *                 type: integer
 *                 example: 1
 *                 description: 1 для блокировки, 0 для разблокировки
 *     responses:
 *       200:
 *         description: Статус пользователя обновлён
 *       401:
 *         description: Не авторизован
 *       403:
 *         description: Доступ запрещен
 */
=======
>>>>>>> 421e573558b9ea4c8c85f141fb2c7eada2638fe2
app.put('/api/admin/users/:id/block', async (req, res) => {
    try {
        const { is_blocked } = req.body;
        const result = await ecoService.toggleBlockUser(req.sessionData.userId, parseInt(req.params.id), is_blocked);
        res.send(result);
    } catch (error) {
        res.status(error.status || 500).send({ message: error.message || 'Ошибка при обновлении статуса пользователя.' });
    }
});
<<<<<<< HEAD

/**
 * @swagger
 * /api/admin/users/{id}/role:
 *   put:
 *     summary: Изменить роль пользователя (только для администратора)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID пользователя
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - is_admin
 *             properties:
 *               is_admin:
 *                 type: integer
 *                 example: 1
 *                 description: 1 для назначения администратором, 0 для снятия прав
 *     responses:
 *       200:
 *         description: Роль пользователя обновлена
 *       401:
 *         description: Не авторизован
 *       403:
 *         description: Доступ запрещен
 */
=======
>>>>>>> 421e573558b9ea4c8c85f141fb2c7eada2638fe2
app.put('/api/admin/users/:id/role', async (req, res) => {
    try {
        const { is_admin } = req.body;
        const result = await ecoService.toggleUserRole(req.sessionData.userId, parseInt(req.params.id), is_admin);
        res.send(result);
    } catch (error) {
        res.status(error.status || 500).send({ message: error.message || 'Ошибка при обновлении роли пользователя.' });
    }
});

<<<<<<< HEAD
=======

>>>>>>> 421e573558b9ea4c8c85f141fb2c7eada2638fe2
app.use(express.static(path.join(__dirname, 'public')));
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

initializeDatabase();

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
<<<<<<< HEAD
    console.log(`Swagger UI доступен по адресу: http://localhost:${PORT}/api-docs`);
});
=======
});
>>>>>>> 421e573558b9ea4c8c85f141fb2c7eada2638fe2
