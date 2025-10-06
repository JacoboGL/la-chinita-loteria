// app.js - Client-side logic for host and players

document.addEventListener('DOMContentLoaded', () => {
    const socket = io();
    const imageFolderPath = 'images/Deck/';
    
    // --- GENERAL ---
    socket.on('error:gameInProgress', (message) => alert(message));
    socket.on('error:gameNotStarted', (message) => alert(message));
    socket.on('game:ended', (message) => {
        alert(message);
        window.location.reload();
    });

    // --- HOST LOGIC ---
    if (document.getElementById('host-controls')) {
        const createGameBtn = document.getElementById('create-game-btn');
        const drawCardSection = document.getElementById('draw-card-section');
        const drawButton = document.getElementById('draw-button');
        const drawnImage = document.getElementById('drawn-image');
        const drawnCardsGrid = document.getElementById('drawn-cards-grid');
        const playerCountSpan = document.getElementById('player-count');
        const playerList = document.getElementById('player-list');
        const winnerNotification = document.getElementById('winner-notification');

        createGameBtn.addEventListener('click', () => {
            socket.emit('host:createGame');
            createGameBtn.classList.add('hidden');
            drawCardSection.classList.remove('hidden');
        });

        drawButton.addEventListener('click', () => {
            socket.emit('host:drawCard');
        });

        socket.on('game:update', (gameState) => {
            // Update drawn card display
            if (gameState.drawnCards.length > 0) {
                const lastCard = gameState.drawnCards[gameState.drawnCards.length - 1];
                drawnImage.src = `${imageFolderPath}${lastCard}`;
            }

            // Update drawn cards grid
            drawnCardsGrid.innerHTML = '';
            gameState.drawnCards.forEach(cardName => {
                const cell = document.createElement('div');
                cell.className = 'card-cell';
                const img = document.createElement('img');
                img.src = `${imageFolderPath}${cardName}`;
                cell.appendChild(img);
                drawnCardsGrid.appendChild(cell);
            });
            
            // Update player list
            playerCountSpan.textContent = Object.keys(gameState.players).length;
            playerList.innerHTML = '';
            Object.values(gameState.players).forEach(player => {
                const li = document.createElement('li');
                li.textContent = `${player.name} (Tablero #${player.board.id})`;
                playerList.appendChild(li);
            });
        });

        socket.on('game:playerWon', (playerName) => {
            winnerNotification.textContent = `🎉 ¡${playerName} tiene Lotería! 🎉`;
            winnerNotification.classList.remove('hidden');
            drawButton.disabled = true;
        });
    }

    // --- PLAYER LOGIC ---
    if (document.getElementById('player-view')) {
        const joinForm = document.getElementById('join-game-form');
        const waitingScreen = document.getElementById('waiting-screen');
        const playerBoardContainer = document.getElementById('player-board-container');
        
        const playerNameInput = document.getElementById('player-name');
        const boardSelect = document.getElementById('board-select');
        const joinBtn = document.getElementById('join-btn');
        
        const displayPlayerName = document.getElementById('display-player-name');
        const lastDrawnImg = document.getElementById('last-drawn-img');
        
        const playerBoard = document.getElementById('player-board');
        const claimWinBtn = document.getElementById('claim-win-btn');

        let myBoardCards = [];

        socket.on('game:boardPool', (boardPool) => {
            boardSelect.innerHTML = '';
            boardPool.forEach(board => {
                const option = document.createElement('option');
                option.value = board.id;
                option.textContent = `Tablero #${board.id}`;
                boardSelect.appendChild(option);
            });
        });

        joinBtn.addEventListener('click', () => {
            const playerName = playerNameInput.value.trim();
            const boardId = parseInt(boardSelect.value, 10);

            if (!playerName) {
                alert('Por favor, escribe tu nombre.');
                return;
            }

            socket.emit('player:joinGame', { playerName, boardId });

            joinForm.classList.add('hidden');
            waitingScreen.classList.remove('hidden');
            playerBoardContainer.classList.remove('hidden');
            displayPlayerName.textContent = playerName;
        });
        
        socket.on('game:update', (gameState) => {
            if (Object.values(gameState.players).find(p => p.id === socket.id)) {
                 // Initial board render
                if (playerBoard.innerHTML === '') {
                    const me = Object.values(gameState.players).find(p => p.id === socket.id);
                    myBoardCards = me.board.cards;
                    myBoardCards.forEach(cardName => {
                        const cell = document.createElement('div');
                        cell.className = 'card-cell';
                        cell.dataset.cardName = cardName;
                        const img = document.createElement('img');
                        img.src = `${imageFolderPath}${cardName}`;
                        cell.appendChild(img);
                        playerBoard.appendChild(cell);
                    });
                }
            }
           
            // Update last drawn card
            if (gameState.drawnCards.length > 0) {
                 const lastCard = gameState.drawnCards[gameState.drawnCards.length - 1];
                 lastDrawnImg.src = `${imageFolderPath}${lastCard}`;
            }

            // Mark cards on the board
            const drawnCardsSet = new Set(gameState.drawnCards);
            const boardCells = playerBoard.querySelectorAll('.card-cell');
            let markedCount = 0;
            boardCells.forEach(cell => {
                if (drawnCardsSet.has(cell.dataset.cardName)) {
                    cell.classList.add('marked');
                    markedCount++;
                }
            });

            // Check for win condition
            if (markedCount === myBoardCards.length && myBoardCards.length > 0) {
                claimWinBtn.disabled = false;
            }
        });

        claimWinBtn.addEventListener('click', () => {
            socket.emit('player:claimWin');
            claimWinBtn.textContent = '¡Verificando!';
            claimWinBtn.disabled = true;
        });
    }
});

