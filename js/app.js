import { CONFIG } from './config.js';

let dictionary = [];
let todayPuzzle = null;
let selectedTileElement = null; // Tracks the currently active/clicked seed letter

document.addEventListener('DOMContentLoaded', async () => {
  await loadGameData();
  setupMobileFriendlySelectors();
  setupEventListeners();
});

async function loadGameData() {
  try {
    const dictResponse = await fetch(CONFIG.dictionaryPath);
    dictionary = await dictResponse.json();

    if (CONFIG.googleSheetCsvUrl && CONFIG.googleSheetCsvUrl !== "") {
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

// Renders the selection bank tiles cleanly at the top tray
function renderSeedBank(word) {
  const bank = document.getElementById('seed-bank');
  bank.innerHTML = '';
  
  word.split('').forEach((letter, index) => {
    const tile = document.createElement('div');
    tile.classList.add('draggable-letter');
    tile.setAttribute('id', `seed-letter-${index}`);
    tile.innerText = letter;
    
    // Tap / Click Selection Logic (100% Mobile Safe)
    tile.addEventListener('click', () => {
      // If clicking the already selected tile, deselect it
      if (selectedTileElement === tile) {
        tile.style.backgroundColor = 'var(--text)';
        tile.style.color = 'var(--bg)';
        selectedTileElement = null;
      } else {
        // Clear previous selection styling
        if (selectedTileElement) {
          selectedTileElement.style.backgroundColor = 'var(--text)';
          selectedTileElement.style.color = 'var(--bg)';
        }
        selectedTileElement = tile;
        tile.style.backgroundColor = 'var(--color-correct)'; // Highlight green when selected
        tile.style.color = '#ffffff';
      }
    });
    
    bank.appendChild(tile);
  });
}

// Binds selection clicks straight to destination grid cells
function setupMobileFriendlySelectors() {
  const activeCells = document.querySelectorAll('.cell:not(.invisible-space)');
  
  activeCells.forEach(cell => {
    cell.addEventListener('click', () => {
      if (selectedTileElement) {
        cell.value = selectedTileElement.innerText;
        
        // Return tile back to standard configuration state post-placement
        selectedTileElement.style.backgroundColor = 'var(--text)';
        selectedTileElement.style.color = 'var(--bg)';
        selectedTileElement = null;
        
        cell.focus();
        // Fire custom native input event to handle focus-forward propagation
        cell.dispatchEvent(new Event('input'));
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
      // Auto-focus next cell down the layout line if filled
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
  
  let board = {
    0: ["","","",""], 
    1: ["","","",""], 
    2: ["","","",""], 
    3: ["","","",""]  
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

  // Exact 4-word frame mapping evaluation
  let row0Word = board[0].join("");
  let row3Word = board[3].join("");
  let col0Word = board[0][0] + board[1][0] + board[2][0] + board[3][0];
  let col3Word = board[0][3] + board[1][3] + board[2][3] + board[3][3];

  const targetWords = [row0Word, row3Word, col0Word, col3Word];
  const unrecognized = targetWords.filter(w => !dictionary.includes(w));

  if (unrecognized.length === 0) {
    alert("🎉 YOU WIN! ALL WORD LINKS ARE PERFECTLY VALID.");
  } else {
    alert(`NOT QUITE. The following combinations are not real words: ${unrecognized.join(", ")}`);
  }
}
