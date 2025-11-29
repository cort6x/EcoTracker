const API_URL = 'http://localhost:3000/api';

// фасад
class EcoApiFacade {
    constructor(baseUrl) {
        this.baseUrl = baseUrl;
    }

    get token() {
        return localStorage.getItem('authToken');
    }

    set token(value) {
        if (value) localStorage.setItem('authToken', value);
        else localStorage.removeItem('authToken');
    }

    async _request(endpoint, method = 'GET', body = null) {
        const headers = { 'Content-Type': 'application/json' };
        if (this.token) headers['Authorization'] = `Bearer ${this.token}`;

        const config = { method, headers };
        if (body) config.body = JSON.stringify(body);

        try {
            const response = await fetch(`${this.baseUrl}${endpoint}`, config);
            if (response.status === 204) return { ok: true, status: 204, data: null };
            
            const data = await response.json().catch(() => ({})); 
            return { ok: response.ok, status: response.status, data };
        } catch (error) {
            console.error('API Error:', error);
            return { ok: false, status: 0, data: { message: 'Ошибка сети или сервера.' } };
        }
    }

    async login(username, password) {
        return this._request('/login', 'POST', { username, password });
    }
    async register(username, email, password) {
        return this._request('/register', 'POST', { username, email, password });
    }
    async getUser() {
        return this._request('/user');
    }

    async getActions() {
        return this._request('/actions');
    }
    async createRecord(actionId, quantity, date) {
        return this._request('/record', 'POST', { action_id: actionId, quantity, record_date: date });
    }
    async getRecords() {
        return this._request('/records');
    }
    async getReport(startDate, endDate) {
        const params = new URLSearchParams();
        if (startDate) params.append('startDate', startDate);
        if (endDate) params.append('endDate', endDate);
        const query = params.toString() ? `?${params.toString()}` : '';
        return this._request(`/report${query}`);
    }

    async addAction(actionData) {
        return this._request('/actions', 'POST', actionData);
    }
    async updateCoefficient(actionId, coefficientId, value) {
        return this._request(`/actions/${actionId}`, 'PUT', { 
            coefficient_value: value, 
            coefficient_id: coefficientId 
        });
    }
    async searchUsers(query) {
        return this._request(`/users/search?query=${encodeURIComponent(query)}`);
    }
    async toggleBlockUser(userId, currentStatus) {
       
        const newStatus = currentStatus === 1 ? 0 : 1; 
        return this._request(`/admin/users/${userId}/block`, 'PUT', { is_blocked: newStatus });
    }
    async toggleUserRole(userId, currentIsAdmin) {
        const newStatus = currentIsAdmin === 1 ? 0 : 1;
        return this._request(`/admin/users/${userId}/role`, 'PUT', { is_admin: newStatus });
    }
}

// состояние

class AppState {
    constructor(context) {
        this.context = context;
        this.elements = context.elements;
    }

    enter() {
        this.resetUI();
        this.activate();
    }

    resetUI() {
        this.elements.authView.classList.add('hidden');
        this.elements.dashboardView.classList.add('hidden');
        this.elements.userInfo.classList.add('hidden');
    }

    activate() { /* Переопределяется */ }
}

class LoginState extends AppState {
    activate() {
        this.elements.authView.classList.remove('hidden');
        this.elements.authTitle.textContent = 'Вход в систему';
        this.elements.loginForm.classList.remove('hidden');
        this.elements.registerForm.classList.add('hidden');
        this.elements.toggleAuthViewButton.textContent = 'Нет аккаунта? Зарегистрируйтесь!';
    }
}

class RegisterState extends AppState {
    activate() {
        this.elements.authView.classList.remove('hidden');
        this.elements.authTitle.textContent = 'Регистрация';
        this.elements.loginForm.classList.add('hidden');
        this.elements.registerForm.classList.remove('hidden');
        this.elements.toggleAuthViewButton.textContent = 'Уже есть аккаунт? Войдите!';
    }
}

class DashboardState extends AppState {
    activate() {
        this.elements.dashboardView.classList.remove('hidden');
        this.elements.userInfo.classList.remove('hidden');
        
        const user = this.context.currentUser;
        if (user) {
            const welcomeText = user.isAdmin === 1 
                ? `Добро пожаловать, Администратор ${user.username}!` 
                : `Добро пожаловать, ${user.username}!`;
            document.getElementById('welcome-message').textContent = welcomeText;

            if (user.isAdmin === 1) {
                this.elements.adminTab.classList.remove('hidden');
            } else {
                this.elements.adminTab.classList.add('hidden');
            }
        }

        this.context.loadActions();
        this.context.loadRecordsAndReport();
        this.context.switchTab('record');
    }
}

class AppContext {
    constructor() {
        this.api = new EcoApiFacade(API_URL);
        this.currentUser = null;
        this.chartInstance = null;
        this.actionsList = [];
        this.currentTab = 'record';

        this.elements = {
            app: document.getElementById('app'),
            authView: document.getElementById('auth-view'),
            dashboardView: document.getElementById('dashboard-view'),
            authTitle: document.getElementById('auth-title'),
            loginForm: document.getElementById('login-form'),
            registerForm: document.getElementById('register-form'),
            toggleAuthViewButton: document.getElementById('toggle-auth-view'),
            userInfo: document.getElementById('user-info'),
            logoutButton: document.getElementById('logout-button'),
            messageBox: document.getElementById('message-box'),

            tabRecord: document.getElementById('tab-record'),
            tabReport: document.getElementById('tab-report'),
            tabMethodology: document.getElementById('tab-methodology'),
            adminPanel: document.getElementById('admin-panel'),
            adminTab: document.getElementById('admin-tab'),
         
            recordForm: document.getElementById('record-form'),
            actionsSelect: document.getElementById('action-id'),
            quantityUnit: document.getElementById('quantity-unit'),
            actionDescription: document.getElementById('action-description'),
            recordsList: document.getElementById('records-list'),
            reportStartDate: document.getElementById('report-start-date'),
            reportEndDate: document.getElementById('report-end-date'),
            applyReportFilterButton: document.getElementById('apply-report-filter'),
       
            adminActionsList: document.getElementById('admin-actions-list'),
            adminAddActionForm: document.getElementById('admin-add-action-form'),
            userSearchResults: document.getElementById('admin-user-search-results'),
            adminUserSearchForm: document.getElementById('admin-user-search-form'),
            editModal: document.getElementById('edit-modal'),
            editCoefficientForm: document.getElementById('admin-edit-coefficient-form'),
            modalCloseBtn: document.getElementById('modal-close')
        };

        this.states = {
            login: new LoginState(this),
            register: new RegisterState(this),
            dashboard: new DashboardState(this)
        };
        this.currentState = null;

        this.init();
    }

    init() {
        this.bindEvents();
        document.getElementById('record-date').valueAsDate = new Date();
        this.checkAuthStatus();
    }

    changeState(stateName) {
        if (this.states[stateName]) {
            this.currentState = this.states[stateName];
            this.currentState.enter();
        }
    }

    async checkAuthStatus() {
        if (!this.api.token) {
            this.changeState('login');
            return;
        }

        const res = await this.api.getUser();
        if (res.ok) {
            if (res.data.isBlocked === 1) {
                this.logout('Ваш аккаунт заблокирован.');
            } else {
                this.currentUser = res.data;
                this.changeState('dashboard');
            }
        } else {
            this.logout(res.status === 403 ? 'Доступ запрещен.' : null);
        }
    }

    logout(message = null) {
        this.api.token = null;
        this.currentUser = null;
        this.elements.adminTab.classList.add('hidden');
        this.elements.tabMethodology.classList.add('hidden');
        this.elements.adminPanel.classList.add('hidden');
        
        if (this.chartInstance) {
            this.chartInstance.destroy();
            this.chartInstance = null;
        }
        
        this.changeState('login');
        if (message) this.showMessage(message, 'error');
    }

    showMessage(message, type = 'success') {
        const box = this.elements.messageBox;
        box.textContent = message;
        box.className = `fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg text-white font-medium transition-opacity duration-400 ${type === 'success' ? 'bg-green-500' : 'bg-red-500'}`;
        setTimeout(() => box.classList.add('alert-hidden'), 5000);
    }

    switchTab(tabName) {
        this.currentTab = tabName;
        ['tabRecord', 'tabReport', 'tabMethodology', 'adminPanel'].forEach(k => {
            if(this.elements[k]) this.elements[k].classList.add('hidden');
        });
        
        document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));

        const contentId = tabName === 'admin' ? 'admin-panel' : `tab-${tabName}`;
        const content = document.getElementById(contentId);
        if (content) content.classList.remove('hidden');

        const btn = document.querySelector(`.tab-button[data-tab="${tabName}"]`);
        if (btn) btn.classList.add('active');

        if (tabName === 'admin') {
            this.loadActions(true); 
        }
    }

    async loadActions(isAdminView = false) {
        const res = await this.api.getActions();
        if (res.ok) {
            this.actionsList = res.data;
            this.populateActionsSelect(res.data);
            if (isAdminView) this.renderAdminActionsList(res.data);
        } else {
            this.showMessage('Ошибка загрузки действий', 'error');
        }
    }

    populateActionsSelect(actions) {
        const select = this.elements.actionsSelect;
        select.innerHTML = '<option value="">Выберите действие...</option>';
        actions.forEach(action => {
            const option = document.createElement('option');
            option.value = action.id;
            option.textContent = `${action.name} (${action.category})`;
            option.dataset.unit = action.unit_of_measure;
            option.dataset.description = action.description;
            select.appendChild(option);
        });
    }

    async loadRecordsAndReport() {
        const startDate = this.elements.reportStartDate.value;
        const endDate = this.elements.reportEndDate.value;

        try {
            const [reportRes, recordsRes] = await Promise.all([
                this.api.getReport(startDate, endDate),
                this.api.getRecords()
            ]);

            if (reportRes.ok) this.renderReport(reportRes.data);
            if (recordsRes.ok) this.renderRecordsList(recordsRes.data);
        } catch (e) {
            console.error(e);
            this.showMessage('Ошибка загрузки данных', 'error');
        }
    }

    renderRecordsList(records) {
        const list = this.elements.recordsList;
        list.innerHTML = '';
        if (!records.length) {
            list.innerHTML = '<p class="text-gray-500 italic">Нет записей.</p>';
            return;
        }
        records.forEach(r => {
            const div = document.createElement('div');
            div.className = 'p-3 bg-gray-50 rounded-lg shadow-sm border-l-4 border-green-400 flex justify-between items-center';
            div.innerHTML = `
                <div>
                    <p class="font-semibold text-gray-800">${r.action_name}</p>
                    <p class="text-sm text-gray-600">${r.quantity} ${r.unit_of_measure} | ${r.record_date}</p>
                </div>
                <div class="text-right">
                    <p class="text-lg font-bold text-green-700">-${r.contribution.toFixed(2)}</p>
                    <p class="text-xs text-green-600">${r.emission_unit}</p>
                </div>
            `;
            list.appendChild(div);
        });
    }

    renderReport(report) {
        const totalEl = document.getElementById('total-contribution');
        const unitEl = document.getElementById('contribution-unit');
        const chartCanvas = document.getElementById('contribution-chart');
        const noDataMsg = document.getElementById('no-data-msg');
        const treeEl = document.getElementById('tree-equivalent');

        if (report.total_contribution > 0) {
            totalEl.textContent = report.total_contribution.toFixed(2);
            unitEl.textContent = report.unit;
            if(treeEl) treeEl.textContent = Math.floor(report.total_contribution / 22).toString(); // Пример расчета
            
            chartCanvas.classList.remove('hidden');
            noDataMsg.classList.add('hidden');

            if (this.chartInstance) this.chartInstance.destroy();
            
            this.chartInstance = new Chart(chartCanvas, {
                type: 'doughnut',
                data: {
                    labels: report.details_by_category.map(d => d.category),
                    datasets: [{
                        data: report.details_by_category.map(d => d.contribution),
                        backgroundColor: ['#34d399', '#fcd34d', '#fb7185', '#60a5fa', '#a78bfa']
                    }]
                },
                options: { responsive: true, plugins: { legend: { position: 'right' } } }
            });
        } else {
            totalEl.textContent = '0.00';
            unitEl.textContent = 'kg CO2e';
            if(treeEl) treeEl.textContent = '0';
            if (this.chartInstance) this.chartInstance.destroy();
            chartCanvas.classList.add('hidden');
            noDataMsg.classList.remove('hidden');
        }
    }

    renderAdminActionsList(actions) {
        const list = this.elements.adminActionsList;
        list.innerHTML = '';
        if (!actions.length) {
            list.innerHTML = '<p class="text-gray-500 italic">Нет действий.</p>';
            return;
        }
        actions.forEach(action => {
            const div = document.createElement('div');
            div.className = 'p-3 bg-white rounded-lg shadow-sm border border-gray-100 flex justify-between items-center';
            div.innerHTML = `
                <div class="flex-1 min-w-0">
                    <p class="font-semibold text-gray-800 truncate">${action.name} <span class="text-xs text-gray-500">(${action.category})</span></p>
                    <p class="text-sm text-gray-600">Коэф: <span class="font-medium text-yellow-700">${action.coefficient_value}</span> ${action.emission_unit} / ${action.unit_of_measure}</p>
                </div>
                <button 
                    data-action-id="${action.id}"
                    data-action-name="${action.name}"
                    data-coefficient-id="${action.coefficient_id}"
                    data-coefficient-value="${action.coefficient_value}"
                    class="admin-edit-action px-3 py-1 bg-yellow-500 text-white text-sm rounded-lg hover:bg-yellow-600 transition ml-4"
                >Изменить</button>
            `;
            list.appendChild(div);
        });
    }

    renderUserSearchResults(users) {
        const list = this.elements.userSearchResults;
        if (!users.length) {
            list.innerHTML = '<p class="text-gray-500 italic">Пользователи не найдены.</p>';
            return;
        }
        list.innerHTML = users.map(u => {
            const isSelf = u.id === this.currentUser.userId;
            const blockTxt = u.is_blocked ? 'Разблокировать' : 'Заблокировать';
            const blockCls = u.is_blocked ? 'bg-yellow-500 hover:bg-yellow-600' : 'bg-red-500 hover:bg-red-600';
            const roleTxt = u.is_admin ? 'Сделать User' : 'Сделать Admin';
            const roleCls = u.is_admin ? 'bg-blue-500 hover:bg-blue-600' : 'bg-indigo-500 hover:bg-indigo-600';

            return `
            <div class="p-4 bg-gray-50 rounded-lg shadow-sm border border-gray-200 flex flex-col sm:flex-row justify-between items-center mb-3">
                <div class="flex flex-col">
                    <span class="font-semibold">${u.username} ${isSelf ? '(Вы)' : ''}</span>
                    <span class="text-sm text-gray-600">${u.email} (ID: ${u.id})</span>
                    <div class="text-xs mt-1">
                        Role: <b>${u.is_admin ? 'Admin' : 'User'}</b> | Status: <b>${u.is_blocked ? 'Blocked' : 'Active'}</b>
                    </div>
                </div>
                <div class="flex space-x-2 mt-2 sm:mt-0">
                    ${!isSelf ? `
                    <button data-id="${u.id}" data-action="block" data-val="${u.is_blocked}" class="admin-user-act px-3 py-1 text-white text-sm rounded ${blockCls}">${blockTxt}</button>
                    <button data-id="${u.id}" data-action="role" data-val="${u.is_admin}" class="admin-user-act px-3 py-1 text-white text-sm rounded ${roleCls}">${roleTxt}</button>
                    ` : '<span class="text-gray-400 text-xs">Действия недоступны</span>'}
                </div>
            </div>`;
        }).join('');
    }

    bindEvents() {
        this.elements.loginForm.addEventListener('submit', (e) => this.handleAuth(e, 'login'));
        this.elements.registerForm.addEventListener('submit', (e) => this.handleAuth(e, 'register'));
        this.elements.toggleAuthViewButton.addEventListener('click', () => {
            const isLogin = !this.elements.loginForm.classList.contains('hidden');
            this.changeState(isLogin ? 'register' : 'login');
        });
        this.elements.logoutButton.addEventListener('click', () => this.logout('Вы вышли из системы.'));

        document.querySelectorAll('.tab-button').forEach(btn => {
            btn.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
        });

        this.elements.actionsSelect.addEventListener('change', () => this.handleActionChange());
        this.elements.recordForm.addEventListener('submit', (e) => this.handleRecordSubmit(e));

        this.elements.applyReportFilterButton.addEventListener('click', () => this.loadRecordsAndReport());

        if (this.elements.adminAddActionForm) {
            this.elements.adminAddActionForm.addEventListener('submit', (e) => this.handleAdminAddAction(e));
        }

        if (this.elements.modalCloseBtn) {
            this.elements.modalCloseBtn.addEventListener('click', () => this.elements.editModal.classList.add('hidden'));
        }
        if (this.elements.editCoefficientForm) {
            this.elements.editCoefficientForm.addEventListener('submit', (e) => this.handleAdminEditCoefficient(e));
        }

        this.elements.adminActionsList.addEventListener('click', (e) => {
            const btn = e.target.closest('.admin-edit-action');
            if (btn) this.openEditModal(btn.dataset);
        });

        if (this.elements.adminUserSearchForm) {
            this.elements.adminUserSearchForm.addEventListener('submit', (e) => this.handleUserSearch(e));
        }
        if (this.elements.userSearchResults) {
            this.elements.userSearchResults.addEventListener('click', (e) => this.handleUserActionDelegation(e));
        }
    }

    async handleAuth(e, type) {
        e.preventDefault();
        const f = e.target;
        const res = type === 'login' 
            ? await this.api.login(f['login-username'].value, f['login-password'].value)
            : await this.api.register(f['register-username'].value, f['register-email'].value, f['register-password'].value);

        if (res.ok) {
            this.showMessage(res.data.message, 'success');
            if (type === 'login') {
                this.api.token = res.data.token;
                this.checkAuthStatus();
            } else {
                this.changeState('login');
            }
        } else {
            this.showMessage(res.data.message || 'Ошибка', 'error');
        }
    }

    handleActionChange() {
        const opt = this.elements.actionsSelect.selectedOptions[0];
        if (opt && opt.value) {
            this.elements.quantityUnit.textContent = `Ед. изм.: ${opt.dataset.unit}`;
            this.elements.actionDescription.textContent = opt.dataset.description;
        } else {
            this.elements.quantityUnit.textContent = 'Ед. изм.: -';
            this.elements.actionDescription.textContent = '';
        }
    }

    async handleRecordSubmit(e) {
        e.preventDefault();
        const actionId = this.elements.actionsSelect.value;
        const qty = document.getElementById('quantity').value;
        const date = document.getElementById('record-date').value;

        if (!actionId || qty <= 0) return this.showMessage('Проверьте данные', 'error');

        const res = await this.api.createRecord(actionId, qty, date);
        if (res.ok) {
            this.showMessage(res.data.message, 'success');
            this.elements.recordForm.reset();
            this.elements.quantityUnit.textContent = 'Ед. изм.: -';
            this.elements.actionDescription.textContent = '';
            document.getElementById('record-date').valueAsDate = new Date();
            this.loadRecordsAndReport();
        } else {
            this.showMessage(res.data.message, 'error');
        }
    }

    async handleAdminAddAction(e) {
        e.preventDefault();
        const f = e.target;
        const data = {
            name: f['add-name'].value,
            description: f['add-description'].value,
            category: f['add-category'].value,
            unit_of_measure: f['add-unit-of-measure'].value,
            coefficient_value: parseFloat(f['add-coefficient-value'].value),
            emission_unit: f['add-emission-unit'].value || 'kg CO2e'
        };

        const res = await this.api.addAction(data);
        if (res.ok) {
            this.showMessage('Действие добавлено', 'success');
            f.reset();
            this.loadActions(true);
        } else {
            this.showMessage(res.data.message, 'error');
        }
    }

    openEditModal(data) {
        document.getElementById('modal-action-name').textContent = `Действие: ${data.actionName}`;
        document.getElementById('modal-action-id').value = data.actionId;
        document.getElementById('modal-coefficient-id').value = data.coefficientId;
        document.getElementById('modal-coefficient-value').value = data.coefficientValue;
        this.elements.editModal.classList.remove('hidden');
    }

    async handleAdminEditCoefficient(e) {
        e.preventDefault();
        const aId = document.getElementById('modal-action-id').value;
        const cId = document.getElementById('modal-coefficient-id').value;
        const val = parseFloat(document.getElementById('modal-coefficient-value').value);

        const res = await this.api.updateCoefficient(aId, cId, val);
        if (res.ok) {
            this.showMessage('Коэффициент обновлен', 'success');
            this.elements.editModal.classList.add('hidden');
            this.loadActions(true);
        } else {
            this.showMessage(res.data.message, 'error');
        }
    }

    async handleUserSearch(e) {
        e.preventDefault();
        const q = document.getElementById('user-search-query').value;
        if (q.length < 2) return this.showMessage('Минимум 2 символа', 'error');

        const res = await this.api.searchUsers(q);
        if (res.ok) {
            this.renderUserSearchResults(res.data);
        } else {
            this.showMessage(res.data.message, 'error');
        }
    }

    async handleUserActionDelegation(e) {
        const btn = e.target.closest('.admin-user-act');
        if (!btn) return;

        const uid = btn.dataset.id;
        const action = btn.dataset.action;
        const currentVal = parseInt(btn.dataset.val);

        btn.disabled = true;
        let res;

        if (action === 'block') res = await this.api.toggleBlockUser(uid, currentVal);
        else if (action === 'role') res = await this.api.toggleUserRole(uid, currentVal);

        if (res && res.ok) {
            this.showMessage(res.data.message, 'success');
            this.elements.adminUserSearchForm.dispatchEvent(new Event('submit'));
        } else {
            this.showMessage(res?.data?.message || 'Ошибка', 'error');
            btn.disabled = false;
        }
    }
}

const app = new AppContext();