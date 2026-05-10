import { currentUsername, isCurrentUserAdmin } from "./authentication.js";

let currentRecipient = null;
let adminChats = new Map();

const socketUrl = window.location.origin;
window.socket = io(socketUrl, {
    transports: ['websocket', 'polling'],
    path: '/socket.io/'
});

const toMainPage = document.getElementById("to-main-page");
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
    console.log('✅ Socket connected! ID:', window.socket.id);
    if (currentUsername) {
        console.log('📤 Registering user:', currentUsername);
        window.socket.emit('user:register', {
            username: currentUsername,
            password: isCurrentUserAdmin ? 'admin' : '',
            isAdminLogin: isCurrentUserAdmin
        });
    }
});

window.socket.on('user:register:success', (data) => {
    console.log('✅ Registered as:', data.username, 'isAdmin:', data.isAdmin);

    if (!isCurrentUserAdmin) {
        // Для обычного пользователя - админ выбран по умолчанию
        currentRecipient = 'Admin';
        console.log('📌 Default recipient set to: Admin');
        companionNameSpan.textContent = 'Чат с поддержкой';
        companionNameSpan.style.color = '#e91e63';
    }
});

window.socket.on('user:register:error', (error) => {
    console.error('❌ Registration error:', error);
    alert(error);
});

window.socket.on('chat:history', (history) => {
    console.log('📜 Chat history:', history.length);
    chatContainer.innerHTML = '';
    history.forEach(message => displayMessage(message));
    scrollToBottom();
});

window.socket.on('admin:userList', (users) => {
    console.log('👥 Admin user list:', users);
    updateAdminUserList(users);
});

window.socket.on('admin:newUser', (username) => {
    console.log('🆕 New user joined:', username);
    addUserToAdminList(username);
});

window.socket.on('admin:chatHistory', (data) => {
    console.log('📜 Admin chat history for:', data.username);
    adminChats.set(data.username, data.history);
    if (currentRecipient === data.username) {
        displayChatHistory(data.history);
    }
});

window.socket.on('chat:message', (message) => {
    console.log('💬 New message from:', message.sender);

    if (isCurrentUserAdmin) {
        if (message.sender !== currentUsername) {
            const existingHistory = adminChats.get(message.sender) || [];
            existingHistory.push(message);
            adminChats.set(message.sender, existingHistory);
            highlightUserInList(message.sender);
            if (currentRecipient === message.sender) {
                displayMessage(message);
                scrollToBottom();
            } else {
                showNotification(message.sender);
            }
        } else {
            if (currentRecipient) {
                const existingHistory = adminChats.get(currentRecipient) || [];
                existingHistory.push(message);
                adminChats.set(currentRecipient, existingHistory);
                displayMessage(message);
                scrollToBottom();
            }
        }
    } else {
        displayMessage(message);
        scrollToBottom();
    }
});

window.socket.on('user:joined', (data) => {
    console.log('👋 User joined:', data.username);
});

window.socket.on('user:left', (data) => {
    console.log('👋 User left:', data.username);
    if (isCurrentUserAdmin && !data.isAdmin) {
        removeUserFromAdminList(data.username);
        adminChats.delete(data.username);
        if (currentRecipient === data.username) {
            currentRecipient = null;
            chatContainer.innerHTML = '';
            companionNameSpan.textContent = 'Выберите пользователя';
            companionNameSpan.style.color = 'rgb(105, 81, 71)';
        }
    }
});

window.socket.on('chat:error', (error) => {
    console.error('❌ Chat error:', error);
    alert(error);
});

function displayMessage(message) {
    const messageDiv = document.createElement('div');
    const isOwnMessage = message.sender === currentUsername;
    messageDiv.className = `message ${isOwnMessage ? 'message-out' : 'message-in'}`;

    if (message.type === 'text') {
        messageDiv.innerHTML = `
            <div class="message-sender">${escapeHtml(message.sender)}${message.senderIsAdmin ? ' (Админ)' : ''}</div>
            <div class="message-content">${escapeHtml(message.content)}</div>
            <div class="message-time">${formatTime(message.timestamp)}</div>
        `;
    } else if (message.type === 'file') {
        const isImage = message.fileType && message.fileType.startsWith('image/');
        messageDiv.innerHTML = `
            <div class="message-sender">${escapeHtml(message.sender)}${message.senderIsAdmin ? ' (Админ)' : ''}</div>
            <div class="message-content">
                ${isImage ?
            `<a href="${message.fileUrl}" target="_blank"><img src="${message.fileUrl}" alt="${message.fileName}" class="message-image"></a>` :
            `<a href="${message.fileUrl}" target="_blank" class="file-link">📎 ${escapeHtml(message.fileName)}</a>`
        }
            </div>
            <div class="message-time">${formatTime(message.timestamp)}</div>
        `;
    }
    chatContainer.appendChild(messageDiv);
}

function displayChatHistory(history) {
    chatContainer.innerHTML = '';
    if (history && history.length > 0) {
        history.forEach(message => displayMessage(message));
    } else {
        const emptyDiv = document.createElement('div');
        emptyDiv.className = 'message-system';
        emptyDiv.innerHTML = '<em>Нет сообщений. Напишите что-нибудь...</em>';
        chatContainer.appendChild(emptyDiv);
    }
    scrollToBottom();
}

function updateAdminUserList(users) {
    if (!userListContainer) return;
    userListContainer.innerHTML = '<h4>Пользователи онлайн:</h4>';
    if (users.length === 0) {
        userListContainer.innerHTML += '<div class="no-users">Нет пользователей онлайн</div>';
        return;
    }
    users.forEach(username => {
        const userDiv = createUserListItem(username);
        userListContainer.appendChild(userDiv);
    });
}

function createUserListItem(username) {
    const userDiv = document.createElement('div');
    userDiv.className = `user-item ${currentRecipient === username ? 'user-item-active' : ''}`;
    userDiv.setAttribute('data-username', username);
    const chatHistory = adminChats.get(username) || [];
    const unreadCount = chatHistory.filter(msg => msg.sender === username && !msg.read).length;
    userDiv.innerHTML = `
        ${escapeHtml(username)} 
        <span class="user-badge">пользователь</span>
        ${unreadCount > 0 ? `<span class="unread-badge">${unreadCount}</span>` : ''}
    `;
    userDiv.onclick = () => selectUserForAdmin(username);
    return userDiv;
}

function addUserToAdminList(username) {
    if (!userListContainer) return;
    const existingUser = userListContainer.querySelector(`[data-username="${username}"]`);
    if (existingUser) return;
    const userDiv = createUserListItem(username);
    userListContainer.appendChild(userDiv);
}

function removeUserFromAdminList(username) {
    if (!userListContainer) return;
    const userElement = userListContainer.querySelector(`[data-username="${username}"]`);
    if (userElement) userElement.remove();
}

function highlightUserInList(username) {
    if (!userListContainer) return;
    const userElement = userListContainer.querySelector(`[data-username="${username}"]`);
    if (userElement && currentRecipient !== username) {
        userElement.classList.add('user-item-highlight');
        setTimeout(() => {
            userElement.classList.remove('user-item-highlight');
        }, 2000);
    }
}

function showNotification(username) {
    const notification = document.createElement('div');
    notification.className = 'notification-toast';
    notification.innerHTML = `📨 Новое сообщение от ${escapeHtml(username)}`;
    document.body.appendChild(notification);
    setTimeout(() => {
        notification.classList.add('show');
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, 2000);
    }, 100);
}

function selectUserForAdmin(username) {
    console.log('=== selectUserForAdmin ===', username);
    if (currentRecipient === username) return;
    currentRecipient = username;
    console.log('currentRecipient set to:', currentRecipient);
    companionNameSpan.textContent = `Чат с ${username}`;
    companionNameSpan.style.color = '#e91e63';
    const cachedHistory = adminChats.get(username);
    if (cachedHistory) {
        displayChatHistory(cachedHistory);
        markMessagesAsRead(username);
    } else {
        window.socket.emit('admin:getChatHistory', username);
        chatContainer.innerHTML = '<div class="message-system"><em>Загрузка истории...</em></div>';
    }
    document.querySelectorAll('.user-item').forEach(item => {
        const itemUsername = item.getAttribute('data-username');
        if (itemUsername === username) {
            item.classList.add('user-item-active');
            const badge = item.querySelector('.unread-badge');
            if (badge) badge.remove();
            item.classList.remove('user-item-highlight');
        } else {
            item.classList.remove('user-item-active');
        }
    });
}

function markMessagesAsRead(username) {
    const history = adminChats.get(username);
    if (history) {
        history.forEach(msg => {
            if (msg.sender === username) msg.read = true;
        });
        adminChats.set(username, history);
    }
}

function sendMessage() {
    const message = messageInput.value.trim();
    if (message === '') return;

    // Для обычного пользователя, если recipient не выбран - отправляем админу
    let targetRecipient = currentRecipient;
    if (!isCurrentUserAdmin && !targetRecipient) {
        targetRecipient = 'Admin';
        console.log('No recipient, defaulting to Admin');
    }

    if (!targetRecipient) {
        alert('Нет получателя');
        return;
    }

    console.log('Sending message to:', targetRecipient);
    window.socket.emit('chat:text', {
        content: message,
        recipientUsername: targetRecipient
    });
    messageInput.value = '';
}

function sendFiles(files) {
    console.log('=== sendFiles ===');
    console.log('isCurrentUserAdmin:', isCurrentUserAdmin);
    console.log('currentRecipient:', currentRecipient);

    // Для обычного пользователя, если recipient не выбран - отправляем админу
    let targetRecipient = currentRecipient;
    if (!isCurrentUserAdmin && !targetRecipient) {
        targetRecipient = 'Admin';
        console.log('No recipient, defaulting to Admin');
    }

    if (!targetRecipient) {
        alert('Нет получателя');
        return;
    }

    for (const file of files) {
        if (file.size > 10 * 1024 * 1024) {
            alert(`Файл ${file.name} слишком большой. Максимальный размер 10MB`);
            continue;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const result = e.target.result;
            const fileData = result.split(',')[1];
            if (!fileData) {
                alert('Ошибка чтения файла');
                return;
            }
            console.log(`Sending file: ${file.name} to ${targetRecipient}`);
            window.socket.emit('chat:file', {
                fileName: file.name,
                fileData: fileData,
                fileType: file.type,
                recipientUsername: targetRecipient
            });
        };
        reader.onerror = (error) => {
            console.error('FileReader error:', error);
            alert('Ошибка при чтении файла');
        };
        reader.readAsDataURL(file);
    }
}

function escapeHtml(str) {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function formatTime(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

function scrollToBottom() {
    if (chatContainer) {
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }
}

// Event listeners
if (messageInput) {
    messageInput.addEventListener('dragover', (e) => {
        e.preventDefault();
        messageInput.style.borderColor = '#e91e63';
    });
    messageInput.addEventListener('dragleave', (e) => {
        e.preventDefault();
        messageInput.style.borderColor = '';
    });
    messageInput.addEventListener('drop', (e) => {
        e.preventDefault();
        messageInput.style.borderColor = '';
        const files = Array.from(e.dataTransfer.files);
        if (files.length > 0) sendFiles(files);
    });
    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
}

if (toMainPage) {
    toMainPage.addEventListener('click', (event) => {
        event.preventDefault();
        window.location.href = '/';
    });
}

if (attachBtn) {
    attachBtn.addEventListener('click', () => {
        fileInput.click();
    });
}

if (fileInput) {
    fileInput.addEventListener('change', (e) => {
        const files = Array.from(e.target.files);
        sendFiles(files);
        fileInput.value = '';
    });
}

if (sendBtn) {
    sendBtn.addEventListener('click', sendMessage);
}

// Debug function
window.debugChat = () => {
    console.log('=== DEBUG ===');
    console.log('currentUsername:', currentUsername);
    console.log('isCurrentUserAdmin:', isCurrentUserAdmin);
    console.log('currentRecipient:', currentRecipient);
    console.log('socket connected:', window.socket?.connected);
    console.log('adminChats:', Array.from(adminChats.keys()));
};