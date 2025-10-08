const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const fs = require('fs');
const path = require('path');
const Papa = require('papaparse');

const app = express();
const server = http.createServer(app);

// --- ✨ CORS CONFIGURATION ---
const io = new Server(server, {
  cors: {
    origin: ["https://loteria.lachinita.com/", "https://host-loteria.lachinita.com/", "http://localhost:3000"],
    methods: ["GET", "POST"]
  }
});

const PORT = 3000;

// Serve static files from the "public" directory
app.use(express.static('public'));

let gameState = {
    deck: [],
    drawnCards: [],
    players: {}, // Using object to store players by ID
    boards: [],
    gameInProgress: false,
};

// --- LOGGING SETUP ---
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir);
}
const logFilePath = path.join(logsDir, `game_session_${new Date().toISOString().replace(/:/g, '-')}.csv`);
const logHeaders = ['Timestamp', 'PlayerName', 'PhoneNumber', 'BoardNumber', 'Won'];
fs.writeFileSync(logFilePath, Papa.unparse([logHeaders]) + '\r\n');


function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

function createNewGame() {
    console.log("Creating a new game...");
    const allCards = JSON.parse(fs.readFileSync(path.join(__dirname, 'public', 'boards.json'), 'utf8'));
    const allCardNames = [...new Set(allCards.flatMap(board => board.cards.map(card => card.id)))];
    
    gameState = {
        deck: shuffle([...allCardNames]),
        drawnCards: [],
        players: {},
        boards: Array.from({ length: 32 }, (_, i) => ({ id: i + 1, assigned: false })),
        gameInProgress: true,
    };

    // Clear previous logs and reset file
    fs.writeFileSync(logFilePath, Papa.unparse([logHeaders]) + '\r\n');
    console.log("New game created and log file reset.");
}

io.on('connection', (socket) => {
    console.log(`A user connected: ${socket.id}`);

    // --- HOST EVENTS ---
    socket.on('host:createGame', () => {
        createNewGame();
        socket.join('host'); // The host joins a special room
        io.emit('game:state', { gameInProgress: gameState.gameInProgress, boards: gameState.boards });
        console.log("Host created a new game.");
    });

    socket.on('host:drawCard', () => {
        if (gameState.deck.length > 0) {
            const card = gameState.deck.pop();
            gameState.drawnCards.push(card);
            io.emit('game:cardDrawn', card);
            console.log(`Card drawn: ${card}`);
        }
    });

    // --- PLAYER EVENTS ---
    socket.on('player:join', (data) => {
        if (!gameState.gameInProgress) {
            socket.emit('player:error', 'No hay juegos activos en el momento.');
            return;
        }
        
        const boardId = parseInt(data.boardId, 10);
        const board = gameState.boards.find(b => b.id === boardId);

        if (board && !board.assigned) {
            board.assigned = true;
            gameState.players[socket.id] = {
                id: socket.id,
                name: data.name,
                phone: data.phone,
                boardId: boardId
            };
            
            const logEntry = {
                Timestamp: new Date().toISOString(),
                PlayerName: data.name,
                PhoneNumber: data.phone,
                BoardNumber: boardId,
                Won: 'no'
            };
            fs.appendFileSync(logFilePath, Papa.unparse([logEntry], { header: false }) + '\r\n');

            io.emit('game:state', { gameInProgress: gameState.gameInProgress, boards: gameState.boards });
            io.to('host').emit('game:playerJoined', gameState.players[socket.id]);
            socket.emit('player:joined', { boardId: boardId });
            console.log(`Player ${data.name} joined with board #${boardId}`);
        } else {
            socket.emit('player:error', 'Este tablero no se encuentra disponible.');
        }
    });

    socket.on('player:loteria', () => {
        const player = gameState.players[socket.id];
        if (player) {
            console.log(`Player ${player.name} called Loteria!`);
            io.to('host').emit('game:playerWon', player);

            // Update CSV Log for winning player
            const csvData = fs.readFileSync(logFilePath, 'utf8');
            const parsedData = Papa.parse(csvData, { header: true }).data;
            let updated = false;
            const updatedData = parsedData.map(row => {
                if (row.PlayerName === player.name && row.BoardNumber == player.boardId) {
                    row.Won = 'yes';
                    updated = true;
                }
                return row;
            });

            if(updated) {
                 fs.writeFileSync(logFilePath, Papa.unparse(updatedData) + '\r\n');
                 console.log(`Updated log for winner: ${player.name}`);
            }
        }
    });
    
    // --- GENERAL EVENTS ---
    socket.on('disconnect', () => {
        const player = gameState.players[socket.id];
        if (player) {
            const board = gameState.boards.find(b => b.id === player.boardId);
            if (board) {
                board.assigned = false; // Free up the board
            }
            delete gameState.players[socket.id];
            io.emit('game:state', { gameInProgress: gameState.gameInProgress, boards: gameState.boards });
            io.to('host').emit('game:playerLeft', player.id);
            console.log(`Player ${player.name} disconnected. Board #${player.boardId} is now free.`);
        } else {
            console.log(`A user disconnected: ${socket.id}`);
        }
    });

    // Send initial state to newly connected client
    socket.emit('game:state', { gameInProgress: gameState.gameInProgress, boards: gameState.boards });
});

server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

