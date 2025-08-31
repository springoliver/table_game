const storageKey = "seatingChartState";

const defaultState = {
  settings: {
    mode: "daisy",
  },
  tables: [
    createTable("Table 1", "main", 8),
    createTable("Table 2", "mm", 8),
  ],
  waitingList: [],
  transferList: [],
  selectedTableId: null,
  selectedSeatIndex: null,
  modalOpen: false,
  tableModalOpen: false,
};

function createTable(name, type, seatsCount) {
  const id = getUUID();
  const seats = Array.from({ length: seatsCount }, (_, index) => ({
    seatNumber: index + 1,
    player: null,
    hold: false,
  }));
  return {
    id,
    name,
    type,
    seatsCount,
    seats,
    priorityOrder: seats.map((_, index) => index),
    colors: {
      label: "#1e2a38",
      seatFull: "#2ecc71",
      seatEmpty: "#bdc3c7",
    },
    daisyNextId: null,
    feederTableId: null,
  };
}

function loadState() {
  const raw = localStorage.getItem(storageKey);
  if (!raw) return structuredClone(defaultState);
  try {
    const parsed = JSON.parse(raw);
    const nextState = { ...structuredClone(defaultState), ...parsed };
    nextState.selectedSeatIndex = null;
    nextState.modalOpen = false;
    nextState.tableModalOpen = false;
    if (!nextState.tables.some((table) => table.id === nextState.selectedTableId)) {
      nextState.selectedTableId = null;
    }
    return nextState;
  } catch (error) {
    return structuredClone(defaultState);
  }
}

function saveState() {
  try {
    localStorage.setItem(storageKey, JSON.stringify(state));
  } catch (error) {
    console.error("Save failed:", error);
  }
}

function addToHistory() {
  const snapshot = JSON.parse(JSON.stringify(state));
  historyStack = historyStack.slice(0, historyIndex + 1);
  historyStack.push(snapshot);
  if (historyStack.length > MAX_HISTORY) {
    historyStack.shift();
  } else {
    historyIndex++;
  }
}

function undoMove() {
  if (historyIndex <= 0) return false;
  historyIndex--;
  state = JSON.parse(JSON.stringify(historyStack[historyIndex]));
  saveState();
  render();
  return true;
}

function redoMove() {
  if (historyIndex >= historyStack.length - 1) return false;
  historyIndex++;
  state = JSON.parse(JSON.stringify(historyStack[historyIndex]));
  saveState();
  render();
  return true;
}

function startAutoSave() {
  if (autoSaveTimer) clearInterval(autoSaveTimer);
  autoSaveTimer = setInterval(() => {
    saveState();
  }, 30000);
}

let state = loadState();

// Ensure consistent table types / daisy links when reopening from iPad storage.
if (state.settings.mode === "daisy") {
  normalizeDaisyTypes();
} else {
  normalizeFeederTypes();
}

const tablesContainer = document.getElementById("tablesContainer");
const editorContainer = document.getElementById("editorContainer");
const waitingListContainer = document.getElementById("waitingListContainer");
const transferListContainer = document.getElementById("transferListContainer");
const seatModal = document.getElementById("seatModal");
const seatModalTitle = document.getElementById("seatModalTitle");
const seatModalName = document.getElementById("seatModalName");
const seatModalNumber = document.getElementById("seatModalNumber");
const seatModalHold = document.getElementById("seatModalHold");
const seatModalTransfer = document.getElementById("seatModalTransfer");
const seatModalRemove = document.getElementById("seatModalRemove");
const seatModalSave = document.getElementById("seatModalSave");
const seatModalClose = document.getElementById("seatModalClose");
const seatModalPriority = document.getElementById("seatModalPriority");
const tableModal = document.getElementById("tableModal");
const tableModalTitle = document.getElementById("tableModalTitle");
const tableModalClose = document.getElementById("tableModalClose");
const tableModalContent = document.getElementById("tableModalContent");
const exportBtn = document.getElementById("exportBtn");
const importBtn = document.getElementById("importBtn");
const importInput = document.getElementById("importInput");
const resetUiBtn = document.getElementById("resetUiBtn");

let recentMoves = [];
let historyStack = [];
let historyIndex = -1;
const MAX_HISTORY = 15;
let autoSaveTimer = null;

if (seatModal) {
  seatModal.addEventListener("click", (event) => {
    if (event.target === seatModal) {
      closeSeatModal();
    }
  });
}

document.getElementById("addTableBtn").addEventListener("click", () => {
  const tableType = state.settings.mode === "daisy" ? "mm" : "main";
  const table = createTable(`Table ${state.tables.length + 1}`, tableType, 8);
  if (state.settings.mode === "daisy") {
    promotePreviousMustMove();
  }
  state.tables.push(table);
  state.selectedTableId = table.id;
  state.selectedSeatIndex = null;
  if (state.settings.mode === "daisy") {
    normalizeDaisyTypes();
  }
  saveState();
  render();
});

document.getElementById("resetBtn").addEventListener("click", () => {
  if (!confirm("⚠️ WARNING: This will DELETE ALL DATA!\n\nAre you sure you want to reset everything?")) return;
  if (!confirm("This cannot be undone. Click OK to confirm deletion.")) return;
  state = structuredClone(defaultState);
  historyStack = [];
  historyIndex = -1;
  saveState();
  render();
});

document.getElementById("addWaitingBtn").addEventListener("click", () => {
  state.waitingList.push({ id: getUUID(), name: "" });
  saveState();
  render();
});

document.getElementById("modeSelect").addEventListener("change", (event) => {
  state.settings.mode = event.target.value;
  if (state.settings.mode === "daisy") {
    normalizeDaisyTypes();
  } else {
    normalizeFeederTypes();
  }
  saveState();
  render();
});

if (exportBtn) {
  exportBtn.addEventListener("click", () => {
    const snapshot = structuredClone(state);
    snapshot.selectedSeatIndex = null;
    snapshot.modalOpen = false;
    snapshot.tableModalOpen = false;
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "seating-chart-backup.json";
    link.click();
    URL.revokeObjectURL(url);
  });
}

if (importBtn && importInput) {
  importBtn.addEventListener("click", () => importInput.click());
  importInput.addEventListener("change", (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        state = { ...structuredClone(defaultState), ...parsed };
        state.selectedSeatIndex = null;
        state.modalOpen = false;
        state.tableModalOpen = false;
        if (state.settings.mode === "daisy") {
          normalizeDaisyTypes();
        } else {
          normalizeFeederTypes();
        }
        saveState();
        render();
      } catch (error) {
        alert("Invalid backup file.");
      }
    };
    reader.readAsText(file);
    importInput.value = "";
  });
}

if (resetUiBtn) {
  resetUiBtn.addEventListener("click", () => {
    if (!confirm("Reset UI? This will close all modals and clear focus.\n\nYour data will NOT be affected.")) return;
    state.selectedSeatIndex = null;
    state.modalOpen = false;
    state.tableModalOpen = false;
    document.activeElement?.blur();
    const inputs = document.querySelectorAll("input, textarea");
    inputs.forEach((input) => input.blur());
    saveState();
    render();
  });
}

const undoBtn = document.getElementById("undoBtn");
const redoBtn = document.getElementById("redoBtn");

if (undoBtn) {
  undoBtn.addEventListener("click", () => {
    if (undoMove()) {
      undoBtn.disabled = historyIndex <= 0;
      redoBtn.disabled = historyIndex >= historyStack.length - 1;
    }
  });
}

if (redoBtn) {
  redoBtn.addEventListener("click", () => {
    if (redoMove()) {
      undoBtn.disabled = historyIndex <= 0;
      redoBtn.disabled = historyIndex >= historyStack.length - 1;
    }
  });
}

function render() {
  const scrollY = window.scrollY;
  document.getElementById("modeSelect").value = state.settings.mode;
  renderTables();
  renderEditor();
  renderWaitingList();
  renderTransferList();
  renderSeatModal();
  renderTableModal();
  updateUndoRedoButtons();
  if (scrollY) {
    window.scrollTo(0, scrollY);
  }
}

function renderTables() {
  tablesContainer.innerHTML = "";
  const template = document.getElementById("tableCardTemplate");

  state.tables.forEach((table) => {
    const card = template.content.cloneNode(true);
    const root = card.querySelector(".table-card");
    root.style.borderColor = table.colors.label;
    card.querySelector(".table-name").textContent = table.name;
    card.querySelector(
      ".table-meta"
    ).textContent = `${labelForType(table.type)} · Seats: ${
      table.seatsCount
    }`;

    const selectBtn = card.querySelector(".select-table");
    selectBtn.addEventListener("click", () => {
      openTableEditor(table.id);
    });

    const removeBtn = card.querySelector(".remove-table");
    const tableIdToRemove = table.id;
    removeBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      const tableToRemove = state.tables.find((t) => t.id === tableIdToRemove);
      if (!tableToRemove) return;
      if (!confirm(`Remove ${tableToRemove.name}?`)) return;
      state.tables = state.tables.filter((t) => t.id !== tableIdToRemove);
      if (state.selectedTableId === tableIdToRemove) {
        state.selectedTableId = null;
        state.tableModalOpen = false;
      }
      cleanupLinks(tableIdToRemove);
      if (state.settings.mode === "daisy") {
        normalizeDaisyTypes();
      }
      saveState();
      render();
    });

    const preview = card.querySelector(".seats-preview");
    const seatOrder = table.priorityOrder.length
      ? table.priorityOrder
      : table.seats.map((_, index) => index);
    seatOrder.forEach((seatIndex, orderIndex) => {
      const seat = table.seats[seatIndex];
      const pill = document.createElement("div");
      pill.className = "seat-pill";
      pill.style.background = seat.player
        ? table.colors.seatFull
        : table.colors.seatEmpty;
      pill.style.color = seat.player ? "#fff" : "#666";
      if (isSeatRecentlyMoved(table.id, seatIndex)) {
        pill.classList.add("seat-flash");
      }
      const priorityText = table.type === "main" ? "" : `P${orderIndex + 1} `;
      const seatText = `S${seat.seatNumber}`;
      pill.innerHTML = seat.player
        ? `<span class="seat-priority">${priorityText}</span><span class="seat-number-badge">${seatText}</span> ${seat.player.name}`
        : `<span class="seat-priority">${priorityText}</span><span class="seat-number-badge">${seatText}</span> Empty`;
      pill.addEventListener("click", () => {
        openSeatEditor(table.id, seatIndex);
      });
      preview.appendChild(pill);
    });

    if (state.selectedTableId === table.id) {
      root.classList.add("flash");
    }

    tablesContainer.appendChild(card);
  });
}

function renderEditor() {
  if (!editorContainer) return;
  editorContainer.innerHTML = "";
  editorContainer.textContent = "Use Edit on a table to open the editor.";
  editorContainer.className = "editor-empty";
}

function renderWaitingList() {
  waitingListContainer.innerHTML = "";
  state.waitingList.forEach((entry, index) => {
    const row = document.createElement("div");
    row.className = "list-row";
    const input = document.createElement("input");
    input.value = entry.name;
    input.placeholder = `#${index + 1}`;
    input.spellcheck = true;
    input.addEventListener("blur", () => {
      entry.name = titleCase(input.value.trim());
      saveState();
    });
    const upBtn = createMoveBtn(index, -1, state.waitingList);
    const downBtn = createMoveBtn(index, 1, state.waitingList);
    const removeBtn = document.createElement("button");
    removeBtn.textContent = "Remove";
    removeBtn.className = "secondary";
    removeBtn.addEventListener("click", () => {
      state.waitingList.splice(index, 1);
      saveState();
      renderWaitingList();
    });
    const actions = document.createElement("div");
    actions.className = "list-actions";
    actions.append(upBtn, downBtn, removeBtn);
    row.append(input, actions);
    waitingListContainer.appendChild(row);
  });
}

function renderTransferList() {
  transferListContainer.innerHTML = "";
  if (state.settings.mode === "daisy") {
    const note = document.createElement("p");
    note.className = "hint";
    note.textContent = "Transfer list is disabled in Daisy Chain mode.";
    transferListContainer.appendChild(note);
    return;
  }
  state.transferList.forEach((entry, index) => {
    const row = document.createElement("div");
    row.className = "list-row";

    const nameInput = document.createElement("input");
    nameInput.value = entry.name;
    nameInput.spellcheck = true;
    nameInput.addEventListener("blur", () => {
      entry.name = titleCase(nameInput.value.trim());
      saveState();
    });

    const targetSelect = document.createElement("select");
    fillTableSelect(targetSelect, entry.fromTableId, entry.toTableId);
    targetSelect.addEventListener("change", (event) => {
      entry.toTableId = event.target.value || null;
      saveState();
    });

    const actions = document.createElement("div");
    actions.className = "list-actions";
    const skipBtn = document.createElement("button");
    skipBtn.textContent = entry.status === "skipped" ? "Skipped" : "Skip";
    skipBtn.className = entry.status === "skipped" ? "secondary" : "";
    skipBtn.addEventListener("click", () => {
      entry.status = entry.status === "skipped" ? "active" : "skipped";
      saveState();
      renderTransferList();
    });

    const removeBtn = document.createElement("button");
    removeBtn.textContent = "Remove";
    removeBtn.className = "secondary";
    removeBtn.addEventListener("click", () => {
      state.transferList.splice(index, 1);
      saveState();
      renderTransferList();
    });
    actions.append(skipBtn, removeBtn);

    row.append(nameInput, targetSelect, actions);
    transferListContainer.appendChild(row);
  });
}

function resizeSeats(table, newCount) {
  if (newCount > table.seats.length) {
    const start = table.seats.length;
    for (let i = start; i < newCount; i += 1) {
      table.seats.push({ seatNumber: i + 1, player: null, hold: false });
      table.priorityOrder.push(i);
    }
  } else {
    table.seats.splice(newCount);
    table.priorityOrder = table.priorityOrder.filter((i) => i < newCount);
  }
  table.seatsCount = newCount;
}

function openSeat(tableId, seatIndex) {
  addToHistory();
  const table = state.tables.find((t) => t.id === tableId);
  if (!table) return;
  const seat = table.seats[seatIndex];
  if (seat.player) {
    moveSeatToBottom(table, seatIndex);
  }
  seat.player = null;
  seat.hold = false;
  state.modalOpen = false;
  state.selectedSeatIndex = null;

  if (state.settings.mode !== "daisy" && tryTransferOverride(tableId)) {
    saveState();
    render();
    return;
  }

  if (state.settings.mode === "daisy") {
    cascadeDaisy(tableId);
  } else {
    cascadeFeeder(tableId);
  }

  saveState();
  render();
}

function cascadeDaisy(startTableId) {
  let currentTableId = startTableId;
  while (currentTableId) {
    const currentTable = state.tables.find((t) => t.id === currentTableId);
    if (!currentTable) break;
    const nextTableId = currentTable.daisyNextId;
    if (!nextTableId) break;
    const moved = moveFromTable(nextTableId, currentTableId);
    if (!moved) break;
    currentTableId = nextTableId;
  }

  const lastTable = state.tables.find((t) => t.id === currentTableId);
  if (lastTable) {
    fillFromWaitingList(lastTable.id);
  }
}

function cascadeFeeder(tableId) {
  const targetTable = state.tables.find((t) => t.id === tableId);
  if (!targetTable) return;
  if (!targetTable.feederTableId) return;
  const feederTable = state.tables.find(
    (t) => t.id === targetTable.feederTableId
  );
  if (!feederTable) return;
  const moved = moveFromTable(feederTable.id, targetTable.id);
  if (moved) {
    fillFromWaitingList(feederTable.id);
  }
}

function tryTransferOverride(tableId) {
  const entry = state.transferList.find(
    (item) =>
      item.toTableId === tableId && item.status !== "skipped" && item.name
  );
  if (!entry) return false;
  const playerSeat = findSeatByName(entry.name, entry.fromTableId);
  if (!playerSeat) return false;
  const targetTable = state.tables.find((t) => t.id === tableId);
  if (!targetTable) return false;
  const openSeatIndex = targetTable.seats.findIndex((s) => !s.player);
  if (openSeatIndex === -1) return false;

  const { table: fromTable, seatIndex } = playerSeat;
  targetTable.seats[openSeatIndex].player = fromTable.seats[seatIndex].player;
  fromTable.seats[seatIndex].player = null;
  moveSeatToBottom(fromTable, seatIndex);
  markSeatMove(targetTable.id, openSeatIndex);
  entry.status = "moved";
  return true;
}

function moveFromTable(sourceTableId, targetTableId) {
  const sourceTable = state.tables.find((t) => t.id === sourceTableId);
  const targetTable = state.tables.find((t) => t.id === targetTableId);
  if (!sourceTable || !targetTable) return false;
  const candidateIndex = sourceTable.priorityOrder.find((index) => {
    const seat = sourceTable.seats[index];
    return seat && seat.player && !seat.hold;
  });
  if (candidateIndex === undefined) return false;
  const openSeatIndex = targetTable.seats.findIndex((seat) => !seat.player);
  if (openSeatIndex === -1) return false;
  targetTable.seats[openSeatIndex].player =
    sourceTable.seats[candidateIndex].player;
  sourceTable.seats[candidateIndex].player = null;
  moveSeatToBottom(sourceTable, candidateIndex);
  markSeatMove(targetTable.id, openSeatIndex);
  return true;
}

function fillFromWaitingList(tableId) {
  const table = state.tables.find((t) => t.id === tableId);
  if (!table) return;
  const openSeatIndex = table.seats.findIndex((seat) => !seat.player);
  if (openSeatIndex === -1) return;
  const entry = state.waitingList.shift();
  if (!entry || !entry.name) return;
  table.seats[openSeatIndex].player = { name: entry.name, description: "" };
  // Waiting list seats should always go to the bottom of the priority order.
  moveSeatToBottom(table, openSeatIndex);
  markSeatMove(table.id, openSeatIndex);
}

function addTransferEntry(tableId, seatIndex) {
  const table = state.tables.find((t) => t.id === tableId);
  if (!table) return;
  const seat = table.seats[seatIndex];
  if (!seat.player) return;
  state.transferList.push({
    id: getUUID(),
    name: seat.player.name,
    fromTableId: tableId,
    toTableId: null,
    status: "active",
  });
  saveState();
  renderTransferList();
}

function findSeatByName(name, tableId) {
  const searchTables = tableId
    ? state.tables.filter((t) => t.id === tableId)
    : state.tables;
  for (const table of searchTables) {
    const seatIndex = table.seats.findIndex(
      (seat) => seat.player?.name === name
    );
    if (seatIndex !== -1) {
      return { table, seatIndex };
    }
  }
  return null;
}

function fillTableSelect(select, excludeId, selectedId) {
  select.innerHTML = "";
  const blank = document.createElement("option");
  blank.value = "";
  blank.textContent = "None";
  select.appendChild(blank);
  state.tables
    .filter((table) => table.id !== excludeId)
    .forEach((table) => {
      const option = document.createElement("option");
      option.value = table.id;
      option.textContent = table.name;
      if (table.id === selectedId) option.selected = true;
      select.appendChild(option);
    });
}

function movePriority(table, index, direction) {
  const swapIndex = index + direction;
  if (swapIndex < 0 || swapIndex >= table.priorityOrder.length) return;
  const copy = [...table.priorityOrder];
  [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  table.priorityOrder = copy;
  saveState();
  if (state.tableModalOpen) {
    renderTableModal();
  } else {
    renderEditor();
  }
}

function createMoveBtn(index, direction, list) {
  const btn = document.createElement("button");
  btn.textContent = direction < 0 ? "Up" : "Down";
  btn.disabled =
    (direction < 0 && index === 0) ||
    (direction > 0 && index === list.length - 1);
  btn.addEventListener("click", () => {
    const swapIndex = index + direction;
    [list[index], list[swapIndex]] = [list[swapIndex], list[index]];
    saveState();
    render();
  });
  return btn;
}

function cleanupLinks(removedId) {
  state.tables.forEach((table) => {
    if (table.daisyNextId === removedId) table.daisyNextId = null;
    if (table.feederTableId === removedId) table.feederTableId = null;
  });
}

function labelForType(type) {
  if (type === "mm") return state.settings.mode === "daisy" ? "Must Move" : "Feeder";
  if (type === "feeder") return "Feeder";
  return "Main Game";
}

function titleCase(value) {
  return value
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function capitalizeFirst(value) {
  if (!value) return "";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function moveSeatToBottom(table, seatIndex) {
  table.priorityOrder = table.priorityOrder.filter((index) => index !== seatIndex);
  table.priorityOrder.push(seatIndex);
}

function getUUID() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function openSeatEditor(tableId, seatIndex) {
  state.selectedTableId = tableId;
  state.selectedSeatIndex = seatIndex;
  state.modalOpen = true;
  state.tableModalOpen = false;
  saveState();
  render();
}

function closeSeatModal() {
  state.selectedSeatIndex = null;
  state.modalOpen = false;
  saveState();
  render();
}

function renderSeatModal() {
  if (!seatModal) return;
  if (!state.modalOpen) {
    seatModal.hidden = true;
    return;
  }
  const table = state.tables.find((t) => t.id === state.selectedTableId);
  if (!table || state.selectedSeatIndex == null) {
    seatModal.hidden = true;
    return;
  }
  const seat = table.seats[state.selectedSeatIndex];
  if (!seat) {
    seatModal.hidden = true;
    return;
  }

  seatModal.hidden = false;
  seatModalTitle.textContent = `${table.name} · Seat ${seat.seatNumber}`;
  seatModalName.value = seat.player?.name ?? "";
  seatModalName.spellcheck = true;
  seatModalNumber.value = seat.seatNumber;
  seatModalNumber.max = String(table.seatsCount);
  seatModalNumber.inputMode = "numeric";
  seatModalHold.textContent = seat.hold ? "Hold" : "Ready";
  seatModalHold.className = seat.hold ? "secondary" : "";
  seatModalTransfer.disabled = state.settings.mode === "daisy" || !seat.player;
  const priorityIndex = table.priorityOrder.indexOf(state.selectedSeatIndex);
  seatModalPriority.textContent =
    priorityIndex >= 0 ? `Priority: ${priorityIndex + 1}` : "Priority: -";

  requestAnimationFrame(() => {
    seatModalName.focus();
  });

  seatModalClose.onclick = () => {
    closeSeatModal();
  };

  seatModalHold.onclick = () => {
    seat.hold = !seat.hold;
    saveState();
    renderSeatModal();
  };

  seatModalTransfer.onclick = () => {
    addTransferEntry(table.id, state.selectedSeatIndex);
    renderSeatModal();
  };

  seatModalRemove.onclick = () => {
    openSeat(table.id, state.selectedSeatIndex);
    state.selectedSeatIndex = null;
    saveState();
    render();
  };

  seatModalSave.onclick = () => {
    addToHistory();
    const nameValue = titleCase(seatModalName.value.trim());
    const hadPlayer = Boolean(seat.player);
    const oldSeatNumber = seat.seatNumber;
    
    if (!nameValue) {
      if (hadPlayer) {
        seat.player = null;
        moveSeatToBottom(table, state.selectedSeatIndex);
      }
    } else {
      seat.player = seat.player ?? { name: "", description: "" };
      seat.player.name = nameValue;
      if (!hadPlayer) {
        moveSeatToBottom(table, state.selectedSeatIndex);
      }
    }
    const parsed = Number(seatModalNumber.value || 0);
    const clamped = clampSeatNumber(parsed, table.seatsCount);
    seat.seatNumber = clamped;
    state.selectedSeatIndex = null;
    state.modalOpen = false;
    saveState();
    render();
  };

  seatModalNumber.onfocus = () => {
    setCaretToEnd(seatModalNumber);
  };
}

function renderTableModal() {
  if (!tableModal) return;
  if (!state.tableModalOpen) {
    tableModal.hidden = true;
    return;
  }
  const table = state.tables.find((t) => t.id === state.selectedTableId);
  if (!table) {
    tableModal.hidden = true;
    return;
  }
  tableModal.hidden = false;
  tableModalTitle.textContent = `${table.name} · Table Editor`;
  tableModalContent.innerHTML = "";
  const editor = buildTableEditor(table);
  tableModalContent.appendChild(editor);
}

function openTableEditor(tableId) {
  state.selectedTableId = tableId;
  state.selectedSeatIndex = null;
  state.modalOpen = false;
  state.tableModalOpen = true;
  saveState();
  render();
}

function closeTableEditor() {
  state.tableModalOpen = false;
  saveState();
  render();
}

if (tableModal) {
  tableModal.addEventListener("click", (event) => {
    if (event.target === tableModal) {
      closeTableEditor();
    }
  });
}
if (tableModalClose) {
  tableModalClose.addEventListener("click", closeTableEditor);
}

function promotePreviousMustMove() {
  const existingMm = state.tables.findLast((table) => table.type === "mm");
  if (existingMm) {
    existingMm.type = "main";
  }
}

function normalizeDaisyTypes() {
  if (state.tables.length === 0) return;
  const lastIndex = state.tables.length - 1;
  state.tables.forEach((table, index) => {
    if (index === lastIndex) {
      table.type = "mm";
      table.daisyNextId = null;
    } else {
      table.type = "main";
      table.daisyNextId = state.tables[index + 1].id;
    }
  });
}

function normalizeFeederTypes() {
  state.tables.forEach((table) => {
    if (table.type === "mm") {
      table.type = "feeder";
    }
  });
}

function normalizeTypeOptions(select) {
  const options = Array.from(select.options);
  options.forEach((option) => {
    if (option.value === "mm") {
      option.hidden = state.settings.mode !== "daisy";
      option.disabled = state.settings.mode !== "daisy";
    }
    if (option.value === "feeder") {
      option.hidden = state.settings.mode === "daisy";
      option.disabled = state.settings.mode === "daisy";
    }
  });
}

function clampSeatNumber(value, max) {
  if (!Number.isFinite(value)) return 0;
  if (value < 1) return 1;
  if (value > max) return max;
  return value;
}

function isSeatNumberValid(value, max) {
  return Number.isFinite(value) && value >= 1 && value <= max;
}

function sortPriorityBySeatNumber(table) {
  table.priorityOrder = table.priorityOrder
    .slice()
    .sort((a, b) => table.seats[a].seatNumber - table.seats[b].seatNumber);
}

function markSeatMove(tableId, seatIndex) {
  recentMoves.push({ tableId, seatIndex, time: Date.now() });
  recentMoves = recentMoves.filter((move) => Date.now() - move.time < 6000);
}

function isSeatRecentlyMoved(tableId, seatIndex) {
  return recentMoves.some(
    (move) => move.tableId === tableId && move.seatIndex === seatIndex
  );
}

function setCaretToEnd(input) {
  if (!input || input.type === "number") return;
  const length = input.value.length;
  input.setSelectionRange(length, length);
}

function buildTableEditor(table) {
  const template = document.getElementById("editorTemplate");
  const editor = template.content.cloneNode(true);
  const root = editor.querySelector(".editor");

  const nameInput = root.querySelector(".table-name-input");
  nameInput.value = table.name;
  nameInput.spellcheck = true;
  nameInput.addEventListener("input", (event) => {
    table.name = titleCase(event.target.value.trim());
    saveState();
    renderTables();
    if (tableModalTitle) {
      tableModalTitle.textContent = `${table.name} · Table Editor`;
    }
  });

  const typeInput = root.querySelector(".table-type-input");
  typeInput.value = table.type;
  normalizeTypeOptions(typeInput);
  typeInput.addEventListener("change", (event) => {
    table.type = event.target.value;
    saveState();
    render();
  });

  const seatCountInput = root.querySelector(".seat-count-input");
  seatCountInput.value = table.seatsCount;
  seatCountInput.addEventListener("change", (event) => {
    const newCount = Number(event.target.value);
    resizeSeats(table, newCount);
    saveState();
    render();
  });

  const labelColorInput = root.querySelector(".label-color-input");
  const seatFullInput = root.querySelector(".seat-full-color-input");
  const seatEmptyInput = root.querySelector(".seat-empty-color-input");
  labelColorInput.value = table.colors.label;
  seatFullInput.value = table.colors.seatFull;
  seatEmptyInput.value = table.colors.seatEmpty;

  labelColorInput.addEventListener("input", (event) => {
    table.colors.label = event.target.value;
    saveState();
    renderTables();
  });
  seatFullInput.addEventListener("input", (event) => {
    table.colors.seatFull = event.target.value;
    saveState();
    renderTables();
  });
  seatEmptyInput.addEventListener("input", (event) => {
    table.colors.seatEmpty = event.target.value;
    saveState();
    renderTables();
  });

  const daisySelect = root.querySelector(".daisy-next-input");
  const feederSelect = root.querySelector(".feeder-input");
  const daisyRow = root.querySelector(".daisy-link");
  const feederRow = root.querySelector(".feeder-link");

  if (state.settings.mode === "daisy") {
    if (table.type === "main") {
      daisyRow.style.display = "none";
    } else {
      daisyRow.style.display = "block";
      fillTableSelect(daisySelect, table.id, table.daisyNextId);
      daisySelect.addEventListener("change", (event) => {
        table.daisyNextId = event.target.value || null;
        saveState();
      });
    }
    feederRow.style.display = "none";
  } else {
    daisyRow.style.display = "none";
    feederRow.style.display = "block";
    fillTableSelect(feederSelect, table.id, table.feederTableId);
    feederSelect.addEventListener("change", (event) => {
      table.feederTableId = event.target.value || null;
      saveState();
    });
  }

  const seatList = root.querySelector(".seat-list");
  const duplicates = findDuplicateSeatNumbers(table.seats);
  table.seats.forEach((seat, index) => {
    const row = document.createElement("div");
    row.className = "seat-row";

    const nameInput = document.createElement("input");
    nameInput.placeholder = "Player name";
    nameInput.value = seat.player?.name ?? "";
    nameInput.spellcheck = true;
    nameInput.addEventListener("blur", () => {
      const value = titleCase(nameInput.value.trim());
      const hadPlayer = Boolean(seat.player);
      nameInput.value = value;
      if (!value) {
        if (hadPlayer) {
          openSeat(table.id, index);
        }
        return;
      }
      seat.player = seat.player ?? { name: "", description: "" };
      seat.player.name = value;
      if (!hadPlayer) {
        moveSeatToBottom(table, index);
      }
      saveState();
      renderTables();
      renderTransferList();
    });

    const seatInput = document.createElement("input");
    seatInput.className = "seat-number";
    seatInput.type = "number";
    seatInput.min = "1";
    seatInput.max = String(table.seatsCount);
    seatInput.inputMode = "numeric";
    seatInput.value = seat.seatNumber;
    if (duplicates.has(seat.seatNumber)) {
      seatInput.classList.add("duplicate");
    }
    seatInput.addEventListener("focus", () => setCaretToEnd(seatInput));
    seatInput.addEventListener("change", () => {
      const parsed = Number(seatInput.value || 0);
      const clamped = clampSeatNumber(parsed, table.seatsCount);
      seat.seatNumber = clamped;
      seatInput.value = clamped || "";
      saveState();
      render();
    });

    const holdToggle = document.createElement("button");
    holdToggle.textContent = seat.hold ? "Hold" : "Ready";
    holdToggle.className = seat.hold ? "secondary" : "";
    holdToggle.addEventListener("click", () => {
      seat.hold = !seat.hold;
      saveState();
      renderTableModal();
    });

    const actions = document.createElement("div");
    actions.className = "seat-actions";
    const openBtn = document.createElement("button");
    openBtn.textContent = "Open Seat";
    openBtn.addEventListener("click", () => {
      openSeat(table.id, index);
    });

    const transferBtn = document.createElement("button");
    transferBtn.textContent = "Transfer";
    transferBtn.className = "secondary";
    transferBtn.disabled = !seat.player || state.settings.mode === "daisy";
    transferBtn.addEventListener("click", () => {
      addTransferEntry(table.id, index);
    });

    actions.append(openBtn, transferBtn);
    row.append(nameInput, seatInput, holdToggle, actions);

    const flag = document.createElement("div");
    flag.className = "seat-flag";
    if (duplicates.has(seat.seatNumber)) {
      flag.textContent = "Duplicate seat #";
    }
    if (!isSeatNumberValid(seat.seatNumber, table.seatsCount)) {
      flag.textContent = "Out of range";
      seatInput.classList.add("duplicate");
    }
    row.appendChild(flag);

    seatList.appendChild(row);
  });

  const priorityList = root.querySelector(".priority-list");
  if (table.type === "main") {
    const note = document.createElement("p");
    note.className = "hint";
    note.textContent = "Main Game tables do not use priority order.";
    priorityList.appendChild(note);
  } else {
    table.priorityOrder.forEach((seatIndex, orderIndex) => {
      const seat = table.seats[seatIndex];
      const item = document.createElement("div");
      item.className = "priority-item";
      const label = document.createElement("span");
      label.textContent = `${orderIndex + 1}. Seat ${
        seat?.seatNumber ?? "?"
      } ${seat?.player?.name ? `- ${seat.player.name}` : ""}`;
      const upBtn = document.createElement("button");
      upBtn.textContent = "Up";
      upBtn.disabled = orderIndex === 0;
      upBtn.addEventListener("click", () => {
        addToHistory();
        movePriority(table, orderIndex, -1);
        saveState();
        renderTableModal();
      });
      const downBtn = document.createElement("button");
      downBtn.textContent = "Down";
      downBtn.disabled = orderIndex === table.priorityOrder.length - 1;
      downBtn.addEventListener("click", () => {
        addToHistory();
        movePriority(table, orderIndex, 1);
        saveState();
        renderTableModal();
      });
    item.append(label, upBtn, downBtn);
    priorityList.appendChild(item);
  });

    const resetBtn = document.createElement("button");
    resetBtn.textContent = "Reset Priority (1..N)";
    resetBtn.className = "secondary";
    resetBtn.addEventListener("click", () => {
      addToHistory();
      sortPriorityBySeatNumber(table);
      saveState();
      renderTableModal();
    });
    priorityList.appendChild(resetBtn);
  }

  return root;
}

function findDuplicateSeatNumbers(seats) {
  const counts = new Map();
  seats.forEach((seat) => {
    counts.set(seat.seatNumber, (counts.get(seat.seatNumber) || 0) + 1);
  });
  return new Set(
    [...counts.entries()].filter(([, count]) => count > 1).map(([num]) => num)
  );
}

addToHistory();
startAutoSave();
function updateUndoRedoButtons() {
  if (undoBtn) undoBtn.disabled = historyIndex <= 0;
  if (redoBtn) redoBtn.disabled = historyIndex >= historyStack.length - 1;
}

addToHistory();
startAutoSave();
updateUndoRedoButtons();
render();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("./service-worker.js")
      .catch(() => {});
  });
}
