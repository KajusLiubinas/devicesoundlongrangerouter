const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// 1. Serve all frontend static files (HTML, CSS, JS) from the root folder
app.use(express.static(path.join(__dirname, './')));

// 2. Route to serve your main index.html file
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// 3. Socket.io Audio Streaming Connection
io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // Audio data handling
    socket.on('audio-stream', (data) => {
        // Broadcast the incoming audio data to everyone else connected
        socket.broadcast.emit('audio-stream', data);
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});

// 4. Start the server on Render's required port, or 3000 locally
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running smoothly on port ${PORT}`);
});
