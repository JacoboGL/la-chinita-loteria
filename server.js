// server.js - The heart of your live game

// 1. SETUP
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const fs = require('fs'); // Import the File System module

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const PORT = process.env.PORT || 3000;

app.use(express.static('public'));

// --- GAME STATE & LOGIC ---

let gameState = {
    hostSocketId: null,
    players: {},
    gameInProgress: false,
    fullDeck: [],
    drawnCards: [],
    boardPool: [],
};

const ALL_CARD_NAMES = [
    '1.webp', '2.webp', '3.webp', '4.webp', '5.webp', '6.webp', '7.webp', '8.webp',
    '9.webp', '10.webp', '11.webp', '12.webp', '13.webp', '14.webp', '15.webp', '16.webp',
    '17.webp', '18.webp', '19.webp', '20.webp', '21.webp', '22.webp', '23.webp', '24.webp',
    '25.webp', '26.webp', '27.webp', '28.webp', '29.webp', '30.webp', '31.webp', '32.webp'
];

// --- HELPER FUNCTIONS ---

function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

/** UPDATED: Generates board pool by reading from the JSON file */
function generateBoardPool() {
    console.log('Generating board pool from boards.json...');
    try {
        const boardsData = fs.readFileSync('public/boards.json');
        const boards = JSON.parse(boardsData);
        // Ensure all 32 boards are loaded before assuming they are
        if (boards.length < 32) {
            console.warn("Warning: boards.json contains fewer than 32 boards.");
        }
        return boards;
    } catch (error) {
        console.error("Error reading or parsing boards.json:", error);
        return []; // Return an empty pool on error
    }
}

function resetGame() {
    console.log('Resetting game state.');
    gameState = {
        hostSocketId: null,
        players: {},
        gameInProgress: false,
        fullDeck: shuffle([...ALL_CARD_NAMES]),
        drawnCards: [],
        boardPool: generateBoardPool(),
    };
}

resetGame();

// 2. REAL-TIME COMMUNICATION
io.on('connection', (socket) => {
    console.log(`New user connected: ${socket.id}`);

    // --- HOST EVENTS ---
    socket.on('host:createGame', () => {
        if (gameState.hostSocketId) {
            socket.emit('error:gameInProgress', 'A game is already being hosted.');
            return;
        }
        resetGame();
        gameState.hostSocketId = socket.id;
        gameState.gameInProgress = true;
        console.log(`Game created by host: ${socket.id}`);
        io.emit('game:update', gameState);
    });

    socket.on('host:drawCard', () => {
        if (socket.id !== gameState.hostSocketId || gameState.fullDeck.length === 0) {
            return;
        }
        const drawnCard = gameState.fullDeck.pop();
        gameState.drawnCards.push(drawnCard);
        console.log(`Host drew card: ${drawnCard}`);
        io.emit('game:update', gameState);
    });

    // --- PLAYER EVENTS ---
    socket.on('player:joinGame', ({ playerName, boardId }) => {
        if (!gameState.gameInProgress) {
             socket.emit('error:gameNotStarted', 'The game has not started yet.');
             return;
        }
        const chosenBoard = gameState.boardPool.find(b => b.id === boardId);
        if (!chosenBoard) {
            // Handle case where board is not found
            socket.emit('error', 'Selected board is not available.');
            return;
        }
        gameState.players[socket.id] = {
            id: socket.id,
            name: playerName,
            board: chosenBoard,
        };
        console.log(`Player ${playerName} joined with board ${boardId}.`);
        io.emit('game:update', gameState);
    });
    
    socket.on('player:claimWin', () => {
        const player = gameState.players[socket.id];
        if (!player) return;

        // The win verification is now based on the `cards` array within the player's board object
        const boardCardIds = new Set(player.board.cards.map(c => c.id));
        const drawnCardsSet = new Set(gameState.drawnCards);
        
        let allCardsMatch = true;
        for (const cardId of boardCardIds) {
            if (!drawnCardsSet.has(cardId)) {
                allCardsMatch = false;
                break;
            }
        }

        if (allCardsMatch) {
            console.log(`Win confirmed for player: ${player.name}`);
            io.to(gameState.hostSocketId).emit('game:playerWon', player.name);
        }
    });

    // --- GENERAL EVENTS ---
    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
        if (socket.id === gameState.hostSocketId) {
            console.log('Host disconnected. Ending game.');
            resetGame();
            io.emit('game:ended', 'The host has disconnected. The game is over.');
        } else {
            delete gameState.players[socket.id];
            io.emit('game:update', gameState);
        }
    });
    
    // Send the board pool, which now contains full board data
    socket.emit('game:boardPool', gameState.boardPool);
});


// 3. START THE SERVER
server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

