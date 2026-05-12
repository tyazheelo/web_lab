import { getCurrentUsername, isAdmin } from './authentication.js';

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

if (getCurrentUsername()) {
  currentUserNameSpan.textContent = getCurrentUsername();

  if (isAdmin()) {
    currentUserNameSpan.style.color = '#e91e63';
  }
}

window.socket.on('connect', () => {
  console.log('Socket connected:', window.socket.id);

  if (getCurrentUsername()) {
    window.socket.emit('user:register', {
      username: getCurrentUsername(),
      password: isAdmin() ? 'admin' : ''
    });
  }
});

window.socket.on('user:register:success', (data) => {
  console.log('Registered:', data.username);

  if (!isAdmin()) {
    currentRecipient = 'Admin';
    companionNameSpan.textContent = 'Admin';
  }
});

window.socket.on('user:register:error', (error) => {
  alert(error);
});

window.socket.on('chat:history', (history) => {
  if (isAdmin()) return;

  chatContainer.innerHTML = '';

  history.forEach(message => {
    displayMessage(message);
  });

  scrollToBottom();
});

window.socket.on('chat:message', (message) => {

  if (isAdmin()) {

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

window.socket.on('admin:userList', (users) => {
  if (!isAdmin()) return;
  updateAdminUserList(users);
});

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

  if (isAdmin() && !currentRecipient) {
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

  if (message.sender === getCurrentUsername()) {
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

  if (!isAdmin()) return;

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
  console.log('Attach button clicked - Admin:', isAdmin(), 'Recipient:', currentRecipient);
  if (isAdmin() && !currentRecipient) {
    console.warn('Admin tried to attach file without selecting recipient');
    alert('Выберите пользователя из списка слева');
    return;
  }
  fileInput.click();
});

fileInput?.addEventListener('change', async () => {

  const files = fileInput.files;

  if (!files.length) return;

  console.log('Files selected:', files.length, 'Admin:', isAdmin(), 'Recipient:', currentRecipient);

  // Проверка для админа
  if (isAdmin() && !currentRecipient) {
    alert('Выберите пользователя');
    fileInput.value = '';
    return;
  }

  // Проверка для обычного пользователя
  if (!isAdmin() && !currentRecipient) {
    alert('Ошибка: нет подключения к чату. Перезагрузите страницу');
    fileInput.value = '';
    return;
  }

  const formData = new FormData();

  for (const file of files) {
    console.log('Adding file:', file.name, file.size);
    formData.append('files', file);
  }

  formData.append('recipientUsername', currentRecipient);

  try {
    console.log('Uploading files to /upload...');
    const response = await fetch('/upload', {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      throw new Error(`Upload failed with status ${response.status}`);
    }

    const result = await response.json();
    console.log('Upload response:', result);

    if (result.files) {

      result.files.forEach(file => {
        console.log('Emitting chat:file for:', file.originalName);

        const message = {
          sender: getCurrentUsername(),
          recipientUsername: currentRecipient,
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
    console.error('Error uploading files:', error);
    alert('Ошибка загрузки файла: ' + error.message);
  }

  fileInput.value = '';
});
