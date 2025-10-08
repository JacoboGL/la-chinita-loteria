const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const path = require('path');
const fs = require('fs'); // ✨ ADDED: Node's File System module
const Papa = require('papaparse');

const app = express();
const server = http.createServer(app);

// --- CORS Configuration ---
const io = new Server(server, {
  cors: {
    origin: ["https://play.yourdomain.com", "https://host.yourdomain.com", "http://localhost:3000"],
    methods: ["GET", "POST"]
  }
});

app.use(express.static(path.join(__dirname, 'public')));

// --- ✨ NEW: Load Board Data at Startup ---
let boardsData = [];
try {
    const jsonPath = path.join(__dirname, 'public', 'boards.json');
    const jsonData = fs.readFileSync(jsonPath, 'utf8');
    boardsData = JSON.parse(jsonData);
    console.log(`Successfully loaded ${boardsData.length} boards from boards.json`);
} catch (error) {
    console.error("FATAL ERROR: Could not read or parse boards.json!", error);
    process.exit(1); // Exit if the board data can't be loaded
}

// --- Game State ---
let gameState = {
    gameInProgress: false,
    deck: [],
    drawnCards: [],
    // ✨ UPDATED: Boards are now created dynamically from your JSON file
    boards: boardsData.map(board => ({
        id: board.boardNumber,
        assigned: false,
        assignedTo: null
    })),
    players: {},
    playerLog: [] // For CSV export
};

function startNewGame() {
    console.log('Starting a new game...');
    
    // Reset game state
    gameState.gameInProgress = true;
    gameState.drawnCards = [];
    gameState.players = {};
    gameState.playerLog = [];

    // Reset board assignments
    gameState.boards.forEach(board => {
        board.assigned = false;
        board.assignedTo = null;
    });
    
    // Create and shuffle the deck (card IDs are filenames)
    gameState.deck = Array.from({ length: 32 }, (_, i) => `${i + 1}.webp`);
    for (let i = gameState.deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [gameState.deck[i], gameState.deck[j]] = [gameState.deck[j], gameState.deck[i]];
    }

    // Write headers for the new log file
    const logDir = path.join(__dirname, 'logs');
    if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir);
    }
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    gameState.logFilePath = path.join(logDir, `game_log_${timestamp}.csv`);
    const csvHeaders = Papa.unparse([{ name: 'Nombre', phone: 'Numero de Telefono', boardId: 'Tablero #', won: 'Gano' }]);
    fs.writeFileSync(gameState.logFilePath, csvHeaders + '\r\n');

    io.emit('game:started');
    console.log('New game started and announced to clients.');
}

io.on('connection', (socket) => {
    console.log(`A user connected: ${socket.id}`);
    
    socket.emit('game:state', gameState);

    socket.on('host:startGame', () => {
        startNewGame();
        io.emit('game:state', gameState); // Send updated state to all
    });

    socket.on('host:drawCard', () => {
        if (!gameState.gameInProgress || gameState.deck.length === 0) return;
        
        const card = gameState.deck.pop();
        gameState.drawnCards.push(card);
        
        io.emit('game:cardDrawn', card);
        console.log(`Card drawn: ${card}`);
    });

    socket.on('player:join', ({ name, phone, boardId }) => {
        const board = gameState.boards.find(b => b.id == boardId);
        if (board && !board.assigned) {
            board.assigned = true;
            board.assignedTo = socket.id;
            gameState.players[socket.id] = { name, phone, boardId };

            const playerData = { name, phone, boardId, won: 'No' };
            gameState.playerLog.push(playerData);
            const csvRow = Papa.unparse([playerData], { header: false });
            fs.appendFileSync(gameState.logFilePath, csvRow + '\r\n');
            
            // ✨ UPDATED: Send the specific board data to the player
            const fullBoardData = boardsData.find(b => b.boardNumber == boardId);
            socket.emit('player:joined', { boardId, boardData: fullBoardData });

            io.emit('host:playerJoined', { name, boardId });
        } else {
            socket.emit('player:error', 'El tablero ya está ocupado o no es válido.');
        }
    });

    socket.on('player:loteria', () => {
        const player = gameState.players[socket.id];
        if (player) {
            console.log(`Player ${player.name} called ¡Lotería!`);
            io.emit('host:playerWon', player);
            
            const playerRecord = gameState.playerLog.find(p => p.name === player.name && p.phone === player.phone);
            if(playerRecord) {
                playerRecord.won = 'Si';
                const updatedCsv = Papa.unparse(gameState.playerLog);
                fs.writeFileSync(gameState.logFilePath, updatedCsv);
            }
        }
    });

    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
        const player = gameState.players[socket.id];
        if (player) {
            const board = gameState.boards.find(b => b.id == player.boardId);
            if (board) {
                board.assigned = false;
                board.assignedTo = null;
            }
            delete gameState.players[socket.id];
            io.emit('host:playerLeft', player);
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

