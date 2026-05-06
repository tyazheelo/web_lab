let currentUsername;

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

(function (){
    logInBtn.addEventListener('click', () => {
        logInBtn.style.display = 'none';
        registrationBtn.style.display = 'none';

        logInBlock.style.display = 'flex';
    });

    registrationBtn.addEventListener('click', () => {
        logInBtn.style.display = 'none';
        registrationBtn.style.display = 'none';

        registrationBlock.style.display = 'flex';
    });
    cancelLoginBtn.addEventListener('click', () => {
        logInBlock.style.display = 'none';

        logInBtn.style.display = 'block';
        registrationBtn.style.display = 'block';

        const loginInputs = logInBlock.querySelectorAll('input');
        loginInputs.forEach(input => input.value = '');
    });

    cancelRegBtn.addEventListener('click', () => {
        registrationBlock.style.display = 'none';

        logInBtn.style.display = 'block';
        registrationBtn.style.display = 'block';

        const regInputs = registrationBlock.querySelectorAll('input');
        regInputs.forEach(input => input.value = '');
    });

    submitRegBtn.addEventListener('click', async (event) => {
        event.preventDefault();

        const usernameInput = document.querySelector(`#${registrationBlockId} #username-input`);
        const passwordInput = document.querySelector(`#${registrationBlockId} #password-input`);
        const passwordInputSubmit = document.querySelector(`#${registrationBlockId} #password-input-submit`);

        if(!usernameInput || !passwordInputSubmit || !passwordInput) {
            console.error('Элементы формы не найдены');
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
                registrationBlock.style.display = 'none';
                chatBlock.style.display = 'flex';
                currentUserHeader.innerText= username;

                currentUsername = username;
            } else {
                const errorData = await registerResponse.json();
                alert(errorData.message);
            }
        } catch (err) {
            console.error('Ошибка:', err);
            alert(err.message);
        }
    });

    submitLogInBtn.addEventListener('click', async (event) => {
        event.preventDefault();

        const usernameInput = document.querySelector(`#${loginBlockId} #username-input`);
        const passwordInput = document.querySelector(`#${loginBlockId} #password-input`);

        if(!usernameInput || !passwordInput) {
            console.error('Элементы формы не найдены');
            alert('Ошибка: не найдены поля формы');
            return;
        }

        const username = usernameInput.value.trim();
        const password = passwordInput.value.trim();

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
                logInBlock.style.display = 'none';
                chatBlock.style.display = 'flex';
                currentUserHeader.innerText= username;

                currentUsername = username;
            } else {
                const errorData = await loginResponse.json();
                alert(errorData.message);
            }
        } catch (err) {
            console.error('Ошибка:', err);
            alert(err.message);
        }
    })
}());

export{
    currentUsername,
}