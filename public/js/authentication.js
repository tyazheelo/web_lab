let currentUsername = null;
let isCurrentUserAdmin = false;

const currentUserHeader = document.getElementById('current-name');

const cancelBtnClass = "cancel-btn";
const registrationBlockId = "registration-block";
const loginBlockId = "log-in-block";

const logInBtn = document.getElementById('log-in-btn');
const registrationBtn = document.getElementById('registration-btn');
const logInBlock = document.getElementById(loginBlockId);
const registrationBlock = document.getElementById(registrationBlockId);

const cancelLoginBtn = document.querySelector(`#${loginBlockId} .${cancelBtnClass}`);
const cancelRegBtn = document.querySelector(`#${registrationBlockId} .${cancelBtnClass}`);
const submitRegBtn = document.getElementById('submit-reg-btn');
const submitLogInBtn = document.getElementById('submit-login-btn');

const chatBlock = document.getElementById('chat-block');

function initChatWithUser(username, isAdmin) {
    currentUsername = username;
    isCurrentUserAdmin = isAdmin;

    if (currentUserHeader) {
        currentUserHeader.innerText = username;
        if (isAdmin) {
            currentUserHeader.style.color = '#e91e63';
            currentUserHeader.title = 'Администратор';
        }
    }

    if (chatBlock) {
        chatBlock.style.display = 'flex';
    }

    if (window.socket) {
        window.socket.emit('user:register', {
            username,
            password: isAdmin ? 'admin' : '',
            isAdminLogin: isAdmin
        });
    } else {
        const checkSocket = setInterval(() => {
            if (window.socket) {
                clearInterval(checkSocket);
                window.socket.emit('user:register', {
                    username,
                    password: isAdmin ? 'admin' : '',
                    isAdminLogin: isAdmin
                });
            }
        }, 100);
    }
}

function hideAuthForms() {
    const authBtnsBlock = document.getElementById('auth-btns-block');
    if (authBtnsBlock) authBtnsBlock.style.display = 'none';
    if (logInBlock) logInBlock.style.display = 'none';
    if (registrationBlock) registrationBlock.style.display = 'none';
}

(function (){
    if (logInBtn) {
        logInBtn.addEventListener('click', () => {
            logInBtn.style.display = 'none';
            registrationBtn.style.display = 'none';
            logInBlock.style.display = 'flex';
        });
    }

    if (registrationBtn) {
        registrationBtn.addEventListener('click', () => {
            logInBtn.style.display = 'none';
            registrationBtn.style.display = 'none';
            registrationBlock.style.display = 'flex';
        });
    }

    if (cancelLoginBtn) {
        cancelLoginBtn.addEventListener('click', () => {
            logInBlock.style.display = 'none';
            logInBtn.style.display = 'block';
            registrationBtn.style.display = 'block';
            const loginInputs = logInBlock.querySelectorAll('input');
            loginInputs.forEach(input => input.value = '');
        });
    }

    if (cancelRegBtn) {
        cancelRegBtn.addEventListener('click', () => {
            registrationBlock.style.display = 'none';
            logInBtn.style.display = 'block';
            registrationBtn.style.display = 'block';
            const regInputs = registrationBlock.querySelectorAll('input');
            regInputs.forEach(input => input.value = '');
        });
    }

    if (submitRegBtn) {
        submitRegBtn.addEventListener('click', async (event) => {
            event.preventDefault();

            const usernameInput = document.querySelector(`#${registrationBlockId} #username-input`);
            const passwordInput = document.querySelector(`#${registrationBlockId} #password-input`);
            const passwordInputSubmit = document.querySelector(`#${registrationBlockId} #password-input-submit`);

            if(!usernameInput || !passwordInputSubmit || !passwordInput) {
                alert('Ошибка: не найдены поля формы');
                return;
            }

            const username = usernameInput.value.trim();
            const password = passwordInput.value.trim();
            const passwordSubmit = passwordInputSubmit.value.trim();

            if(!username || !password || !passwordSubmit) {
                alert('Заполните все поля!');
                return;
            }

            if(password !== passwordSubmit) {
                alert('Пароли должны совпадать!');
                return;
            }

            if (username === 'Admin') {
                alert('Имя Admin зарезервировано для администратора');
                return;
            }

            try {
                const registerResponse = await fetch('/api/users/register', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        username: username,
                        password: password
                    })
                });

                if (registerResponse.ok) {
                    alert("Вы успешно зарегистрировались!");
                    hideAuthForms();
                    initChatWithUser(username, false);
                } else {
                    const errorData = await registerResponse.json();
                    alert(errorData.message || errorData);
                }
            } catch (err) {
                console.error('Ошибка:', err);
                alert(err.message);
            }
        });
    }

    if (submitLogInBtn) {
        submitLogInBtn.addEventListener('click', async (event) => {
            event.preventDefault();

            const usernameInput = document.querySelector(`#${loginBlockId} #username-input`);
            const passwordInput = document.querySelector(`#${loginBlockId} #password-input`);

            if(!usernameInput || !passwordInput) {
                alert('Ошибка: не найдены поля формы');
                return;
            }

            const username = usernameInput.value.trim();
            const password = passwordInput.value.trim();

            if(!username || !password) {
                alert('Заполните все поля!');
                return;
            }

            // Вход для админа
            if (username === 'Admin') {
                if (password === 'admin') {
                    hideAuthForms();
                    initChatWithUser('Admin', true);
                } else {
                    alert('Неверный пароль администратора');
                }
                return;
            }

            // Вход для обычного пользователя
            try {
                const loginResponse = await fetch('/api/users/login', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        username: username,
                        password: password
                    })
                });

                if (loginResponse.ok) {
                    hideAuthForms();
                    initChatWithUser(username, false);
                } else {
                    const errorData = await loginResponse.json();
                    alert(errorData.message);
                }
            } catch (err) {
                console.error('Ошибка:', err);
                alert(err.message);
            }
        });
    }
}());

function getCurrentUsername() {
    return currentUsername;
}

function isAdmin() {
    return isCurrentUserAdmin;
}

export {
    getCurrentUsername,
    isAdmin,
    initChatWithUser
};