import { app } from './rest.js';
import { Server } from 'socket.io';
import http from 'http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ===== КОНСТАНТЫ ДОЛЖНЫ БЫТЬ ОБЪЯВЛЕНЫ В НАЧАЛЕ =====
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

// Хранилище пользователей
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

// ===== ЗАПУСК СЕРВЕРА ПОСЛЕ ВСЕХ ОБЪЯВЛЕНИЙ =====
httpServer.listen(PORT, () => {
 console.log(`Server running on port ${PORT}`);
 console.log(`Admin credentials: ${ADMIN_USERNAME} / ${ADMIN_PASSWORD}`);
});

io.on('connection', (socket) => {
 console.log('Client connected:', socket.id);

 socket.on('user:register', (data) => {
  const { username, password, isAdminLogin } = data;

  console.log(`Registration attempt: ${username}, isAdminLogin: ${isAdminLogin}`);

  if (username === ADMIN_USERNAME) {
   if (password !== ADMIN_PASSWORD) {
    socket.emit('user:register:error', 'Неверный пароль администратора');
    return;
   }
   if (userSockets.has(username)) {
    socket.emit('user:register:error', 'Администратор уже авторизован');
    return;
   }
  } else {
   if (userSockets.has(username)) {
    socket.emit('user:register:error', 'Имя пользователя уже занято');
    return;
   }
  }

  const isAdminUser = (username === ADMIN_USERNAME);
  users.set(socket.id, { username, socketId: socket.id, isAdmin: isAdminUser });
  userSockets.set(username, socket.id);

  console.log(`User registered: ${username} (isAdmin: ${isAdminUser})`);
  console.log(`Total users online: ${userSockets.size}`);

  socket.emit('user:register:success', {
   username,
   isAdmin: isAdminUser
  });

  if (isAdminUser) {
   const userList = Array.from(userSockets.keys()).filter(u => u !== ADMIN_USERNAME);
   console.log(`Admin user list: ${userList}`);
   socket.emit('admin:userList', userList);
  } else {
   const chatHistory = getPrivateChat(username);
   console.log(`User ${username} history: ${chatHistory.length} messages`);
   socket.emit('chat:history', chatHistory);

   if (userSockets.has(ADMIN_USERNAME)) {
    const adminSocketId = userSockets.get(ADMIN_USERNAME);
    const userList = Array.from(userSockets.keys()).filter(u => u !== ADMIN_USERNAME);
    io.to(adminSocketId).emit('admin:userList', userList);
    io.to(adminSocketId).emit('admin:newUser', username);
   }
  }
 });

 // Остальной код socket обработчиков...
 socket.on('chat:text', (data) => {
  const user = users.get(socket.id);
  if (!user) {
   socket.emit('chat:error', 'Вы не авторизованы');
   return;
  }

  const { content, recipientUsername } = data;

  if (user.isAdmin) {
   if (!recipientUsername) {
    socket.emit('chat:error', 'Выберите пользователя для ответа');
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
   } else {
    socket.emit('chat:error', 'Администратор не в сети');
    return;
   }
   socket.emit('chat:message', message);
  }
 });

 socket.on('chat:file', (data) => {
  const user = users.get(socket.id);
  if (!user) {
   socket.emit('chat:error', 'Вы не авторизованы');
   return;
  }

  const { fileName, fileData, fileType, recipientUsername } = data;

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

  if (user.isAdmin) {
   if (!recipientUsername) {
    socket.emit('chat:error', 'Выберите пользователя для отправки файла');
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
 });

 socket.on('admin:getChatHistory', (username) => {
  const user = users.get(socket.id);
  if (!user || !user.isAdmin) return;

  const chatHistory = getPrivateChat(username);
  socket.emit('admin:chatHistory', { username, history: chatHistory });
 });

 socket.on('disconnect', () => {
  const user = users.get(socket.id);
  if (user) {
   console.log(`User disconnected: ${user.username}`);
   users.delete(socket.id);
   userSockets.delete(user.username);

   if (!user.isAdmin && userSockets.has(ADMIN_USERNAME)) {
    const adminSocketId = userSockets.get(ADMIN_USERNAME);
    const userList = Array.from(userSockets.keys()).filter(u => u !== ADMIN_USERNAME);
    io.to(adminSocketId).emit('admin:userList', userList);
   }
  }
 });
});