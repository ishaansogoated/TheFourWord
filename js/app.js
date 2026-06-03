import { CONFIG } from './config.js';

let dictionary = [];
let todayPuzzle = null;

document.addEventListener('DOMContentLoaded', async () => {
  await loadGameData();
  initializeGrid();
  setupEventListeners();
});

async function loadGameData() {
  try {
    const dictResponse = await fetch(CONFIG.dictionaryPath);
    dictionary = await dictResponse.json();

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
    
    document.querySelector('header h1').innerText = `${CONFIG.siteName} #${todayPuzzle.puzzleNumber}`;
  } catch (err) {
    console.error("Data pipeline failed, using defaults:", err);
    todayPuzzle = CONFIG.fallbackPuzzle;
  }
}

function initializeGrid() {
  const cells = document.querySelectorAll('.cell');
  const seed = todayPuzzle.seedWord;

  cells.forEach(cell => {
    const row = parseInt(cell.getAttribute('data-row'));
    const targetSeedLetter = seed[row];

    cell.addEventListener('focus', function() {
      if (!this.value) {
        this.value = targetSeedLetter;
        setTimeout(() => this.setSelectionRange(1, 1), 0);
      }
    });
  });
}

function setupEventListeners() {
  const cells = Array.from(document.querySelectorAll('.cell'));
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

  submitBtn.addEventListener('click', validateBoardLayout);
}

function validateBoardLayout() {
  const cells = document.querySelectorAll('.cell');
  let board = [["","","",""], ["","","",""], ["","","",""], ["","","",""]];
  let incomplete = false;

  cells.forEach(cell => {
    const r = parseInt(cell.getAttribute('data-row'));
    const c = parseInt(cell.getAttribute('data-col'));
    const val = cell.value.trim().toUpperCase();
    
    if (!val) incomplete = true;
    board[r][c] = val;
  });

  if (incomplete) {
    alert("CRITICAL ERROR: ALL CELLS MUST BE FILLED.");
    return;
  }

  let horizontalWords = board.map(row => row.join(""));
  let verticalWords = ["", "", "", ""];
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      verticalWords[c] += board[r][c];
    }
  }

  const allWords = [...horizontalWords, ...verticalWords];
  const invalidWords = allWords.filter(word => !dictionary.includes(word));

  if (invalidWords.length === 0) {
    alert("VICTORY! ALL 8 INTEGRATIONS VALIDATED SUCCESSFULLY.");
  } else {
    alert(`INVALID MATRIX: The following string segments are not recognized: ${invalidWords.join(", ")}`);
  }
}
