const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3000;

// Serve basic info page
app.get('/', (req, res) => {
  res.send('<h1>Socket.IO Server Running</h1><p>Use Socket.IO client to connect</p>');
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('🔌 Client Connected:', socket.id);
  
  // Event: Client disconnected
  socket.on('disconnect', () => {
    console.log('❌ Client Disconnected:', socket.id);
  });
  
  // Event: LED control
  socket.on('control:led', (data) => {
    console.log('📨 LED Control from', socket.id);
    console.log('   Data:', data);
    // Broadcast to all other clients
    socket.broadcast.emit('control:led', data);
  });
  
  // Event: Status update
  socket.on('status:update', (data) => {
    console.log('📊 Status Update from', socket.id);
    console.log('   Data:', data);
    // Broadcast to all other clients
    socket.broadcast.emit('status:update', data);
  });
  
  // Event: Join room
  socket.on('join:room', (room) => {
    socket.join(room);
    console.log('📬 Client', socket.id, 'joined room:', room);
    socket.to(room).emit('user:joined', { id: socket.id });
  });
  
  // Event: Send message to room
  socket.on('room:message', (data) => {
    const { room, message } = data;
    console.log('💬 Message to room', room, 'from', socket.id);
    socket.to(room).emit('room:message', { from: socket.id, message });
  });
  
  // Generic message handler
  socket.on('message', (data) => {
    console.log('📨 Message from', socket.id, ':', data);
    socket.broadcast.emit('message', data);
  });
});

http.listen(PORT, '0.0.0.0', () => {
  console.log('✅ Socket.IO Server running on port', PORT);
  console.log('📡 Connect to: http://localhost:' + PORT);
});
