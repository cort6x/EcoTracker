const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const userSessions = new Map(); 

class EcoService {
    constructor(repository) {
        this.repository = repository;
    }

    generateToken(userId, isAdmin, isBlocked) {
        const token = crypto.randomBytes(32).toString('hex');
        userSessions.set(token, { userId, isAdmin, isBlocked, timestamp: Date.now() });
        return token;
    }

    validateToken(token) {
        return userSessions.get(token);
    }

    removeToken(token) {
        userSessions.delete(token);
    }

    async registerUser(username, email, password) {
        if (!username || !email || !password) {
            throw { status: 400, message: "Все поля должны быть заполнены." };
        }
        
        const existingUser = await this.repository.findUserByUsername(username);
        if (existingUser) {
            throw { status: 409, message: "Пользователь с таким именем уже существует." };
        }
        
        const passwordHash = bcrypt.hashSync(password, 10);
        await this.repository.createUser(username, passwordHash, email);
        return { message: "Регистрация успешна! Теперь Вы можете войти." };
    }

    async loginUser(username, password) {
        if (!username || !password) {
            throw { status: 400, message: "Имя пользователя и пароль обязательны." };
        }

        const user = await this.repository.findUserByUsername(username);
        
        if (!user || !bcrypt.compareSync(password, user.password_hash)) {
            throw { status: 401, message: "Неверное имя пользователя или пароль." };
        }

        if (user.is_blocked === 1) {
            throw { status: 403, message: "Ваш аккаунт заблокирован администратором." };
        }

        const token = this.generateToken(user.id, user.is_admin, user.is_blocked);
        return { token, message: "Вход успешен!" };
    }

    async getCurrentUser(userId) {
        const user = await this.repository.findUserById(userId);
        if (!user) {
            throw { status: 404, message: "Пользователь не найден." };
        }
        return {
            userId: user.id,
            username: user.username,
            email: user.email,
            isAdmin: user.is_admin,
            isBlocked: user.is_blocked
        };
    }
    async createRecord(userId, actionId, quantity, recordDate) {
        if (!actionId || quantity <= 0 || !recordDate) {
            throw { status: 400, message: "Некорректные данные для записи." };
        }
        await this.repository.createRecord(userId, actionId, quantity, recordDate);
        return { message: "Запись успешно добавлена!" };
    }

    async getUserRecords(userId) {
        return this.repository.getRecordsByUserId(userId);
    }

    async generateReport(userId, startDate, endDate) {
        const rawData = await this.repository.getReportData(userId, startDate, endDate);
        
        const totalContribution = rawData.reduce((sum, item) => sum + item.contribution, 0);
        const emissionUnit = rawData.length > 0 ? 'kg CO2e' : 'kg CO2e';

        return {
            total_contribution: totalContribution,
            unit: emissionUnit,
            details_by_category: rawData
        };
    }

    async getAllActions() {
        return this.repository.getAllActions();
    }


    async addAction(actionData) {
        const { name, description, category, unit_of_measure, coefficient_value, emission_unit } = actionData;
        
        if (!name || !coefficient_value) {
            throw { status: 400, message: "Необходимо указать название и коэффициент." };
        }

        const coeffResult = await this.repository.createCoefficient(coefficient_value, emission_unit || 'kg CO2e');
        
        await this.repository.createAction(name, description, category, unit_of_measure, coeffResult.id);

        return { message: "Действие успешно добавлено." };
    }

    async updateCoefficient(actionId, coefficientId, coefficientValue) {
        if (!coefficientId || !coefficientValue || isNaN(coefficientValue)) {
            throw { status: 400, message: "Некорректные данные коэффициента." };
        }
        const result = await this.repository.updateCoefficientValue(coefficientId, coefficientValue);
        if (result.changes === 0) {
            throw { status: 404, message: "Коэффициент не найден или значение не изменилось." };
        }
        return { message: "Коэффициент успешно обновлен." };
    }

    async searchUsers(query) {
        return this.repository.searchUsers(query);
    }

    async toggleBlockUser(adminId, userIdToChange, isBlocked) {
        if (adminId === userIdToChange) {
            throw { status: 403, message: "Администратор не может заблокировать себя через API." };
        }
        const result = await this.repository.updateUserStatus(userIdToChange, isBlocked);
        if (result.changes === 0) {
            throw { status: 404, message: "Пользователь не найден или статус не изменился." };
        }
        
        const statusMessage = isBlocked === 1 ? 'заблокирован' : 'разблокирован';
        
        userSessions.forEach((session, token) => {
            if (session.userId === userIdToChange) {
                userSessions.delete(token);
            }
        });
        
        return { message: `Пользователь ID ${userIdToChange} успешно ${statusMessage}.` };
    }

    async toggleUserRole(adminId, userIdToChange, isAdmin) {
        if (adminId === userIdToChange) {
            throw { status: 403, message: "Администратор не может изменить собственную роль через API." };
        }
        
        const result = await this.repository.updateUserRole(userIdToChange, isAdmin);
        if (result.changes === 0) {
            throw { status: 404, message: 'Пользователь не найден или роль не изменилась.' };
        }

        const roleMessage = isAdmin === 1 ? 'назначена администратором' : 'назначена обычным пользователем';
        
        userSessions.forEach((session, token) => {
            if (session.userId === userIdToChange) {
                userSessions.delete(token);
            }
        });

        return { message: `Пользователю ID ${userIdToChange} успешно ${roleMessage}.` };
    }
}

module.exports = { EcoService, userSessions };