import { app } from './rest.js';
import { Server } from 'socket.io';
import http from 'http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ===== КОНСТАНТЫ =====
const ADMIN_USERNAME = 'Admin';
const ADMIN_PASSWORD = 'admin';

const httpServer = http.createServer(app);
const io = new Server(httpServer, {
 cors: {
  origin: process.env.RENDER_EXTERNAL_URL || "http://localhost:3000",
  methods: ["GET", "POST"],
  credentials: true
 },
 path: '/socket.io/',
 transports: ['websocket', 'polling']
});

const PORT = process.env.PORT || 3000;

// Хранилище
const users = new Map();
const userSockets = new Map();
const privateChats = new Map();
const MAX_HISTORY = 50;

function getPrivateChat(username) {
 if (!privateChats.has(username)) {
  privateChats.set(username, []);
 }
 return privateChats.get(username);
}

function addToPrivateChat(username, message) {
 const chat = getPrivateChat(username);
 chat.push(message);
 if (chat.length > MAX_HISTORY) {
  chat.shift();
 }
}

httpServer.listen(PORT, () => {
 console.log(`Server running on port ${PORT}`);
 console.log(`Admin credentials: ${ADMIN_USERNAME} / ${ADMIN_PASSWORD}`);
});

io.on('connection', (socket) => {
 console.log('Client connected:', socket.id);
 console.log('Total connections:', io.engine.clientsCount);

 socket.on('user:register', (data) => {
  const { username, password } = data;

  console.log(`Registration attempt: ${username}`);

  // Проверка пароля для админа
  if (username === ADMIN_USERNAME && password !== ADMIN_PASSWORD) {
   socket.emit('user:register:error', 'Неверный пароль администратора');
   return;
  }

  // Если пользователь уже есть с другим сокетом - удаляем старый
  const existingSocketId = userSockets.get(username);
  if (existingSocketId && existingSocketId !== socket.id) {
   console.log(`Removing old socket for ${username}: ${existingSocketId}`);
   users.delete(existingSocketId);
  }

  // Сохраняем пользователя
  const isAdminUser = (username === ADMIN_USERNAME);
  users.set(socket.id, { username, socketId: socket.id, isAdmin: isAdminUser });
  userSockets.set(username, socket.id);

  console.log(`User registered: ${username} (isAdmin: ${isAdminUser})`);
  console.log(`Current users online: ${Array.from(userSockets.keys()).join(', ')}`);

  socket.emit('user:register:success', { username, isAdmin: isAdminUser });

  if (isAdminUser) {
   const userList = Array.from(userSockets.keys()).filter(u => u !== ADMIN_USERNAME);
   console.log(`Sending admin user list: ${userList}`);
   socket.emit('admin:userList', userList);

   // Отправляем все истории чатов
   for (const user of userList) {
    const chatHistory = getPrivateChat(user);
    if (chatHistory.length > 0) {
     socket.emit('admin:chatHistory', { username: user, history: chatHistory });
    }
   }
  } else {
   const chatHistory = getPrivateChat(username);
   console.log(`Sending history to ${username}: ${chatHistory.length} messages`);
   socket.emit('chat:history', chatHistory);

   // Уведомляем админа о новом пользователе
   const adminSocketId = userSockets.get(ADMIN_USERNAME);
   if (adminSocketId) {
    const userList = Array.from(userSockets.keys()).filter(u => u !== ADMIN_USERNAME);
    io.to(adminSocketId).emit('admin:userList', userList);
    io.to(adminSocketId).emit('admin:newUser', username);
   }
  }
 });

 // Обработка текстовых сообщений
 socket.on('chat:text', (data) => {
  const user = users.get(socket.id);
  if (!user) {
   socket.emit('chat:error', 'Вы не авторизованы');
   return;
  }

  const { content, recipientUsername } = data;

  console.log(`Message from ${user.username} to ${recipientUsername || 'admin'}: ${content}`);

  if (user.isAdmin) {
   if (!recipientUsername) {
    socket.emit('chat:error', 'Выберите пользователя');
    return;
   }

   const recipientSocketId = userSockets.get(recipientUsername);
   const message = {
    id: Date.now() + Math.random().toString(36).substr(2, 6),
    type: 'text',
    sender: user.username,
    senderIsAdmin: true,
    content: content,
    timestamp: new Date().toISOString(),
    read: false
   };

   addToPrivateChat(recipientUsername, message);

   if (recipientSocketId) {
    io.to(recipientSocketId).emit('chat:message', message);
    console.log(`Message sent to ${recipientUsername}`);
   } else {
    console.log(`User ${recipientUsername} is offline, message saved`);
    socket.emit('chat:error', `Пользователь ${recipientUsername} не в сети`);
   }
   socket.emit('chat:message', message);
  } else {
   const adminSocketId = userSockets.get(ADMIN_USERNAME);
   const message = {
    id: Date.now() + Math.random().toString(36).substr(2, 6),
    type: 'text',
    sender: user.username,
    senderIsAdmin: false,
    content: content,
    timestamp: new Date().toISOString(),
    read: false
   };

   addToPrivateChat(user.username, message);

   if (adminSocketId) {
    io.to(adminSocketId).emit('chat:message', message);
    io.to(adminSocketId).emit('admin:newMessage', user.username);
    console.log(`Message from ${user.username} sent to admin`);
   } else {
    socket.emit('chat:error', 'Администратор не в сети');
    return;
   }
   socket.emit('chat:message', message);
  }
 });

 // Обработка файлов - ИСПРАВЛЕНА
 socket.on('chat:file', (data) => {
  console.log('=== FILE RECEIVED ===');
  console.log('From socket:', socket.id);

  const user = users.get(socket.id);
  if (!user) {
   console.log('User not found for socket:', socket.id);
   socket.emit('chat:error', 'Вы не авторизованы');
   return;
  }

  const { fileName, fileData, fileType, recipientUsername } = data;

  console.log(`User: ${user.username}, isAdmin: ${user.isAdmin}`);
  console.log(`File: ${fileName}, recipient: ${recipientUsername}`);

  if (!fileData) {
   socket.emit('chat:error', 'Ошибка: нет данных файла');
   return;
  }

  try {
   // Создаем директорию для загрузок
   const uploadDir = path.join(__dirname, 'public', 'uploads');
   if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
   }

   // Сохраняем файл
   const fileExt = path.extname(fileName);
   const uniqueFileName = `${Date.now()}-${Math.random().toString(36).substr(2, 8)}${fileExt}`;
   const filePath = path.join(uploadDir, uniqueFileName);
   const buffer = Buffer.from(fileData, 'base64');
   fs.writeFileSync(filePath, buffer);
   const fileUrl = `/uploads/${uniqueFileName}`;

   console.log(`File saved: ${fileUrl}`);

   // Создаем сообщение
   const message = {
    id: Date.now() + Math.random().toString(36).substr(2, 6),
    type: 'file',
    sender: user.username,
    senderIsAdmin: user.isAdmin,
    fileName: fileName,
    fileUrl: fileUrl,
    fileType: fileType,
    timestamp: new Date().toISOString(),
    read: false
   };

   if (user.isAdmin) {
    // Админ отправляет файл пользователю
    if (!recipientUsername) {
     socket.emit('chat:error', 'Выберите пользователя');
     return;
    }

    const recipientSocketId = userSockets.get(recipientUsername);
    console.log(`Recipient ${recipientUsername} socket: ${recipientSocketId}`);

    addToPrivateChat(recipientUsername, message);

    if (recipientSocketId) {
     io.to(recipientSocketId).emit('chat:message', message);
     console.log(`File sent to ${recipientUsername}`);
    } else {
     console.log(`User ${recipientUsername} is offline, file saved for later`);
     socket.emit('chat:error', `Пользователь ${recipientUsername} не в сети, файл сохранен`);
    }
    socket.emit('chat:message', message);
   } else {
    // Пользователь отправляет файл админу
    const adminSocketId = userSockets.get(ADMIN_USERNAME);
    console.log(`Admin socket: ${adminSocketId}`);

    addToPrivateChat(user.username, message);

    if (adminSocketId) {
     io.to(adminSocketId).emit('chat:message', message);
     io.to(adminSocketId).emit('admin:newMessage', user.username);
     console.log(`File from ${user.username} sent to admin`);
    } else {
     socket.emit('chat:error', 'Администратор не в сети');
     return;
    }
    socket.emit('chat:message', message);
   }
  } catch (error) {
   console.error('File error:', error);
   socket.emit('chat:error', 'Ошибка при отправке файла: ' + error.message);
  }
 });

 socket.on('admin:getChatHistory', (username) => {
  const user = users.get(socket.id);
  if (!user || !user.isAdmin) return;

  const chatHistory = getPrivateChat(username);
  console.log(`Sending history for ${username}: ${chatHistory.length} messages`);
  socket.emit('admin:chatHistory', { username, history: chatHistory });
 });

 socket.on('disconnect', () => {
  console.log('Client disconnected:', socket.id);
  const user = users.get(socket.id);
  if (user) {
   // Проверяем, что этот сокет все еще актуален
   const currentSocketId = userSockets.get(user.username);
   if (currentSocketId === socket.id) {
    console.log(`Removing user: ${user.username}`);
    users.delete(socket.id);
    userSockets.delete(user.username);

    // Обновляем список у админа
    const adminSocketId = userSockets.get(ADMIN_USERNAME);
    if (adminSocketId) {
     const userList = Array.from(userSockets.keys()).filter(u => u !== ADMIN_USERNAME);
     io.to(adminSocketId).emit('admin:userList', userList);
    }
   } else {
    console.log(`User ${user.username} has new socket, not removing`);
   }
  }
 });
});