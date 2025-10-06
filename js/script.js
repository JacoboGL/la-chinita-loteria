document.addEventListener('DOMContentLoaded', () => {

    // --- CONFIGURATION ---
    const allImageNames = [
        '1.webp', '2.webp', '3.webp', '4.webp',
        '5.webp', '6.webp', '7.webp', '8.webp',
        '9.webp', '10.webp', '11.webp', '12.webp',
        '13.webp', '14.webp', '15.webp', '16.webp',
        '17.webp', '18.webp', '19.webp', '20.webp',
        '21.webp', '22.webp', '23.webp', '24.webp',
        '25.webp', '26.webp', '27.webp', '28.webp',
        '29.webp', '30.webp', '31.webp', '32.webp'
    ];
    
    // The path to your deck of cards.
    const imageFolderPath = 'images/Deck/';
    
    // --- DOM ELEMENTS ---
    const board = document.getElementById('bingo-board');
    const drawButton = document.getElementById('draw-button');
    const drawnImageDisplay = document.getElementById('drawn-image');

    // --- GAME STATE ---
    let drawableImages = [];
    // ✨ NEW: This counter tracks which grid slot to fill next.
    let nextSlotIndex = 0;

    function shuffle(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    }

    /**
     * ✨ UPDATED FUNCTION
     * Creates a grid of empty slots, ready to be filled.
     */
    function createBoard() {
        board.innerHTML = ''; 
        // Create one empty cell for each card in the deck.
        for (let i = 0; i < allImageNames.length; i++) {
            const cell = document.createElement('div');
            cell.classList.add('bingo-cell');
            board.appendChild(cell);
        }
    }

    /**
     * ✨ UPDATED FUNCTION
     * Draws a random card and places it in the next available grid slot.
     */
    function drawCard() {
        if (drawableImages.length === 0) return;

        // Draw a random card from the deck.
        const drawnImageName = drawableImages.pop();

        // Display the drawn card in the main caller's area.
        drawnImageDisplay.src = `${imageFolderPath}${drawnImageName}`;
        drawnImageDisplay.alt = drawnImageName;

        // Find all the grid cells.
        const allCells = board.querySelectorAll('.bingo-cell');
        // Get the next empty cell based on our counter.
        const targetCell = allCells[nextSlotIndex];

        if (targetCell) {
            // Create a new image element and place it in the cell.
            const img = document.createElement('img');
            img.src = `${imageFolderPath}${drawnImageName}`;
            img.alt = drawnImageName;
            targetCell.appendChild(img);

            // Increment the counter for the next turn.
            nextSlotIndex++;
        }

        // Disable the button when all cards have been drawn.
        if (drawableImages.length === 0) {
            drawButton.disabled = true;
            drawButton.textContent = 'Juego finalizado';
        }
    }
    
    /**
     * ✨ UPDATED FUNCTION
     * Initializes the game.
     */
    function init() {
        // Create the deck of cards to be drawn.
        drawableImages = [...allImageNames];
        shuffle(drawableImages); 

        // Set up the empty 32-slot board.
        createBoard();

        drawButton.addEventListener('click', drawCard);
    }

    // Start the game!
    init();
});