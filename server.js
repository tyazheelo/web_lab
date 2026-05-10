import { app } from './rest.js';
import { Server } from 'socket.io';
import http from 'http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ADMIN_USERNAME = 'Admin';
const ADMIN_PASSWORD = 'admin';

const httpServer = http.createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  },
  path: '/socket.io/',
  transports: ['polling', 'websocket']
});

const PORT = process.env.PORT || 3000;

app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));

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

 socket.on('user:register', (data) => {
  const { username, password } = data;

  if (username === ADMIN_USERNAME && password !== ADMIN_PASSWORD) {
   socket.emit('user:register:error', 'Неверный пароль администратора');
   return;
  }

  const existingSocketId = userSockets.get(username);

  if (existingSocketId && existingSocketId !== socket.id) {
   users.delete(existingSocketId);
  }

  const isAdminUser = username === ADMIN_USERNAME;

  users.set(socket.id, {
   username,
   socketId: socket.id,
   isAdmin: isAdminUser
  });

  userSockets.set(username, socket.id);

  socket.emit('user:register:success', {
   username,
   isAdmin: isAdminUser
  });

  if (isAdminUser) {
   const userList = Array.from(userSockets.keys()).filter(
       user => user !== ADMIN_USERNAME
   );

   socket.emit('admin:userList', userList);

   for (const user of userList) {
    const chatHistory = getPrivateChat(user);

    if (chatHistory.length > 0) {
     socket.emit('admin:chatHistory', {
      username: user,
      history: chatHistory
     });
    }
   }
  } else {
   const chatHistory = getPrivateChat(username);
   socket.emit('chat:history', chatHistory);

   const adminSocketId = userSockets.get(ADMIN_USERNAME);

   if (adminSocketId) {
    const userList = Array.from(userSockets.keys()).filter(
        user => user !== ADMIN_USERNAME
    );

    io.to(adminSocketId).emit('admin:userList', userList);
    io.to(adminSocketId).emit('admin:newUser', username);
   }
  }
 });

 socket.on('chat:text', (data) => {
  const user = users.get(socket.id);

  if (!user) {
   socket.emit('chat:error', 'Вы не авторизованы');
   return;
  }

  const { content, recipientUsername } = data;

  if (user.isAdmin) {
   if (!recipientUsername) {
    socket.emit('chat:error', 'Выберите пользователя');
    return;
   }

   const recipientSocketId = userSockets.get(recipientUsername);

   const message = {
    sender: user.username,
    recipient: recipientUsername,
    content,
    createdAt: new Date().toISOString(),
    type: 'text'
   };

   addToPrivateChat(recipientUsername, message);

   socket.emit('chat:message', message);

   if (recipientSocketId) {
    io.to(recipientSocketId).emit('chat:message', message);
   }
  } else {
   const adminSocketId = userSockets.get(ADMIN_USERNAME);

   const message = {
    sender: user.username,
    recipient: ADMIN_USERNAME,
    content,
    createdAt: new Date().toISOString(),
    type: 'text'
   };

   addToPrivateChat(user.username, message);

   socket.emit('chat:message', message);

   if (adminSocketId) {
    io.to(adminSocketId).emit('chat:message', message);
   }
  }
 });

 socket.on('disconnect', () => {
  const user = users.get(socket.id);

  if (user) {
   userSockets.delete(user.username);
   users.delete(socket.id);

   console.log(`${user.username} disconnected`);

   const adminSocketId = userSockets.get(ADMIN_USERNAME);

   if (adminSocketId && !user.isAdmin) {
    const userList = Array.from(userSockets.keys()).filter(
        u => u !== ADMIN_USERNAME
    );

    io.to(adminSocketId).emit('admin:userList', userList);
   }
  }
 });
});
