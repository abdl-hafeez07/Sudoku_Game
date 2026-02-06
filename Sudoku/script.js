/* =====================================
   CELESTIAL GLASS SUDOKU - LOCIG ENGINE
   Professional Implementation with Unique Solutions
   ===================================== */

/* =====================================
   GAME STATE MANAGEMENT
   ===================================== */

const gameState = {
    // Current game data
    solution: [],           // Complete valid Sudoku solution
    puzzle: [],             // Puzzle with cells removed
    userBoard: [],          // Current user input state
    difficulty: 'easy',     // Current difficulty level

    // Timer data
    startTime: null,
    timerInterval: null,
    elapsedSeconds: 0,

    // UI state
    selectedCell: null,
    isComplete: false,
    hintsUsed: 0,
    maxHints: 3
};

/* Difficulty configuration
 * Defines the range of cells to KEEP filled.
 * Includes 'maxSolutions' check to strictly enforce uniqueness.
 */
const DIFFICULTY_CONFIG = {
    easy: { min: 40, max: 45 },
    medium: { min: 32, max: 37 },
    hard: { min: 24, max: 29 }
};

/* =====================================
   INITIALIZATION
   ===================================== */

document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});

function initializeApp() {
    loadHighScores();
    setupMenuEventListeners();
    setupGameEventListeners();

    // Add Hint Button dynamically if not present
    ensureHintButtonExists();
}

function ensureHintButtonExists() {
    const controls = document.querySelector('.game-controls');
    if (controls && !document.getElementById('hintButton')) {
        const hintBtn = document.createElement('button');
        hintBtn.className = 'control-btn btn-hint';
        hintBtn.id = 'hintButton';
        hintBtn.innerHTML = `
            <span class="btn-icon">💡</span>
            <span class="btn-text" id="hintText">Hint (3/3)</span>
        `;
        // Insert before New Game button
        const newGameBtn = document.getElementById('newGameButton');
        controls.insertBefore(hintBtn, newGameBtn);

        hintBtn.addEventListener('click', provideHint);
    }
}

/* =====================================
   EVENT LISTENERS SETUP
   ===================================== */

function setupMenuEventListeners() {
    // Difficulty selection
    document.querySelectorAll('.difficulty-option').forEach(button => {
        button.addEventListener('click', (e) => {
            selectDifficulty(e.currentTarget);
        });
    });

    // Start game button
    document.getElementById('startButton').addEventListener('click', startNewGame);
}

function setupGameEventListeners() {
    // Control buttons
    document.getElementById('backButton').addEventListener('click', returnToMenu);
    document.getElementById('checkButton').addEventListener('click', checkSolution);
    document.getElementById('resetButton').addEventListener('click', resetPuzzle);
    document.getElementById('newGameButton').addEventListener('click', startNewGame);

    // Hint button listener is added in ensureHintButtonExists

    // Modal buttons
    document.getElementById('playAgainButton').addEventListener('click', () => {
        hideModal();
        startNewGame();
    });
    document.getElementById('backToMenuButton').addEventListener('click', () => {
        hideModal();
        returnToMenu();
    });

    // Keyboard support
    document.addEventListener('keydown', handleKeyboardInput);
}

/* =====================================
   MENU SCREEN FUNCTIONS
   ===================================== */

function selectDifficulty(button) {
    document.querySelectorAll('.difficulty-option').forEach(btn => {
        btn.classList.remove('active');
    });

    button.classList.add('active');
    gameState.difficulty = button.dataset.difficulty;
}

function loadHighScores() {
    const difficulties = ['easy', 'medium', 'hard'];

    difficulties.forEach(difficulty => {
        const score = localStorage.getItem(`highScore_${difficulty}`);
        // Capitalize first letter for ID
        const elementId = `highScore${difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}`;
        const element = document.getElementById(elementId);

        if (element) {
            if (score) {
                element.textContent = formatTime(parseInt(score));
            } else {
                element.textContent = '--:--';
            }
        }
    });
}

function saveHighScore(difficulty, timeInSeconds) {
    const currentHighScore = localStorage.getItem(`highScore_${difficulty}`);

    if (!currentHighScore || timeInSeconds < parseInt(currentHighScore)) {
        localStorage.setItem(`highScore_${difficulty}`, timeInSeconds);
        loadHighScores();
        return true;
    }

    return false;
}

/* =====================================
   SCREEN NAVIGATION
   ===================================== */

function startNewGame() {
    document.getElementById('startMenu').classList.add('hidden');
    document.getElementById('gameScreen').classList.remove('hidden');

    const difficultyText = gameState.difficulty.charAt(0).toUpperCase() + gameState.difficulty.slice(1);
    document.getElementById('currentDifficulty').textContent = difficultyText;

    gameState.isComplete = false;
    gameState.hintsUsed = 0;

    // Stop any existing timer and reset time
    stopTimer();
    gameState.elapsedSeconds = 0;

    // Update Hint UI
    const hintBtn = document.getElementById('hintButton');
    if (hintBtn) {
        hintBtn.disabled = false;
        document.getElementById('hintText').textContent = `Hint (${gameState.maxHints}/${gameState.maxHints})`;
        hintBtn.classList.remove('disabled');
        hintBtn.style.opacity = ''; // Reset opacity
        hintBtn.style.cursor = ''; // Reset cursor
    }

    // Generate and render
    setTimeout(() => { // Small delay to allow UI transition
        generateCompletePuzzle();
        renderBoard();
        startTimer();
    }, 100);
}

function returnToMenu() {
    stopTimer();
    document.getElementById('gameScreen').classList.add('hidden');
    document.getElementById('startMenu').classList.remove('hidden');
    clearMessageDisplay();
}

/* =====================================
   SUDOKU GENERATION ALGORITHM (True Sudoku)
   ===================================== */

function generateCompletePuzzle() {
    // 1. Generate full board
    gameState.solution = generateValidSolution();

    // 2. Create unique puzzle
    gameState.puzzle = createUniquePuzzle(gameState.solution, gameState.difficulty);

    // 3. Initialize user board
    gameState.userBoard = JSON.parse(JSON.stringify(gameState.puzzle));
}

function generateValidSolution() {
    const board = Array(9).fill(null).map(() => Array(9).fill(0));
    fillBoardWithBacktracking(board);
    return board;
}

function fillBoardWithBacktracking(board) {
    const emptyCell = findEmptyCell(board);
    if (!emptyCell) return true;

    const [row, col] = emptyCell;
    const numbers = shuffleArray([1, 2, 3, 4, 5, 6, 7, 8, 9]);

    for (let num of numbers) {
        if (isValidPlacement(board, row, col, num)) {
            board[row][col] = num;
            if (fillBoardWithBacktracking(board)) return true;
            board[row][col] = 0;
        }
    }
    return false;
}

/*
 * CRITICAL: Ensures the puzzle has EXACTLY ONE solution.
 * A proper Sudoku must be uniquely solvable.
 */
function createUniquePuzzle(solution, difficulty) {
    let puzzle = JSON.parse(JSON.stringify(solution));
    const config = DIFFICULTY_CONFIG[difficulty];

    // Create random list of positions to attempt removing
    const positions = [];
    for (let i = 0; i < 81; i++) positions.push(i);
    shuffleArray(positions);

    let attempts = 0;
    // We want to remove as many as possible while keeping uniqueness
    // But we also respect the difficulty 'min/max kept' setting
    // Lower difficulty = more cells kept = less removed

    // Calculate target removals
    const targetKept = Math.floor(Math.random() * (config.max - config.min + 1)) + config.min;
    let currentlyKept = 81;

    for (let pos of positions) {
        if (currentlyKept <= targetKept) break;

        const row = Math.floor(pos / 9);
        const col = pos % 9;
        const backup = puzzle[row][col];

        // Remove temporarily
        puzzle[row][col] = 0;

        // Check if unique solution exists
        // If MORE than 1 solution found, then removing this made it ambiguous -> put it back
        const solutionsCount = countSolutions(puzzle, 2); // Stop if we find 2

        if (solutionsCount !== 1) {
            puzzle[row][col] = backup; // Put back, critical for uniqueness
        } else {
            currentlyKept--;
        }
    }

    return puzzle;
}

/*
 * Solver that counts number of solutions up to 'limit'.
 * Used to verify uniqueness (limit = 2).
 */
function countSolutions(board, limit) {
    const emptyCell = findEmptyCell(board);
    if (!emptyCell) return 1;

    const [row, col] = emptyCell;
    let count = 0;

    for (let num = 1; num <= 9; num++) {
        if (isValidPlacement(board, row, col, num)) {
            board[row][col] = num;

            count += countSolutions(board, limit);

            board[row][col] = 0;

            if (count >= limit) break; // Optimization
        }
    }

    return count;
}

function findEmptyCell(board) {
    for (let r = 0; r < 9; r++)
        for (let c = 0; c < 9; c++)
            if (board[r][c] === 0) return [r, c];
    return null;
}

function isValidPlacement(board, row, col, num) {
    // Row check
    for (let c = 0; c < 9; c++) if (c !== col && board[row][c] === num) return false;
    // Col check
    for (let r = 0; r < 9; r++) if (r !== row && board[r][col] === num) return false;
    // Box check
    const br = Math.floor(row / 3) * 3, bc = Math.floor(col / 3) * 3;
    for (let r = br; r < br + 3; r++)
        for (let c = bc; c < bc + 3; c++)
            if ((r !== row || c !== col) && board[r][c] === num) return false;

    return true;
}

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

/* =====================================
   BOARD RENDERING
   ===================================== */

function renderBoard() {
    const boardElement = document.getElementById('sudokuBoard');
    boardElement.innerHTML = '';

    for (let row = 0; row < 9; row++) {
        for (let col = 0; col < 9; col++) {
            const cell = createCell(row, col);
            boardElement.appendChild(cell);
        }
    }
}

function createCell(row, col) {
    const cell = document.createElement('div');
    cell.className = 'sudoku-cell';
    cell.dataset.row = row;
    cell.dataset.col = col;

    const input = document.createElement('input');
    input.type = 'text';
    input.maxLength = '1';
    input.pattern = '[1-9]';
    input.setAttribute('inputmode', 'numeric');

    const value = gameState.puzzle[row][col];

    if (value !== 0) {
        input.value = value;
        input.disabled = true;
        cell.classList.add('fixed');
    } else {
        const userValue = gameState.userBoard[row][col];
        if (userValue !== 0) input.value = userValue;

        input.addEventListener('input', (e) => handleCellInput(e, row, col));
        input.addEventListener('focus', () => selectCell(row, col));
        input.addEventListener('keydown', (e) => handleCellKeydown(e, row, col));
    }

    cell.appendChild(input);
    return cell;
}

/* =====================================
   INPUT HANDLING
   ===================================== */

function handleCellInput(event, row, col) {
    const input = event.target;
    let value = input.value;

    clearErrorHighlights();
    clearMessageDisplay();

    if (value === '') {
        gameState.userBoard[row][col] = 0;
        return;
    }

    if (!/^[1-9]$/.test(value)) {
        input.value = '';
        gameState.userBoard[row][col] = 0;
        return;
    }

    const num = parseInt(value);
    gameState.userBoard[row][col] = num;

    // Conflict detection
    if (!isValidPlacement(gameState.userBoard, row, col, num)) {
        highlightConflicts(row, col, num);
    }

    // Check auto-completion validity
    if (isBoardComplete() && validateCompleteSolution()) {
        checkSolution(); // Auto-trigger success if full and correct
    }
}

function handleCellKeydown(event, row, col) {
    if (event.key.startsWith('Arrow')) {
        event.preventDefault();
        navigateWithArrows(event.key, row, col);
    }
}

function selectCell(row, col) {
    document.querySelectorAll('.sudoku-cell').forEach(cell => {
        cell.classList.remove('selected');
    });

    const cell = document.querySelector(`[data-row="${row}"][data-col="${col}"]`);
    if (cell) {
        cell.classList.add('selected');
        gameState.selectedCell = { row, col };
    }
}

function handleKeyboardInput(event) {
    if (!gameState.selectedCell) return;

    const { row, col } = gameState.selectedCell;
    const cell = document.querySelector(`[data-row="${row}"][data-col="${col}"]`);

    if (!cell || cell.classList.contains('fixed')) return;

    const input = cell.querySelector('input');

    if (event.key >= '1' && event.key <= '9') {
        input.value = event.key;
        handleCellInput({ target: input }, row, col);
    } else if (event.key === 'Backspace' || event.key === 'Delete') {
        input.value = '';
        handleCellInput({ target: input }, row, col);
    }
}

function navigateWithArrows(key, row, col) {
    let r = row, c = col;
    if (key === 'ArrowUp') r = Math.max(0, row - 1);
    if (key === 'ArrowDown') r = Math.min(8, row + 1);
    if (key === 'ArrowLeft') c = Math.max(0, col - 1);
    if (key === 'ArrowRight') c = Math.min(8, col + 1);

    const newCell = document.querySelector(`[data-row="${r}"][data-col="${c}"]`);
    if (newCell) {
        const input = newCell.querySelector('input');
        if (input && !input.disabled) input.focus();
        else selectCell(r, c); // Ensure selection updates even if fixed
    }
}

/* =====================================
   HINT SYSTEM
   ===================================== */

function provideHint() {
    if (gameState.isComplete) return;

    if (gameState.hintsUsed >= gameState.maxHints) {
        showMessage('No hints remaining!', 'error');
        return;
    }

    // 1. Find all empty cells
    const emptyCells = [];
    for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
            // Also check if current user value is WRONG, clear it
            const currentVal = gameState.userBoard[r][c];
            const correctVal = gameState.solution[r][c];

            if (currentVal === 0) {
                emptyCells.push([r, c]);
            } else if (currentVal !== correctVal) {
                // If wrong value, treat as candidate but also clear it
                emptyCells.push([r, c]);
            }
        }
    }

    if (emptyCells.length === 0) {
        showMessage('Board is full! Check for errors.', 'info');
        return;
    }

    // 2. Pick random empty cell
    const randomIndex = Math.floor(Math.random() * emptyCells.length);
    const [row, col] = emptyCells[randomIndex];
    const correctValue = gameState.solution[row][col];

    // 3. Fill it
    gameState.userBoard[row][col] = correctValue;
    gameState.hintsUsed++;
    gameState.elapsedSeconds += 10; // Time penalty

    // 4. Update UI
    const remaining = gameState.maxHints - gameState.hintsUsed;
    const hintBtn = document.getElementById('hintButton');
    if (hintBtn) {
        document.getElementById('hintText').textContent = `Hint (${remaining}/${gameState.maxHints})`;
        if (remaining === 0) {
            hintBtn.disabled = true;
            hintBtn.style.opacity = '0.5';
            hintBtn.style.cursor = 'not-allowed';
        }
    }

    const cell = document.querySelector(`[data-row="${row}"][data-col="${col}"]`);
    const input = cell.querySelector('input');
    input.value = correctValue;
    input.classList.add('hint-active'); // Add animation class
    setTimeout(() => input.classList.remove('hint-active'), 1000);

    showMessage(`Hint used! ${remaining} left. (+10s penalty)`, 'info');

    // Trigger input check (for completion)
    // Manually trigger handleCellInput via event simulation not needed since we updated state
    // But we should check completion
    if (isBoardComplete() && validateCompleteSolution()) {
        checkSolution();
    }
}


/* =====================================
   VALIDATION & CHECKING
   ===================================== */

function checkSolution() {
    clearErrorHighlights();

    // Logic: Compare userBoard directly to solution
    // Since we enforce unique solution, this is safe and fastest
    let hasErrors = false;
    let isFull = true;

    for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
            if (gameState.userBoard[r][c] === 0) {
                isFull = false;
            } else if (gameState.userBoard[r][c] !== gameState.solution[r][c]) {
                markCellAsError(r, c);
                hasErrors = true;
            }
        }
    }

    if (hasErrors) {
        showMessage('Errors found in solution!', 'error');
    } else if (!isFull) {
        showMessage('So far so good! Keep going.', 'info');
    } else {
        handleSuccessfulCompletion();
    }
}

function isBoardComplete() {
    for (let r = 0; r < 9; r++)
        for (let c = 0; c < 9; c++)
            if (gameState.userBoard[r][c] === 0) return false;
    return true;
}

function validateCompleteSolution() {
    // Compare directly with solution
    for (let r = 0; r < 9; r++)
        for (let c = 0; c < 9; c++)
            if (gameState.userBoard[r][c] !== gameState.solution[r][c]) return false;
    return true;
}

function highlightConflicts(row, col, num) {
    // Row, Col, Box logic same as before but encapsulated
    // Check row
    for (let c = 0; c < 9; c++)
        if (c !== col && gameState.userBoard[row][c] === num) markCellAsConflict(row, c);

    // Check col
    for (let r = 0; r < 9; r++)
        if (r !== row && gameState.userBoard[r][col] === num) markCellAsConflict(r, col);

    // Check box
    const br = Math.floor(row / 3) * 3, bc = Math.floor(col / 3) * 3;
    for (let r = br; r < br + 3; r++)
        for (let c = bc; c < bc + 3; c++)
            if ((r !== row || c !== col) && gameState.userBoard[r][c] === num) markCellAsConflict(r, c);

    markCellAsError(row, col);
}

function markCellAsError(row, col) {
    const cell = document.querySelector(`[data-row="${row}"][data-col="${col}"]`);
    if (cell) cell.classList.add('error');
}

function markCellAsConflict(row, col) {
    const cell = document.querySelector(`[data-row="${row}"][data-col="${col}"]`);
    if (cell) cell.classList.add('conflict');
}

function clearErrorHighlights() {
    document.querySelectorAll('.sudoku-cell').forEach(cell => {
        cell.classList.remove('error', 'conflict');
    });
}

/* =====================================
   TIMER FUNCTIONALITY
   ===================================== */

function startTimer() {
    gameState.startTime = Date.now() - (gameState.elapsedSeconds * 1000);
    if (gameState.timerInterval) clearInterval(gameState.timerInterval);
    gameState.timerInterval = setInterval(updateTimer, 1000);
    updateTimer();
}

function updateTimer() {
    if (!gameState.startTime) return;
    gameState.elapsedSeconds = Math.floor((Date.now() - gameState.startTime) / 1000);
    document.getElementById('timer').textContent = formatTime(gameState.elapsedSeconds);
}

function stopTimer() {
    if (gameState.timerInterval) {
        clearInterval(gameState.timerInterval);
        gameState.timerInterval = null;
    }
}

function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

/* =====================================
   GAME CONTROLS
   ===================================== */

function resetPuzzle() {
    gameState.userBoard = JSON.parse(JSON.stringify(gameState.puzzle));
    renderBoard();
    clearErrorHighlights();
    clearMessageDisplay();

    stopTimer();
    gameState.elapsedSeconds = 0;
    startTimer();

    showMessage('Board reset. Good luck!', 'info');
}

/* =====================================
   SUCCESS HANDLING
   ===================================== */

function handleSuccessfulCompletion() {
    stopTimer();
    gameState.isComplete = true;

    document.querySelectorAll('.sudoku-cell').forEach(cell => {
        cell.classList.add('success');
    });

    const isNewRecord = saveHighScore(gameState.difficulty, gameState.elapsedSeconds);
    showSuccessModal(isNewRecord);
    playSuccessSound();
}

function showSuccessModal(isNewRecord) {
    const modal = document.getElementById('successModal');
    document.getElementById('completionTime').textContent = formatTime(gameState.elapsedSeconds);
    document.getElementById('completionDifficulty').textContent = gameState.difficulty.charAt(0).toUpperCase() + gameState.difficulty.slice(1);

    const recordBadge = document.getElementById('newRecord');
    if (isNewRecord) recordBadge.classList.remove('hidden');
    else recordBadge.classList.add('hidden');

    modal.classList.remove('hidden');
}

function hideModal() {
    document.getElementById('successModal').classList.add('hidden');
}

function playSuccessSound() {
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        oscillator.frequency.value = 523.25;
        oscillator.type = 'sine';
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.5);
    } catch (e) { }
}

/* =====================================
   MESSAGE DISPLAY
   ===================================== */

function showMessage(text, type) {
    const container = document.getElementById('messageContainer');
    container.innerHTML = ''; // Clear previous

    const msg = document.createElement('div');
    msg.className = `game-message message-${type}`;
    msg.textContent = text;

    container.appendChild(msg);

    setTimeout(() => {
        msg.style.opacity = '0';
        setTimeout(() => container.removeChild(msg), 400);
    }, 3000);
}

function clearMessageDisplay() {
    document.getElementById('messageContainer').innerHTML = '';
}
