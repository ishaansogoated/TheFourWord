import { CONFIG } from './config.js';

let dictionary = [];
let todayPuzzle = null;
let activeTappedTile = null; // The seed letter currently selected from the bank
let activeGridCell = null;   // The grid cell currently focused for typing

// Track which seed letters have been placed
let seedState = [
  { id: 0, letter: '', used: false, gridRow: null, gridCol: null },
  { id: 1, letter: '', used: false, gridRow: null, gridCol: null },
  { id: 2, letter: '', used: false, gridRow: null, gridCol: null },
  { id: 3, letter: '', used: false, gridRow: null, gridCol: null }
];

document.addEventListener('DOMContentLoaded', async () => {
  await loadGameData();
  setupTutorial();
  initializeInteractions();
});

async function loadGameData() {
  try {
    const dictResponse = await fetch(CONFIG.dictionaryPath);
    dictionary = await dictResponse.json();

    if (CONFIG.googleSheetCsvUrl) {
      const sheetResponse = await fetch(CONFIG.googleSheetCsvUrl);
      const csvText = await sheetResponse.text();
      const rows = csvText.split('\n').map(row => row.split(','));
      const puzzles = {};
      
      for (let i = 1; i < rows.length; i++) {
        if (rows[i].length >= 3) {
          const dateStr = rows[i][0].trim();
          puzzles[dateStr] = {
            date: dateStr,
            puzzleNumber: rows[i][1].trim(),
            seedWord: rows[i][2].trim().toUpperCase()
          };
        }
      }
      const todayStr = new Date().toISOString().split('T')[0];
      todayPuzzle = puzzles[todayStr] || CONFIG.fallbackPuzzle;
    } else {
      todayPuzzle = CONFIG.fallbackPuzzle;
    }
    
    // Initialize seed state
    const seedLetters = todayPuzzle.seedWord.split('');
    seedLetters.forEach((l, i) => seedState[i].letter = l);

    document.getElementById('game-title').innerText = `The FourWord #${todayPuzzle.puzzleNumber}`;
    renderSeedBank();
  } catch (err) {
    console.error("Pipeline breakdown:", err);
    todayPuzzle = CONFIG.fallbackPuzzle;
    renderSeedBank();
  }
}

function setupTutorial() {
  // Show tutorial on first load (could use localStorage to hide later)
  document.getElementById('modal-overlay').classList.remove('hidden');
  document.getElementById('tutorial-modal').classList.remove('hidden');

  document.getElementById('close-tutorial-btn').addEventListener('click', () => {
    document.getElementById('modal-overlay').classList.add('hidden');
    document.getElementById('tutorial-modal').classList.add('hidden');
  });
}

function renderSeedBank() {
  const bank = document.getElementById('seed-bank');
  bank.innerHTML = '';
  
  seedState.forEach((seed) => {
    const tile = document.createElement('div');
    tile.classList.add('draggable-letter');
    if (seed.used) tile.classList.add('used');
    
    tile.setAttribute('id', `seed-letter-${seed.id}`);
    tile.innerText = seed.letter;
    
    // Select seed tile to place
    tile.addEventListener('click', () => {
      if (seed.used) return; // Can't select if already placed
      
      if (activeTappedTile === seed.id) {
        tile.style.background = 'var(--color-absent)';
        activeTappedTile = null;
      } else {
        // Deselect previous
        if (activeTappedTile !== null) {
          document.getElementById(`seed-letter-${activeTappedTile}`).style.background = 'var(--color-absent)';
        }
        activeTappedTile = seed.id;
        tile.style.background = 'var(--color-correct)'; // Highlight intent to place
      }
    });
    
    bank.appendChild(tile);
  });
}

function initializeInteractions() {
  const cells = Array.from(document.querySelectorAll('.cell:not(.invisible-space)'));
  const keyboardInput = document.getElementById('hidden-keyboard-input');
  const submitBtn = document.getElementById('submit-btn');

  // Handle clicking on the grid
  cells.forEach((cell, idx) => {
    cell.addEventListener('click', () => {
      const r = parseInt(cell.getAttribute('data-row'));
      const c = parseInt(cell.getAttribute('data-col'));

      // 1. If a grid cell WITH a seed letter is clicked, return it to bank
      if (cell.classList.contains('is-seed')) {
        const seedId = parseInt(cell.getAttribute('data-seed-id'));
        seedState[seedId].used = false;
        seedState[seedId].gridRow = null;
        seedState[seedId].gridCol = null;
        
        cell.value = '';
        cell.classList.remove('is-seed');
        cell.removeAttribute('data-seed-id');
        renderSeedBank(); // Refresh tray
        return;
      }

      // 2. If a seed tile is currently selected from the tray, drop it here
      if (activeTappedTile !== null) {
        // Place it
        cell.value = seedState[activeTappedTile].letter;
        cell.classList.add('is-seed');
        cell.setAttribute('data-seed-id', activeTappedTile);
        
        // Update State
        seedState[activeTappedTile].used = true;
        seedState[activeTappedTile].gridRow = r;
        seedState[activeTappedTile].gridCol = c;
        
        activeTappedTile = null;
        renderSeedBank(); // Will grey out the used letter
        return;
      }

      // 3. Otherwise, set focus for regular typing
      cells.forEach(c => c.classList.remove('active-focus'));
      cell.classList.add('active-focus');
      activeGridCell = cell;
      keyboardInput.focus(); // Bring up mobile keyboard
    });
  });

  // Handle invisible typing input
  keyboardInput.addEventListener('input', (e) => {
    if (!activeGridCell) return;
    
    const val = e.target.value.toUpperCase();
    e.target.value = ''; // Clear hidden input immediately

    if (val.match(/[A-Z]/) && !activeGridCell.classList.contains('is-seed')) {
      activeGridCell.value = val;
      
      // Auto-advance to next empty cell
      const currentIndex = cells.indexOf(activeGridCell);
      let nextIndex = currentIndex + 1;
      while (nextIndex < cells.length && cells[nextIndex].classList.contains('is-seed')) {
        nextIndex++;
      }
      
      if (nextIndex < cells.length) {
        cells.forEach(c => c.classList.remove('active-focus'));
        cells[nextIndex].classList.add('active-focus');
        activeGridCell = cells[nextIndex];
      }
    }
  });

  // Handle Backspace for normal typing
  keyboardInput.addEventListener('keydown', (e) => {
    if (e.key === 'Backspace' && activeGridCell && !activeGridCell.classList.contains('is-seed')) {
      if (activeGridCell.value !== '') {
        activeGridCell.value = '';
      } else {
        // Move back
        const currentIndex = cells.indexOf(activeGridCell);
        let prevIndex = currentIndex - 1;
        while (prevIndex >= 0 && cells[prevIndex].classList.contains('is-seed')) {
          prevIndex--;
        }
        if (prevIndex >= 0) {
          cells.forEach(c => c.classList.remove('active-focus'));
          cells[prevIndex].classList.add('active-focus');
          activeGridCell = cells[prevIndex];
          activeGridCell.value = '';
        }
      }
    }
  });

  submitBtn.addEventListener('click', validateHollowFrame);
}

function validateHollowFrame() {
  const cells = document.querySelectorAll('.cell:not(.invisible-space)');
  let board = { 0: ["","","",""], 1: ["","","",""], 2: ["","","",""], 3: ["","","",""] };
  let missingInputs = false;

  cells.forEach(cell => {
    const r = parseInt(cell.getAttribute('data-row'));
    const c = parseInt(cell.getAttribute('data-col'));
    const val = cell.value.trim().toUpperCase();
    if (!val) missingInputs = true;
    board[r][c] = val;
  });

  if (missingInputs) {
    alert("Fill all 12 spaces before submitting.");
    return;
  }
  
  // Rule Check: Did they use all 4 seed letters?
  const unusedSeeds = seedState.filter(s => !s.used);
  if (unusedSeeds.length > 0) {
    alert("You must place all 4 seed letters on the board.");
    return;
  }

  let row0Word = board[0].join("");
  let row3Word = board[3].join("");
  let col0Word = board[0][0] + board[1][0] + board[2][0] + board[3][0];
  let col3Word = board[0][3] + board[1][3] + board[2][3] + board[3][3];

  const targetWords = [row0Word, row3Word, col0Word, col3Word];
  const unrecognized = targetWords.filter(w => !dictionary.includes(w));

  if (unrecognized.length === 0) {
    triggerWinAnimation(cells);
  } else {
    alert(`Not quite right! These aren't valid words: ${unrecognized.join(", ")}`);
  }
}

function triggerWinAnimation(cells) {
  // Staggered Flip cascade
  cells.forEach((cell, i) => {
    setTimeout(() => {
      cell.classList.remove('is-seed'); // Remove seed color styling
      cell.classList.add('win-flip');
    }, i * 150); // 150ms delay per cell for the wave effect
  });

  // Wait for animation wave to finish, then show popup
  setTimeout(() => {
    document.getElementById('modal-overlay').classList.remove('hidden');
    document.getElementById('win-modal').classList.remove('hidden');
    document.getElementById('win-stats').innerText = `Puzzle #${todayPuzzle.puzzleNumber} Solved!`;
  }, (cells.length * 150) + 600);

  // Wire up share button
  document.getElementById('share-btn').addEventListener('click', () => {
    const shareText = `The FourWord #${todayPuzzle.puzzleNumber}\n🟩🟩🟩🟩\n🟩⬛⬛🟩\n🟩⬛⬛🟩\n🟩🟩🟩🟩`;
    navigator.clipboard.writeText(shareText).then(() => {
      alert("Result copied to clipboard!");
    });
  });
}
