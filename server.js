const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static(path.join(__dirname, './')));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

// Keep track of active devices and recent offline ones
let devices = {};
let history = {};

io.on('connection', (socket) => {
    // 1. Handle Device Registration
    socket.on('register-device', (data) => {
        socket.username = data.username;
        socket.isAdmin = data.isAdmin;
        socket.connectTime = Date.now();

        if (!data.isAdmin) {
            devices[socket.id] = {
                id: socket.id,
                username: data.username,
                connectedAt: socket.connectTime,
                battery: data.battery || '??%',
                charging: data.charging || false
            };
            updateAdmins();
        }
    });

    // 2. Continuous Battery Status Updates
    socket.on('update-specs', (data) => {
        if (devices[socket.id]) {
            devices[socket.id].battery = data.battery;
            devices[socket.id].charging = data.charging;
            updateAdmins();
        }
    });

    // 3. Admin Commands
    socket.on('send-sound-command', (data) => {
        // Sends target explicit details: { file, volume, offset, duration }
        io.to(data.targetId).emit('execute-sound', data);
    });

    socket.on('send-stop-command', (data) => {
        io.to(data.targetId).emit('halt-sound');
    });

    // 4. Handle Disconnect Log Tracking
    socket.on('disconnect', () => {
        if (devices[socket.id]) {
            const durationSec = Math.floor((Date.now() - socket.connectTime) / 1000);
            history[socket.username] = {
                username: socket.username,
                offlineAt: new Date().toLocaleTimeString(),
                duration: `${durationSec}s`
            };
            delete devices[socket.id];
            updateAdmins();
        }
    });
});

function updateAdmins() {
    // Broadcast active nodes and historical drops directly to admins
    io.emit('dashboard-update', {
        online: Object.values(devices),
        offline: Object.values(history)
    });
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`DSLR Core Active on ${PORT}`));const express = require('express');
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
