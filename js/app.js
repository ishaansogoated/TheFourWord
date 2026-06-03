import { CONFIG } from './config.js';

let dictionary = [];
let todayPuzzle = null;

document.addEventListener('DOMContentLoaded', async () => {
  await loadGameData();
  initializeDragAndDrop();
  setupEventListeners();
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
    
    document.getElementById('game-title').innerText = `${CONFIG.siteName} #${todayPuzzle.puzzleNumber}`;
    renderSeedBank(todayPuzzle.seedWord);
  } catch (err) {
    console.error("Pipeline breakdown, falling back:", err);
    todayPuzzle = CONFIG.fallbackPuzzle;
    renderSeedBank(todayPuzzle.seedWord);
  }
}

// Render draggable letters into the top tray
function renderSeedBank(word) {
  const bank = document.getElementById('seed-bank');
  bank.innerHTML = '';
  
  word.split('').forEach((letter, index) => {
    const tile = document.createElement('div');
    tile.classList.add('draggable-letter');
    tile.setAttribute('draggable', 'true');
    tile.setAttribute('id', `seed-letter-${index}`);
    tile.innerText = letter;
    
    tile.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', e.target.id);
    });
    
    bank.appendChild(tile);
  });
}

// Wire up the target cells to receive the items safely
function initializeDragAndDrop() {
  const activeCells = document.querySelectorAll('.cell:not(.invisible-space)');
  
  activeCells.forEach(cell => {
    cell.addEventListener('dragover', (e) => {
      e.preventDefault(); // Required to allow landing drops
    });

    cell.addEventListener('drop', (e) => {
      e.preventDefault();
      const id = e.dataTransfer.getData('text/plain');
      const draggedElement = document.getElementById(id);
      if (draggedElement) {
        cell.value = draggedElement.innerText;
        cell.focus();
      }
    });
  });
}

function setupEventListeners() {
  const cells = Array.from(document.querySelectorAll('.cell:not(.invisible-space)'));
  const submitBtn = document.getElementById('submit-btn');

  cells.forEach((cell, idx) => {
    cell.addEventListener('input', (e) => {
      e.target.value = e.target.value.toUpperCase();
      if (e.target.value.length === 1 && idx < cells.length - 1) {
        cells[idx + 1].focus();
      }
    });

    cell.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && e.target.value === '' && idx > 0) {
        cells[idx - 1].focus();
      }
    });
  });

  submitBtn.addEventListener('click', validateHollowFrame);
}

function validateHollowFrame() {
  const cells = document.querySelectorAll('.cell:not(.invisible-space)');
  
  // Set up an empty structural tracking map
  let board = {
    0: ["","","",""], // Row 0
    1: ["","","",""], // Row 1 (Index 1 and 2 are bypassed)
    2: ["","","",""], // Row 2 (Index 1 and 2 are bypassed)
    3: ["","","",""]  // Row 3
  };

  let missingInputs = false;
  cells.forEach(cell => {
    const r = parseInt(cell.getAttribute('data-row'));
    const c = parseInt(cell.getAttribute('data-col'));
    const val = cell.value.trim().toUpperCase();
    
    if (!val) missingInputs = true;
    board[r][c] = val;
  });

  if (missingInputs) {
    alert("FILL ALL 12 BORDER CORES BEFORE SUBMISSION.");
    return;
  }

  // Extract 4 crossing frame words
  let row0Word = board[0].join("");
  let row3Word = board[3].join("");
  let col0Word = board[0][0] + board[1][0] + board[2][0] + board[3][0];
  let col3Word = board[0][3] + board[1][3] + board[2][3] + board[3][3];

  const targetWords = [row0Word, row3Word, col0Word, col3Word];
  const unrecognized = targetWords.filter(w => !dictionary.includes(w));

  if (unrecognized.length === 0) {
    alert("CORRECT! GRID FRAME SOLVED SUCCESSFULLY.");
  } else {
    alert(`TRY AGAIN. Unrecognized segments found: ${unrecognized.join(", ")}`);
  }
}
