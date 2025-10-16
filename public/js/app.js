// app.js - Client-side logic for host and players

document.addEventListener('DOMContentLoaded', () => {
    const socket = io();
    const imageFolderPath = 'images/Deck/';
    const boardImagePath = 'images/Boards/';

    // --- GENERAL ---
    socket.on('error', (message) => alert(`Error: ${message}`));
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

        createGameBtn.addEventListener('click', () => socket.emit('host:createGame'));
        drawButton.addEventListener('click', () => socket.emit('host:drawCard'));

        socket.on('game:update', (gameState) => {
            if (gameState.gameInProgress && createGameBtn) {
                createGameBtn.classList.add('hidden');
                drawCardSection.classList.remove('hidden');
            }
            if (gameState.drawnCards.length > 0) {
                const lastCard = gameState.drawnCards[gameState.drawnCards.length - 1];
                drawnImage.src = `${imageFolderPath}${lastCard}`;
            }
            drawnCardsGrid.innerHTML = '';
            gameState.drawnCards.forEach(cardName => {
                const cell = document.createElement('div');
                cell.className = 'card-cell';
                const img = document.createElement('img');
                img.src = `${imageFolderPath}${cardName}`;
                cell.appendChild(img);
                drawnCardsGrid.appendChild(cell);
            });
            playerCountSpan.textContent = Object.keys(gameState.players).length;
            playerList.innerHTML = '';
            Object.values(gameState.players).forEach(player => {
                const li = document.createElement('li');
                li.textContent = `${player.name} - ${player.phone} (Tablero #${player.board.id + 1})`;
                playerList.appendChild(li);
            });
        });

        // ✨ UPDATED: The handler now receives a 'player' object.
        socket.on('game:playerWon', (player) => {
            // Display both the name and the phone number.
            winnerNotification.innerHTML = `🎉 ¡${player.name} tiene Lotería! 🎉<br><small>${player.phone}</small>`;
            winnerNotification.classList.remove('hidden');
            drawButton.disabled = true;
        });
    }

    // --- PLAYER LOGIC ---
    if (document.getElementById('player-view')) {
        const joinForm = document.getElementById('join-game-form');
        const playerBoardContainer = document.getElementById('player-board-container');
        const boardSelect = document.getElementById('board-select');
        const joinBtn = document.getElementById('join-btn');
        const playerBoardBg = document.getElementById('player-board-bg');
        const playerBoardMarkers = document.getElementById('player-board-markers');
        const claimWinBtn = document.getElementById('claim-win-btn');
        const chosenBoardName = document.getElementById('chosen-board-name');
        
        let myBoard = null;
        let drawnCards = [];

        socket.on('game:boardPool', (boardPool) => {
            boardSelect.innerHTML = '<option value="" disabled selected>Elige un tablero</option>';
            boardPool.forEach(board => {
                const option = document.createElement('option');
                option.value = board.id;
                option.textContent = `Tablero #${board.id + 1}`;
                boardSelect.appendChild(option);
            });
        });

        boardSelect.addEventListener('change', () => {
            const selectedBoardId = boardSelect.value;
            const boardPreviewImg = document.getElementById('board-preview-img');
            if (selectedBoardId) {
                boardPreviewImg.src = `${boardImagePath}T${parseInt(selectedBoardId) + 1}.webp`;
            }
        });

        joinBtn.addEventListener('click', () => {
            const playerNameInput = document.getElementById('player-name');
            const playerPhoneInput = document.getElementById('player-phone');
            const playerName = playerNameInput.value.trim();
            const phoneNumber = playerPhoneInput.value.trim();
            const boardId = parseInt(boardSelect.value, 10);

            if (!playerName || !phoneNumber || isNaN(boardId)) {
                alert('Por favor, completa todos los campos.');
                return;
            }
            socket.emit('player:joinGame', { playerName, phoneNumber, boardId });
        });
        
        socket.on('game:update', (gameState) => {
            const me = Object.values(gameState.players).find(p => p.id === socket.id);
            if (me && !myBoard) {
                myBoard = me.board;
                setupPlayerBoard();
            }
            
            if (myBoard) {
                drawnCards = gameState.drawnCards;
                updateDrawnCardsHistory(drawnCards);
                checkWinCondition();
            }
        });

        // ✨ NEW: Add this listener for all players
        socket.on('game:playerWon', (player) => {
            // Show an alert to all players
            alert(`¡Alguien ha cantado Lotería! El juego ha terminado.`);
            
            // Disable the button for all players, as the game is over.
            if (claimWinBtn) {
                claimWinBtn.disabled = true;
                claimWinBtn.textContent = "Juego Terminado";
            }
        });

        function setupPlayerBoard() {
            joinForm.classList.add('hidden');
            playerBoardContainer.classList.remove('hidden');

            chosenBoardName.textContent = `Tablero #${myBoard.id + 1}`;
            playerBoardBg.src = `${boardImagePath}${myBoard.image}`;

            playerBoardMarkers.innerHTML = '';
            for (let i = 0; i < 16; i++) {
                const cell = document.createElement('div');
                cell.className = 'marker-cell';
                cell.addEventListener('click', toggleMark);
                playerBoardMarkers.appendChild(cell);
            }
        }
        
        function updateDrawnCardsHistory(allDrawnCards) {
            const historyGrid = document.getElementById('drawn-cards-history-grid');
            if (!historyGrid) return;
            
            historyGrid.innerHTML = '';
            const lastThreeCards = allDrawnCards.slice(-3);

            for (let i = 0; i < 3; i++) {
                const cell = document.createElement('div');
                cell.className = 'history-card-cell';
                if (lastThreeCards[i]) {
                    const img = document.createElement('img');
                    img.src = `${imageFolderPath}${lastThreeCards[i]}`;
                    cell.appendChild(img);
                }
                historyGrid.appendChild(cell);
            }
        }

        function toggleMark(event) {
            const cell = event.currentTarget;
            if (cell.querySelector('.marker')) {
                cell.innerHTML = '';
            } else {
                const marker = document.createElement('div');
                marker.className = 'marker';
                marker.textContent = 'X';
                cell.appendChild(marker);
            }
            checkWinCondition();
        }

        function checkWinCondition() {
            if (!myBoard) return;
            const manuallyMarkedCount = playerBoardMarkers.querySelectorAll('.marker').length;
            const boardCardIds = new Set(myBoard.cards.map(c => c.id));
            const drawnCardsSet = new Set(drawnCards);
            const allCardsAreDrawn = [...boardCardIds].every(cardId => drawnCardsSet.has(cardId));

            if (manuallyMarkedCount === 16 && allCardsAreDrawn) {
                claimWinBtn.disabled = false;
            } else {
                claimWinBtn.disabled = true;
            }
        }

        claimWinBtn.addEventListener('click', () => {
            socket.emit('player:claimWin');
            claimWinBtn.textContent = '¡Verificando!';
            claimWinBtn.disabled = true;
        });
    }
});