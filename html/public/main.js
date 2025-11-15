const API_URL = 'http://localhost:3000/api';
let currentUser = null;
let actionsList = [];
let chartInstance = null;
let currentTab = 'record';

const elements = {
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
    // Табы
    tabRecord: document.getElementById('tab-record'),
    tabReport: document.getElementById('tab-report'),
    adminPanel: document.getElementById('admin-panel'),
    adminTab: document.getElementById('admin-tab'),
    // Формы и списки
    recordForm: document.getElementById('record-form'),
    actionsSelect: document.getElementById('action-id'),
    quantityUnit: document.getElementById('quantity-unit'),
    actionDescription: document.getElementById('action-description'),
    recordsList: document.getElementById('records-list'),
    reportStartDate: document.getElementById('report-start-date'),
    reportEndDate: document.getElementById('report-end-date'),
    applyReportFilterButton: document.getElementById('apply-report-filter'),
    // Админ формы
    adminActionsList: document.getElementById('admin-actions-list'),
    adminAddActionForm: document.getElementById('admin-add-action-form'),
    userSearchResults: document.getElementById('admin-user-search-results'),
};

// --- УТИЛИТЫ ---

/**
 * Отображает глобальное сообщение.
 * @param {string} message - Текст сообщения.
 * @param {'success'|'error'} type - Тип сообщения.
 */
function showMessage(message, type) {
    elements.messageBox.textContent = message;
    elements.messageBox.classList.remove('bg-green-500', 'bg-red-500', 'alert-hidden');
    elements.messageBox.classList.add(type === 'success' ? 'bg-green-500' : 'bg-red-500');

    setTimeout(() => {
        elements.messageBox.classList.add('alert-hidden');
    }, 5000);
}

/**
 * Переключает вид приложения (auth или dashboard).
 * @param {'login'|'register'|'dashboard'} state
 */
function setAppState(state) {
    elements.authView.classList.add('hidden');
    elements.dashboardView.classList.add('hidden');
    elements.userInfo.classList.add('hidden');

    if (state === 'login' || state === 'register') {
        elements.authView.classList.remove('hidden');
        elements.authTitle.textContent = state === 'login' ? 'Вход' : 'Регистрация';
        elements.loginForm.classList.toggle('hidden', state !== 'login');
        elements.registerForm.classList.toggle('hidden', state !== 'register');
        elements.toggleAuthViewButton.textContent = state === 'login' ? 'Нет аккаунта? Зарегистрируйтесь!' : 'Уже есть аккаунт? Войдите!';
    } else if (state === 'dashboard') {
        elements.dashboardView.classList.remove('hidden');
        elements.userInfo.classList.remove('hidden');
    }
}

/**
 * Переключает активную вкладку.
 * @param {string} tabName 
 */
function switchTab(tabName) {
    currentTab = tabName;
    
    // Скрыть все содержимое вкладок
    elements.tabRecord.classList.add('hidden');
    elements.tabReport.classList.add('hidden');
    elements.adminPanel.classList.add('hidden');
    
    // НОВОЕ: Скрываем вкладку Методологии
    const methodologyTab = document.getElementById('tab-methodology');
    if (methodologyTab) methodologyTab.classList.add('hidden');


    // Сбросить активный класс со всех кнопок
    document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));

    // Показать выбранную вкладку и активировать кнопку
    const activeContent = document.getElementById(`tab-${tabName}`);
    const activeButton = document.querySelector(`.tab-button[data-tab="${tabName}"]`);
    
    if (activeContent) activeContent.classList.remove('hidden');
    if (activeButton) activeButton.classList.add('active');

    // Специальная обработка для админ-панели
    if (tabName === 'admin') {
        elements.adminPanel.classList.remove('hidden');
        // Перезагрузка списка действий для редактирования коэффициентов
        fetchActions(true); 
    }
}


// АУТЕНТИФИКАЦИЯ 

async function handleAuth(event, endpoint) {
    event.preventDefault();
    const form = event.target;
    const data = {};
    if (endpoint === 'register') {
        data.username = form['register-username'].value.trim();
        data.email = form['register-email'].value.trim();
        data.password = form['register-password'].value;
    } else { // login
        data.username = form['login-username'].value.trim();
        data.password = form['login-password'].value;
    }
    try {
        const response = await fetch(`${API_URL}/${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        const result = await response.json();
        if (response.ok) {
            showMessage(result.message, 'success');
            if (endpoint === 'login') {
                localStorage.setItem('authToken', result.token);
                if (result.user.isBlocked === 1) {
                    handleLogout(); 
                    showMessage('Ваша учетная запись заблокирована администратором.', 'error');
                    return;
                }
                await checkAuthStatus();
            } else {
                setAppState('login');
            }
        } else {
            showMessage(result.message || 'Ошибка аутентификации.', 'error');
        }
    } catch (error) {
        showMessage('Сетевая ошибка. Проверьте подключение к серверу.', 'error');
    }
}

function handleLogout() {
    localStorage.removeItem('authToken');
    currentUser = null;
    elements.adminTab.classList.add('hidden');
    // Добавим скрытие вкладки Методология, если она была активна
    const methodologyTab = document.getElementById('tab-methodology');
    if (methodologyTab) methodologyTab.classList.add('hidden');
    elements.adminPanel.classList.add('hidden');
    setAppState('login');
    // Очистка UI после выхода
    if (chartInstance) {
        chartInstance.destroy();
        chartInstance = null;
    }
    elements.recordsList.innerHTML = '<p class="text-gray-500 italic">История очищена.</p>';
    renderEmptyReport();
}

async function checkAuthStatus() {
    const token = localStorage.getItem('authToken');
    
    if (token) {
        try {
            const response = await fetch(`${API_URL}/user`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.ok) {
                const user = await response.json();
                if (user.isBlocked === 1) {
                    handleLogout(); 
                    showMessage('Ваш аккаунт заблокирован. Сессия завершена.', 'error');
                    return;
                }
                setAppState('dashboard');
                currentUser = user; 
                if (currentUser.isAdmin === 1) {
                    elements.adminTab.classList.remove('hidden');
                    elements.adminPanel.classList.remove('hidden');
                    elements.adminPanel.classList.add('hidden'); 
                    setupAdminListeners(); 
                    document.getElementById('welcome-message').textContent = `Добро пожаловать, Администратор ${currentUser.username}!`;
                } else {
                    elements.adminTab.classList.add('hidden');
                    elements.adminPanel.classList.add('hidden');
                    document.getElementById('welcome-message').textContent = `Добро пожаловать, ${currentUser.username}!`;
                }
                switchTab('record');
                await fetchActions();
                await fetchRecordsAndReport();
            } else {
                handleLogout();
                if (response.status === 403) {
                    const errorBody = await response.json();
                    showMessage(errorBody.message || 'Доступ запрещен. Возможно, ваш аккаунт заблокирован.', 'error');
                } else {
                    showMessage('Сессия истекла. Пожалуйста, войдите снова.', 'error');
                }
            }
        } catch (error) {
            handleLogout();
            showMessage('Сетевая ошибка при проверке статуса.', 'error');
        }
    } else {
        setAppState('login');
    }
}

// ДЕЙСТВИЯ: ФУНКЦИИ ЗАГРУЗКИ ДАННЫХ

/** Загрузка списка действий */
async function fetchActions(isAdminView = false) {
    try {
        const response = await fetch(`${API_URL}/actions`);
        if (!response.ok) throw new Error('Не удалось загрузить действия');
        actionsList = await response.json();
        
        // Обновляем список для пользователя
        populateActionsSelect(actionsList);
        
        // Обновляем список для админ-панели
        if (isAdminView) {
            renderAdminActionsList(actionsList);
        }

    } catch (error) {
        console.error("Ошибка при загрузке действий:", error);
        showMessage('Ошибка при загрузке списка действий.', 'error');
    }
}

/** Заполнение SELECT элемента для записи действий */
function populateActionsSelect(actions) {
    elements.actionsSelect.innerHTML = '<option value="">Выберите действие...</option>';
    actions.forEach(action => {
        const option = document.createElement('option');
        option.value = action.id;
        option.textContent = `${action.name} (${action.category})`;
        option.dataset.unit = action.unit_of_measure;
        option.dataset.description = action.description;
        elements.actionsSelect.appendChild(option);
    });
}

/** Обработчик изменения выбранного действия */
function handleActionChange() {
    const selectedOption = elements.actionsSelect.options[elements.actionsSelect.selectedIndex];
    if (selectedOption.value) {
        elements.quantityUnit.textContent = `Ед. изм.: ${selectedOption.dataset.unit}`;
        elements.actionDescription.textContent = selectedOption.dataset.description;
    } else {
        elements.quantityUnit.textContent = 'Ед. изм.: -';
        elements.actionDescription.textContent = '';
    }
}

//ДЕЙСТВИЯ: ФУНКЦИИ ЗАПИСИ И ОТЧЕТА

async function handleRecordSubmit(event) {
    event.preventDefault();
    const action_id = elements.actionsSelect.value;
    const quantity = parseFloat(document.getElementById('quantity').value);
    const record_date = document.getElementById('record-date').value;

    if (!action_id || quantity <= 0 || !record_date) {
        showMessage('Пожалуйста, заполните все поля корректно.', 'error');
        return;
    }
    const token = localStorage.getItem('authToken');
    try {
        const response = await fetch(`${API_URL}/record`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ action_id: parseInt(action_id), quantity, record_date })
        });
        const result = await response.json();
        if (response.ok) {
            showMessage(result.message, 'success');
            elements.recordForm.reset();
            elements.quantityUnit.textContent = 'Ед. изм.: -';
            elements.actionDescription.textContent = '';
            await fetchRecordsAndReport();
        } else {
            showMessage(result.message || 'Ошибка при сохранении записи.', 'error');
        }
    } catch (error) {
        showMessage('Сетевая ошибка при записи действия.', 'error');
    }
}

/** Загрузка отчета и истории записей */
async function fetchRecordsAndReport() {
    const token = localStorage.getItem('authToken');
    if (!token) return;
    const startDate = elements.reportStartDate.value;
    const endDate = elements.reportEndDate.value;
    const queryParams = new URLSearchParams();
    if (startDate) queryParams.append('startDate', startDate);
    if (endDate) queryParams.append('endDate', endDate);
    try {
        const reportResponse = await fetch(`${API_URL}/report?${queryParams.toString()}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (reportResponse.ok) {
            const reportData = await reportResponse.json();
            renderReport(reportData);
        } else {
            throw new Error('Не удалось загрузить отчет');
        }
        const recordsResponse = await fetch(`${API_URL}/records`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (recordsResponse.ok) {
            const recordsData = await recordsResponse.json();
            renderRecordsList(recordsData);
        } else {
            throw new Error('Не удалось загрузить историю записей');
        }
    } catch (error) {
        console.error("Ошибка при загрузке данных:", error);
        showMessage('Ошибка при загрузке отчета или истории.', 'error');
    }
}

/** Рендеринг списка записей */
function renderRecordsList(records) {
    const list = elements.recordsList;
    list.innerHTML = ''; // Очистка

    if (records.length === 0) {
        list.innerHTML = '<p class="text-gray-500 italic">У вас пока нет записей о действиях.</p>';
        return;
    }

    records.forEach(record => {
        const item = document.createElement('div');
        item.className = 'p-3 bg-gray-50 rounded-lg shadow-sm border-l-4 border-green-400 flex justify-between items-center';
        
        item.innerHTML = `
            <div>
                <p class="font-semibold text-gray-800">${record.action_name}</p>
                <p class="text-sm text-gray-600">${record.quantity} ${record.unit_of_measure} от ${record.record_date}</p>
            </div>
            <div class="text-right">
                <p class="text-lg font-bold text-green-700">-${record.contribution.toFixed(2)}</p>
                <p class="text-xs text-green-600">${record.emission_unit} (вклад)</p>
            </div>
        `;
        list.appendChild(item);
    });
}

/** Рендеринг отчета и графика */
function renderReport(report) {
    const totalContributionEl = document.getElementById('total-contribution');
    const contributionUnitEl = document.getElementById('contribution-unit');
    const chartCanvas = document.getElementById('contribution-chart');
    const noDataMsg = document.getElementById('no-data-msg');

    if (report.total_contribution > 0) {
        if (chartInstance) {
            chartInstance.destroy(); 
        }
        totalContributionEl.textContent = report.total_contribution.toFixed(2);
        contributionUnitEl.textContent = report.unit;
        chartCanvas.classList.remove('hidden');
        noDataMsg.classList.add('hidden');
        const categories = report.details_by_category.map(d => d.category);
        const contributions = report.details_by_category.map(d => d.contribution);
        chartInstance = new Chart(chartCanvas, {
            type: 'doughnut',
            data: {
                labels: categories,
                datasets: [{
                    data: contributions,
                    backgroundColor: [
                        '#34d399', '#fcd34d', '#fb7185', '#60a5fa', '#a78bfa'
                    ], 
                    hoverOffset: 4
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'right',
                    },
                    title: {
                        display: true,
                        text: 'Вклад по категориям действий'
                    }
                }
            }
        });
    } else {
        renderEmptyReport();
    }
}

/** Сбрасывает UI отчета, когда нет данных */
function renderEmptyReport() {
    const totalContributionEl = document.getElementById('total-contribution');
    const contributionUnitEl = document.getElementById('contribution-unit');
    const chartCanvas = document.getElementById('contribution-chart');
    const noDataMsg = document.getElementById('no-data-msg');

    if (totalContributionEl) totalContributionEl.textContent = '0.00';
    if (contributionUnitEl) contributionUnitEl.textContent = 'kg CO2e';

    if (chartInstance) {
        chartInstance.destroy();
        chartInstance = null;
    }
    
    // Скрываем canvas и показываем сообщение
    if (chartCanvas) chartCanvas.classList.add('hidden');
    if (noDataMsg) noDataMsg.classList.remove('hidden');
}


// --- АДМИН ПАНЕЛЬ: Функции управления коэффициентами ---

/** Рендерит список действий с кнопками редактирования для админ-панели */
function renderAdminActionsList(actions) {
    const list = elements.adminActionsList;
    list.innerHTML = '';
    
    if (actions.length === 0) {
        list.innerHTML = '<p class="text-gray-500 italic">Нет доступных действий.</p>';
        return;
    }

    actions.forEach(action => {
        const item = document.createElement('div');
        item.className = 'p-3 bg-white rounded-lg shadow-sm border border-gray-100 flex justify-between items-center';
        
        item.innerHTML = `
            <div class="flex-1 min-w-0">
                <p class="font-semibold text-gray-800 truncate">${action.name} <span class="text-xs text-gray-500">(${action.category})</span></p>
                <p class="text-sm text-gray-600">Коэф: <span class="font-medium text-yellow-700">${action.coefficient_value}</span> ${action.emission_unit} / ${action.unit_of_measure}</p>
            </div>
            <button 
                data-action-id="${action.id}"
                data-action-name="${action.name}"
                data-coefficient-id="${action.coefficient_id}"
                data-coefficient-value="${action.coefficient_value}"
                class="admin-edit-action px-3 py-1 bg-yellow-500 text-white text-sm rounded-lg shadow-md hover:bg-yellow-600 transition duration-150 ml-4 flex-shrink-0"
            >
                Изменить
            </button>
        `;
        list.appendChild(item);
    });
}

/** Открывает модальное окно для редактирования коэффициента */
function handleAdminEditAction(actionId) {
    const action = actionsList.find(a => a.id == actionId);
    if (!action) {
        showMessage('Действие не найдено.', 'error');
        return;
    }

    const modal = document.getElementById('edit-modal');
    document.getElementById('modal-action-name').textContent = `Действие: ${action.name}`;
    document.getElementById('modal-action-id').value = action.id;
    document.getElementById('modal-coefficient-id').value = action.coefficient_id;
    document.getElementById('modal-coefficient-value').value = action.coefficient_value;

    modal.classList.remove('hidden');
}

/** Обрабатывает отправку формы изменения коэффициента */
async function handleAdminEditCoefficient(event) {
    event.preventDefault();
    const actionId = document.getElementById('modal-action-id').value;
    const coefficientId = document.getElementById('modal-coefficient-id').value;
    const coefficientValue = parseFloat(document.getElementById('modal-coefficient-value').value);

    if (isNaN(coefficientValue) || coefficientValue <= 0) {
        showMessage('Неверное значение коэффициента.', 'error');
        return;
    }

    const token = localStorage.getItem('authToken');

    try {
        const response = await fetch(`${API_URL}/actions/${actionId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ 
                coefficient_value: coefficientValue,
                coefficient_id: parseInt(coefficientId) 
            })
        });

        const result = await response.json();

        if (response.ok) {
            showMessage(result.message, 'success');
            document.getElementById('edit-modal').classList.add('hidden');
            // Обновить список действий на UI
            await fetchActions(true);
        } else {
            showMessage(result.message || 'Ошибка при обновлении коэффициента.', 'error');
        }
    } catch (error) {
        showMessage('Сетевая ошибка при обновлении коэффициента.', 'error');
    }
}

/** Обрабатывает отправку формы добавления нового действия */
async function handleAdminAddAction(event) {
    event.preventDefault();
    const form = event.target;
    
    const data = {
        name: form['add-name'].value,
        description: form['add-description'].value,
        category: form['add-category'].value,
        unit_of_measure: form['add-unit-of-measure'].value,
        coefficient_value: parseFloat(form['add-coefficient-value'].value),
        emission_unit: form['add-emission-unit'].value || 'kg CO2e',
    };

    if (data.coefficient_value <= 0 || isNaN(data.coefficient_value)) {
            showMessage('Коэффициент выброса должен быть положительным числом.', 'error');
        return;
    }
    
    const token = localStorage.getItem('authToken');

    try {
        const response = await fetch(`${API_URL}/actions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(data)
        });

        const result = await response.json();

        if (response.ok) {
            showMessage(result.message, 'success');
            form.reset();
            // Обновить список действий
            await fetchActions(true);
        } else {
            showMessage(result.message || 'Ошибка при добавлении действия.', 'error');
        }

    } catch (error) {
        showMessage('Сетевая ошибка при добавлении действия.', 'error');
    }
}

// --- АДМИН ПАНЕЛЬ: Функции управления пользователями (НОВЫЕ) ---

/** Обрабатывает отправку формы поиска пользователей */
async function handleAdminUserSearch(event) {
    event.preventDefault();
    const query = document.getElementById('user-search-query').value.trim();
    const resultsContainer = document.getElementById('admin-user-search-results');
    
    if (query.length < 2) {
        resultsContainer.innerHTML = `<p class="text-red-500">Слишком короткий поисковый запрос (мин. 2 символа).</p>`;
        return;
    }

    const token = localStorage.getItem('authToken');
    resultsContainer.innerHTML = `<p class="text-gray-500 italic">Поиск...</p>`;

    try {
        const response = await fetch(`${API_URL}/users/search?query=${encodeURIComponent(query)}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            const users = await response.json();
            renderUserSearchResults(users);
        } else {
            const errorBody = await response.json();
            resultsContainer.innerHTML = `<p class="text-red-500">${errorBody.message || 'Ошибка при поиске пользователей.'}</p>`;
        }
    } catch (error) {
        resultsContainer.innerHTML = `<p class="text-red-500">Сетевая ошибка при поиске пользователей.</p>`;
    }
}

/**
 * Рендерит результаты поиска пользователей с кнопками управления.
 * @param {Array<Object>} users 
 */
function renderUserSearchResults(users) {
    const resultsContainer = elements.userSearchResults;
    if (!resultsContainer) return;
    
    if (users.length === 0) {
        resultsContainer.innerHTML = `<p class="text-gray-500 italic">Пользователи не найдены.</p>`;
        return;
    }

    resultsContainer.innerHTML = users.map(user => {
        const blockButtonText = user.is_blocked === 1 ? 'Разблокировать' : 'Заблокировать';
        const blockButtonClass = user.is_blocked === 1 ? 'bg-yellow-500 hover:bg-yellow-600' : 'bg-red-500 hover:bg-red-600';
        
        const roleButtonText = user.is_admin === 1 ? 'Сделать обычным' : 'Сделать Админом';
        const roleButtonClass = user.is_admin === 1 ? 'bg-blue-500 hover:bg-blue-600' : 'bg-indigo-500 hover:bg-indigo-600';

        const isSelf = user.id === currentUser.userId;

        return `
            <div class="p-4 bg-gray-50 rounded-lg shadow-sm border border-gray-200 flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-2 sm:space-y-0 mb-3">
                <div class="flex flex-col">
                    <span class="font-semibold text-lg">${user.username} ${isSelf ? '(Вы)' : ''}</span>
                    <span class="text-sm text-gray-600">${user.email} (ID: ${user.id})</span>
                    <div class="mt-1 text-sm">
                        <span class="font-medium">Роль: <span class="${user.is_admin === 1 ? 'text-green-600 font-bold' : 'text-gray-500'}">${user.is_admin === 1 ? 'Администратор' : 'Пользователь'}</span></span>
                        <span class="ml-4 font-medium">Статус: <span class="${user.is_blocked === 1 ? 'text-red-600 font-bold' : 'text-green-600'}">${user.is_blocked === 1 ? 'Заблокирован' : 'Активен'}</span></span>
                    </div>
                </div>
                <div class="flex space-x-2 w-full sm:w-auto">
                    ${!isSelf ? `
                        <button 
                            data-user-id="${user.id}" 
                            data-action-type="block" 
                            data-current-status="${user.is_blocked}"
                            class="admin-user-action flex-1 sm:flex-none px-3 py-1 text-white text-sm rounded-lg transition ${blockButtonClass}"
                        >
                            ${blockButtonText}
                        </button>
                        <button 
                            data-user-id="${user.id}" 
                            data-action-type="role" 
                            data-current-status="${user.is_admin}"
                            class="admin-user-action flex-1 sm:flex-none px-3 py-1 text-white text-sm rounded-lg transition ${roleButtonClass}"
                        >
                            ${roleButtonText}
                        </button>
                    ` : `<span class="text-gray-400 italic text-sm">Действия недоступны</span>`}
                </div>
            </div>
        `;
    }).join('');
}

/**
 * Обрабатывает все административные действия (Блокировка/Смена роли)
 * Использует делегирование событий.
 * @param {Event} e 
 */
async function handleAdminUserAction(e) {
    const button = e.target.closest('.admin-user-action');
    if (!button) return;

    const userId = button.dataset.userId;
    const actionType = button.dataset.actionType;
    const currentStatus = parseInt(button.dataset.currentStatus, 10);
    
    if (!userId || !actionType) return;
    
    // Блокируем кнопку на время выполнения запроса
    button.disabled = true;
    const originalText = button.textContent;
    button.textContent = 'Обработка...';

    try {
        let url;
        let newStatus = actionType === 'block' ? (currentStatus === 1 ? 0 : 1) : (currentStatus === 1 ? 0 : 1);
        let body;

        if (actionType === 'block') {
            url = `${API_URL}/admin/users/${userId}/block`;
            body = { is_blocked: newStatus };
        } else if (actionType === 'role') {
            url = `${API_URL}/admin/users/${userId}/role`;
            body = { is_admin: newStatus };
        } else {
            return; // Неизвестное действие
        }

        const response = await fetch(url, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('authToken')}`
            },
            body: JSON.stringify(body)
        });

        if (response.ok) {
            const data = await response.json();
            showMessage(data.message, 'success');
            // Перезапускаем поиск для обновления результатов на UI
            const query = document.getElementById('user-search-query').value;
            if (query) {
                document.getElementById('admin-user-search-form').dispatchEvent(new Event('submit', { cancelable: true }));
            } else {
                elements.userSearchResults.innerHTML = '<p class="text-gray-500 italic">Статус пользователя обновлен. Обновите поиск.</p>';
            }
        } else {
            const errorBody = await response.json();
            showMessage(errorBody.message || `Ошибка при выполнении ${actionType} действия.`, 'error');
        }

    } catch (error) {
        showMessage(`Сетевая ошибка: ${error.message}`, 'error');
    } finally {
        // Восстанавливаем кнопку в случае ошибки (если пользователь не был форсированно разлогинен)
        button.textContent = originalText;
        button.disabled = false;
    }
}

/** Добавление слушателей для админских форм/кнопок */
function setupAdminListeners() {
    // 1. Добавление нового действия
    if (elements.adminAddActionForm) {
        elements.adminAddActionForm.removeEventListener('submit', handleAdminAddAction);
        elements.adminAddActionForm.addEventListener('submit', handleAdminAddAction);
    }
    
    // 2. Редактирование коэффициента (Модальное окно)
    const editModal = document.getElementById('edit-modal');
    const editForm = document.getElementById('admin-edit-coefficient-form');
    const closeButton = document.getElementById('modal-close');

    if (editForm) {
        editForm.removeEventListener('submit', handleAdminEditCoefficient);
        editForm.addEventListener('submit', handleAdminEditCoefficient);
    }
    if (closeButton) {
        closeButton.removeEventListener('click', () => editModal.classList.add('hidden'));
        closeButton.addEventListener('click', () => editModal.classList.add('hidden'));
    }

    // Делегирование для кнопок редактирования действия (Коэффициенты)
    elements.adminActionsList.removeEventListener('click', handleActionEditDelegation);
    elements.adminActionsList.addEventListener('click', handleActionEditDelegation);
    
    // 3. Поиск пользователя
    const userSearchForm = document.getElementById('admin-user-search-form');
    if (userSearchForm) {
        userSearchForm.removeEventListener('submit', handleAdminUserSearch);
        userSearchForm.addEventListener('submit', handleAdminUserSearch);
    }

    // 4. Делегирование для кнопок управления пользователями (Блокировка/Роль)
    elements.userSearchResults.removeEventListener('click', handleAdminUserAction);
    elements.userSearchResults.addEventListener('click', handleAdminUserAction);
}

/** Делегирование для кнопок редактирования действия */
function handleActionEditDelegation(e) {
    const button = e.target.closest('.admin-edit-action');
    if (button) {
        const actionId = button.dataset.actionId;
        handleAdminEditAction(actionId);
    }
}


// --- Инициализация ---\

window.onload = () => {
    // Аутентификация
    elements.loginForm.addEventListener('submit', (e) => handleAuth(e, 'login'));
    elements.registerForm.addEventListener('submit', (e) => handleAuth(e, 'register'));
    elements.toggleAuthViewButton.addEventListener('click', () => {
        setAppState(elements.authTitle.textContent.includes('Вход') ? 'register' : 'login');
    });
    elements.logoutButton.addEventListener('click', handleLogout);

    // Дэшборд
    elements.actionsSelect.addEventListener('change', handleActionChange);
    elements.recordForm.addEventListener('submit', handleRecordSubmit);
    elements.applyReportFilterButton.addEventListener('click', fetchRecordsAndReport);
    document.querySelectorAll('.tab-button').forEach(button => {
        button.addEventListener('click', (e) => switchTab(e.target.dataset.tab));
    });
    
    // Установка текущей даты в поле записи
    document.getElementById('record-date').valueAsDate = new Date();

    checkAuthStatus();
};