import { currentUsername, isCurrentUserAdmin } from './authentication.js';

let currentRecipient = null;
let adminChats = new Map();

const socketUrl = window.location.origin;

window.socket = io(socketUrl, {
  transports: ['polling', 'websocket'],
  path: '/socket.io/'
});

const toMainPage = document.getElementById('to-main-page');
const attachBtn = document.getElementById('attach-btn');
const fileInput = document.getElementById('file-input');
const sendBtn = document.getElementById('send-btn');
const messageInput = document.getElementById('message-input');
const chatContainer = document.getElementById('chat');
const userListContainer = document.getElementById('user-list');
const currentUserNameSpan = document.getElementById('current-name');
const companionNameSpan = document.getElementById('companion-name');

if (currentUsername) {
  currentUserNameSpan.textContent = currentUsername;

  if (isCurrentUserAdmin) {
    currentUserNameSpan.style.color = '#e91e63';
  }
}

window.socket.on('connect', () => {
  console.log('Socket connected:', window.socket.id);

  if (currentUsername) {
    window.socket.emit('user:register', {
      username: currentUsername,
      password: isCurrentUserAdmin ? 'admin' : ''
    });
  }
});

window.socket.on('user:register:success', (data) => {
  console.log('Registered:', data.username);

  if (!isCurrentUserAdmin) {
    currentRecipient = 'Admin';
    companionNameSpan.textContent = 'Admin';
  }
});

window.socket.on('user:register:error', (error) => {
  alert(error);
});

window.socket.on('chat:history', (history) => {
  if (isCurrentUserAdmin) return;

  chatContainer.innerHTML = '';

  history.forEach(message => {
    displayMessage(message);
  });

  scrollToBottom();
});

window.socket.on('chat:message', (message) => {

  if (isCurrentUserAdmin) {

    const username =
      message.sender === 'Admin'
        ? message.recipient
        : message.sender;

    if (!adminChats.has(username)) {
      adminChats.set(username, []);
    }

    adminChats.get(username).push(message);

    if (currentRecipient === username) {
      displayMessage(message);
      scrollToBottom();
    }

  } else {

    displayMessage(message);
    scrollToBottom();
  }
});

window.socket.on('admin:userList', updateAdminUserList);

window.socket.on('admin:chatHistory', ({ username, history }) => {

  adminChats.set(username, history);

  if (currentRecipient === username) {

    chatContainer.innerHTML = '';

    history.forEach(message => {
      displayMessage(message);
    });

    scrollToBottom();
  }
});

function sendMessage() {

  const content = messageInput.value.trim();

  if (!content) return;

  if (isCurrentUserAdmin && !currentRecipient) {
    alert('Выберите пользователя');
    return;
  }

  window.socket.emit('chat:text', {
    content,
    recipientUsername: currentRecipient
  });

  messageInput.value = '';
}

sendBtn.addEventListener('click', sendMessage);

messageInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    sendMessage();
  }
});

function displayMessage(message) {

  const messageElement = document.createElement('div');

  messageElement.classList.add('message');

  if (message.sender === currentUsername) {
    messageElement.classList.add('my-message');
  } else {
    messageElement.classList.add('other-message');
  }

  const contentElement = document.createElement('div');

  contentElement.classList.add('message-content');

  if (message.type === 'file') {
    contentElement.innerHTML = message.content;
  } else {
    contentElement.textContent = message.content;
  }

  messageElement.innerHTML = `
  <div class="message-author">${message.sender}</div>
`;

  messageElement.appendChild(contentElement);


  chatContainer.appendChild(messageElement);
}

function scrollToBottom() {
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

function updateAdminUserList(users) {

  if (!isCurrentUserAdmin) return;

  userListContainer.innerHTML = '';

  users.forEach(username => {

    const userItem = document.createElement('div');

    userItem.classList.add('user-item');
    userItem.textContent = username;

    userItem.addEventListener('click', () => {

      currentRecipient = username;

      companionNameSpan.textContent = username;

      chatContainer.innerHTML = '';

      const history = adminChats.get(username) || [];

      history.forEach(message => {
        displayMessage(message);
      });

      scrollToBottom();
    });

    userListContainer.appendChild(userItem);
  });
}

toMainPage?.addEventListener('click', () => {
  window.location.href = '/';
});

attachBtn?.addEventListener('click', () => {
  fileInput.click();
});

fileInput?.addEventListener('change', async () => {

  const files = fileInput.files;

  if (!files.length) return;

  if (isCurrentUserAdmin && !currentRecipient) {
    alert('Выберите пользователя');
    return;
  }

  const formData = new FormData();

  for (const file of files) {
    formData.append('files', file);
  }

  formData.append('recipientUsername', currentRecipient);

  try {

    const response = await fetch('/upload', {
      method: 'POST',
      body: formData
    });

    const result = await response.json();

    if (result.files) {

      result.files.forEach(file => {

        const message = {
          sender: currentUsername,
          recipient: currentRecipient,
          content: `
<a href="${file.url}" target="_blank">
    ${file.originalName}
</a>
`,
          type: 'file'
        };

        window.socket.emit('chat:file', message);
      });
    }

  } catch (error) {
    console.error(error);
    alert('Ошибка загрузки файла');
  }

  fileInput.value = '';
});
