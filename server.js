const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const multer = require('multer');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static(path.join(__dirname, './')));

let devices = {};
let history = {};
let customSounds = [];

// Storage configuration for incoming media files
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, './'),
    filename: (req, file, cb) => cb(null, file.originalname)
});

// Accepts both standard mp3 files and raw video files (mp4, webm, etc.)
const fileFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('audio/') || file.mimetype.startsWith('video/')) {
        cb(null, true);
    } else {
        cb(new Error('Invalid file type. Only audio and video files are accepted.'), false);
    }
};

const upload = multer({ storage: storage, fileFilter: fileFilter });

// API Route to handle uploaded MP3 or video files
app.post('/upload-mp3', upload.single('audioFile'), (req, file, res) => {
    if (req.file) {
        console.log(`New media file registered: ${req.file.filename}`);
        if (!customSounds.includes(req.file.filename)) {
            customSounds.push(req.file.filename);
        }
        // Broadcast structural list data directly to current admins
        io.emit('sound-list-update', customSounds);
        res.status(200).json({ success: true, filename: req.file.filename });
    } else {
        res.status(400).json({ success: false, error: "No valid media file caught." });
    }
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

io.on('connection', (socket) => {
    // Send standard data maps to connecting admin arrays immediately
    socket.emit('sound-list-update', customSounds);

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

    socket.on('update-specs', (data) => {
        if (devices[socket.id]) {
            devices[socket.id].battery = data.battery;
            devices[socket.id].charging = data.charging;
            updateAdmins();
        }
    });

    socket.on('send-sound-command', (data) => {
        io.to(data.targetId).emit('execute-sound', data);
    });

    socket.on('send-stop-command', (data) => {
        io.to(data.targetId).emit('halt-sound');
    });

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
    io.emit('dashboard-update', {
        online: Object.values(devices),
        offline: Object.values(history)
    });
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`DSLR Core Online via Port ${PORT}`));
