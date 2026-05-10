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
const users = new Map(); // socket.id -> { username, socketId, isAdmin }
const userSockets = new Map(); // username -> socket.id
const privateChats = new Map(); // username -> array of messages
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

 socket.on('user:register', (data) => {
  const { username, password } = data;

  console.log(`Registration attempt: ${username}`);

  // Проверка пароля для админа
  if (username === ADMIN_USERNAME && password !== ADMIN_PASSWORD) {
   socket.emit('user:register:error', 'Неверный пароль администратора');
   return;
  }

  // ЕСЛИ ПОЛЬЗОВАТЕЛЬ УЖЕ ЕСТЬ - ОБНОВЛЯЕМ ЕГО СОКЕТ
  const existingSocketId = userSockets.get(username);
  if (existingSocketId) {
   console.log(`User ${username} already exists, updating socket (old: ${existingSocketId}, new: ${socket.id})`);
   // Удаляем старую запись
   users.delete(existingSocketId);
   // Создаем новую
   const isAdminUser = (username === ADMIN_USERNAME);
   users.set(socket.id, { username, socketId: socket.id, isAdmin: isAdminUser });
   userSockets.set(username, socket.id);

   // Отправляем подтверждение
   socket.emit('user:register:success', { username, isAdmin: isAdminUser });

   // Отправляем историю чата при переподключении
   if (isAdminUser) {
    const userList = Array.from(userSockets.keys()).filter(u => u !== ADMIN_USERNAME);
    socket.emit('admin:userList', userList);

    // Отправляем все истории чатов админу
    for (const user of userList) {
     const chatHistory = getPrivateChat(user);
     if (chatHistory.length > 0) {
      socket.emit('admin:chatHistory', { username: user, history: chatHistory });
     }
    }
   } else {
    const chatHistory = getPrivateChat(username);
    socket.emit('chat:history', chatHistory);

    // Уведомляем админа об обновлении
    if (userSockets.has(ADMIN_USERNAME)) {
     const adminSocketId = userSockets.get(ADMIN_USERNAME);
     const userList = Array.from(userSockets.keys()).filter(u => u !== ADMIN_USERNAME);
     io.to(adminSocketId).emit('admin:userList', userList);
    }
   }
   return;
  }

  // НОВАЯ РЕГИСТРАЦИЯ
  const isAdminUser = (username === ADMIN_USERNAME);
  users.set(socket.id, { username, socketId: socket.id, isAdmin: isAdminUser });
  userSockets.set(username, socket.id);

  console.log(`New user registered: ${username} (isAdmin: ${isAdminUser})`);
  console.log(`Total users: ${userSockets.size}`);

  socket.emit('user:register:success', { username, isAdmin: isAdminUser });

  if (isAdminUser) {
   const userList = Array.from(userSockets.keys()).filter(u => u !== ADMIN_USERNAME);
   socket.emit('admin:userList', userList);
  } else {
   const chatHistory = getPrivateChat(username);
   socket.emit('chat:history', chatHistory);

   if (userSockets.has(ADMIN_USERNAME)) {
    const adminSocketId = userSockets.get(ADMIN_USERNAME);
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
   // Админ пишет пользователю
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

   // Отправляем получателю, если он онлайн
   if (recipientSocketId) {
    io.to(recipientSocketId).emit('chat:message', message);
    console.log(`Message sent to ${recipientUsername}`);
   } else {
    console.log(`User ${recipientUsername} is offline, message saved`);
   }
   // Отправляем админу его же сообщение
   socket.emit('chat:message', message);
  } else {
   // Пользователь пишет админу
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
  const user = users.get(socket.id);
  if (!user) {
   socket.emit('chat:error', 'Вы не авторизованы');
   return;
  }

  const { fileName, fileData, fileType, recipientUsername } = data;

  console.log(`File from ${user.username}: ${fileName}, size: ${fileData?.length || 0}`);

  // Проверяем наличие fileData
  if (!fileData) {
   socket.emit('chat:error', 'Ошибка: нет данных файла');
   return;
  }

  try {
   // Сохраняем файл
   const fileExt = path.extname(fileName);
   const uniqueFileName = `${Date.now()}-${Math.random().toString(36).substr(2, 8)}${fileExt}`;
   const uploadDir = path.join(__dirname, 'public', 'uploads');

   if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
   }

   const filePath = path.join(uploadDir, uniqueFileName);
   const buffer = Buffer.from(fileData, 'base64');
   fs.writeFileSync(filePath, buffer);
   const fileUrl = `/uploads/${uniqueFileName}`;

   console.log(`File saved: ${fileUrl}`);

   if (user.isAdmin) {
    // Админ отправляет файл пользователю
    if (!recipientUsername) {
     socket.emit('chat:error', 'Выберите пользователя');
     return;
    }

    const recipientSocketId = userSockets.get(recipientUsername);
    const message = {
     id: Date.now() + Math.random().toString(36).substr(2, 6),
     type: 'file',
     sender: user.username,
     senderIsAdmin: true,
     fileName: fileName,
     fileUrl: fileUrl,
     fileType: fileType,
     timestamp: new Date().toISOString(),
     read: false
    };

    addToPrivateChat(recipientUsername, message);

    if (recipientSocketId) {
     io.to(recipientSocketId).emit('chat:message', message);
    }
    socket.emit('chat:message', message);
   } else {
    // Пользователь отправляет файл админу
    const adminSocketId = userSockets.get(ADMIN_USERNAME);
    const message = {
     id: Date.now() + Math.random().toString(36).substr(2, 6),
     type: 'file',
     sender: user.username,
     senderIsAdmin: false,
     fileName: fileName,
     fileUrl: fileUrl,
     fileType: fileType,
     timestamp: new Date().toISOString(),
     read: false
    };

    addToPrivateChat(user.username, message);

    if (adminSocketId) {
     io.to(adminSocketId).emit('chat:message', message);
     io.to(adminSocketId).emit('admin:newMessage', user.username);
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
  const user = users.get(socket.id);
  if (user) {
   const currentSocketId = userSockets.get(user.username);
   if (currentSocketId === socket.id) {
    console.log(`User disconnected: ${user.username}`);
    users.delete(socket.id);
    userSockets.delete(user.username);

    if (userSockets.has(ADMIN_USERNAME)) {
     const adminSocketId = userSockets.get(ADMIN_USERNAME);
     const userList = Array.from(userSockets.keys()).filter(u => u !== ADMIN_USERNAME);
     io.to(adminSocketId).emit('admin:userList', userList);
    }
   }
  }
 });
});