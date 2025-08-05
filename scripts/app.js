// --- Persistent timer settings ---
const DEFAULT_TIME_KEY = "pyq_default_time";
const WARNING_TIME_KEY = "pyq_warning_time";

// Load from localStorage or use defaults
let DEFAULT_TIME = parseInt(localStorage.getItem(DEFAULT_TIME_KEY), 10);
if (isNaN(DEFAULT_TIME)) DEFAULT_TIME = 25;
let WARNING_TIME = parseInt(localStorage.getItem(WARNING_TIME_KEY), 10);
if (isNaN(WARNING_TIME)) WARNING_TIME = 10;

let questionNumber = 1;
let timer = 0;
let interval = null;
let results = [];
let testStarted = false;
let paused = false;
let markedQuestions = new Set();
let examName = `Test ${new Date().toISOString().slice(0, 10)}`;

// DOM elements
const timerMinutes = document.getElementById("timer-minutes");
const timerSeconds = document.getElementById("timer-seconds");
const questionSpan = document.getElementById("question-number");
const endTestBtn = document.getElementById("end-test");
const resultsBody = document.getElementById("results-body");
const resumeBtn = document.getElementById("resume-btn");
const skipBtn = document.getElementById("skip-btn");
const nextBtn = document.getElementById("next-btn");
const resetBtn = document.getElementById("reset-btn");
const markBtn = document.getElementById("mark-btn");
const settingsBtn = document.getElementById("settings-btn");
const settingsMenu = document.getElementById("settings-menu");
const defaultTimeInput = document.getElementById("default-time-input");
const warningTimeInput = document.getElementById("warning-time-input");
const saveSettingsBtn = document.getElementById("save-settings-btn");
const timerControls = document.getElementById("timer-controls");

/**
 * Render a digit in the timer display.
 * @param {string|number} value - The value to display.
 * @param {string} containerId - The DOM element ID.
 * @param {boolean} [warning=false] - Whether to apply warning styling.
 */
function renderFlipDigit(value, containerId, warning = false) {
    const container = document.getElementById(containerId);
    container.innerHTML = `<div class="num">${value}</div>`;
    if (warning) {
        container.classList.add("warning");
    } else {
        container.classList.remove("warning");
    }
}

/**
 * Update the timer display with the current timer value.
 */
function updateTimerDisplay() {
    const min = String(Math.floor(timer / 60)).padStart(2, "0");
    const sec = String(timer % 60).padStart(2, "0");
    document.getElementById("timer-minutes").textContent = min;
    document.getElementById("timer-seconds").textContent = sec;
    const warning = timer >= DEFAULT_TIME - WARNING_TIME && timer < DEFAULT_TIME;
    const timerDisplay = document.getElementById("timer-display");
    if (warning) {
        timerDisplay.classList.add("warning");
    }
}

/**
 * Advance to the next question, log result, and reset timer.
 */
function nextQuestion() {
    if (!testStarted) return;
    stopTimer();
    results.push({
        number: questionNumber,
        time: timer,
        status: getStatus(timer),
        marked: markedQuestions.has(questionNumber),
        note: "",
    });
    markedQuestions.delete(questionNumber);
    addResultRow(results[results.length - 1]);
    questionNumber++;
    questionSpan.textContent = questionNumber;
    timer = 0;
    updateTimerDisplay();
    document.getElementById("timer-display").classList.remove("warning");
    updateMarkedButton();
    if (testStarted) startTimer();
    setResumeBtnState("pause");
}

/**
 * Skip the current question, log as skipped, and reset timer.
 */
function skipQuestion() {
    if (!testStarted) return;
    stopTimer();
    results.push({
        number: questionNumber,
        time: 0,
        status: getStatus(0),
        marked: markedQuestions.has(questionNumber),
        note: "",
    });
    markedQuestions.delete(questionNumber);
    addResultRow(results[results.length - 1]);
    questionNumber++;
    questionSpan.textContent = questionNumber;
    timer = 0;
    updateTimerDisplay();
    document.getElementById("timer-display").classList.remove("warning");
    updateMarkedButton();
    if (testStarted) startTimer();
    setResumeBtnState("pause");
}

/**
 * Show or hide test controls depending on running state.
 * @param {boolean} running
 */
function setTestControlsVisibility(running) {
    timerControls.style.display = running ? "" : "none";
    endTestBtn.style.display = running ? "" : "none";
}

/**
 * Show results, summary, and export options after test ends.
 */
function showResults() {
    stopTimer();
    if (testStarted && timer > 0) {
        results.push({
            number: questionNumber,
            time: timer,
            status: getStatus(timer),
            marked: markedQuestions.has(questionNumber),
            note: "",
        });
    }
    testStarted = false;
    timer = 0;
    updateTimerDisplay();
    resumeBtn.disabled = false;
    endTestBtn.disabled = true;
    document.getElementById("timer-display").classList.remove("warning");
    setResumeBtnState("restart");
    setTestControlsVisibility(false);
    resultsBody.innerHTML = "";
    for (let i = 0; i < results.length; i++) {
        addResultRow(results[i], false, true);
    }
    showExamNameEditor();
    if (results.length > 0) {
        saveTestToHistory();
    }
    showSummary();
    addCSVButton();
    let markedBtn = document.getElementById("marked-indicator-btn");
    if (markedBtn) markedBtn.remove();
}

/**
 * Show an editable exam name input above the summary.
 */
function showExamNameEditor() {
    let old = document.getElementById("exam-name-editor");
    if (old) old.remove();
    const container = document.createElement("div");
    container.id = "exam-name-editor";
    container.style.display = "flex";
    container.style.alignItems = "center";
    container.style.justifyContent = "center";
    container.style.gap = "12px";
    container.style.margin = "32px auto 0 auto";
    container.style.maxWidth = "600px";
    container.style.padding = "12px 0";
    container.style.borderRadius = "16px";
    container.style.background = "#f1f3f6";
    container.style.boxShadow = "4px 4px 12px #d1d9e6, -4px -4px 12px #ffffff";

    const label = document.createElement("span");
    label.textContent = "Exam Name:";
    label.style.fontWeight = "600";
    label.style.fontSize = "1.1rem";

    const input = document.createElement("input");
    input.type = "text";
    input.value = examName;
    input.style.fontSize = "1.1rem";
    input.style.padding = "8px 16px";
    input.style.borderRadius = "8px";
    input.style.border = "1px solid #e3e6ec";
    input.style.background = "#f8f6ff";
    input.style.width = "60%";

    input.addEventListener("input", () => {
        examName = input.value;
        let summaryTitle = document.querySelector(".summary-title");
        if (summaryTitle) summaryTitle.textContent = examName;
        if (testStarted || results.length > 0) {
            let summary = document.getElementById("test-summary");
            if (summary) {
                updateLastHistoryExamName(examName);
            }
        }
    });

    container.appendChild(label);
    container.appendChild(input);

    const app = document.getElementById("app");
    const summary = document.getElementById("test-summary");
    if (summary) {
        app.insertBefore(container, summary);
    } else {
        app.appendChild(container);
    }
}

/**
 * Update the last history entry's exam name in localStorage.
 * @param {string} newName
 */
function updateLastHistoryExamName(newName) {
    let history = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
    if (
        history.length > 0 &&
        results.length > 0 &&
        history[history.length - 1].results.length === results.length
    ) {
        history[history.length - 1].examName = newName;
        localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    }
}

/**
 * Save the current test to localStorage history.
 */
function saveTestToHistory() {
    const examNameEditor = document.getElementById("exam-name-editor");
    if (examNameEditor) {
        const input = examNameEditor.querySelector("input");
        if (input) examName = input.value;
    }
    const history = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
    const testData = {
        examName,
        date: new Date().toISOString(),
        results: JSON.parse(JSON.stringify(results)),
        defaultTime: DEFAULT_TIME,
        warningTime: WARNING_TIME,
    };
    history.push(testData);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    console.log("Saved test to history:", testData);
}

/**
 * Reset all state and UI to initial values.
 */
function resetAll() {
    stopTimer();
    timer = 0;
    questionNumber = 1;
    results = [];
    markedQuestions.clear();
    resultsBody.innerHTML = "";
    questionSpan.textContent = questionNumber;
    updateTimerDisplay();
    document.getElementById("timer-display").classList.remove("warning");
    resumeBtn.disabled = false;
    endTestBtn.disabled = false;
    setResumeBtnState("pause");
    setTestControlsVisibility(false);
    examName = `Test ${new Date().toISOString().slice(0, 10)}`;
    let summary = document.getElementById("test-summary");
    if (summary) summary.remove();
    let examNameEditor = document.getElementById("exam-name-editor");
    if (examNameEditor) {
        examNameEditor.querySelector("input").value = examName;
    }
    let examNameEditorContainer = document.getElementById("exam-name-editor");
    if (examNameEditorContainer) examNameEditorContainer.remove();
    resultsBody.innerHTML = "";
    let csvBtn = document.getElementById("download-csv-btn");
    if (csvBtn) csvBtn.remove();
    updateMarkedButton();
}

/**
 * Show the summary statistics after test ends.
 */
function showSummary() {
    let old = document.getElementById("test-summary");
    if (old) old.remove();

    const stats = [
        { label: "Total Questions", value: results.length },
        { label: "Total Time", value: results.reduce((sum, r) => sum + r.time, 0) },
        {
            label: "Average Time",
            value: results.length
                ? Math.floor(
                    results.reduce((sum, r) => sum + r.time, 0) / results.length
                )
                : 0,
        },
        { label: "Fastest Time", value: Math.min(...results.map((r) => r.time)) },
        { label: "Slowest Time", value: Math.max(...results.map((r) => r.time)) },
        {
            label: "Completed In Target Time",
            value: results.filter((r) => r.time <= DEFAULT_TIME).length,
        },
    ];

    const summary = document.createElement("div");
    summary.id = "test-summary";
    summary.className = "summary-container";
    summary.innerHTML = `
        <div class="summary-header">
            <span class="summary-title">${examName}</span>
            <span class="summary-dot">·</span>
            <span class="summary-date">Date: ${new Date()
            .toISOString()
            .slice(0, 10)}</span>
            <span class="summary-dot">·</span>
        </div>
        <div class="summary-grid">
            ${stats
            .map((stat) => createSummaryStat(stat.label, stat.value))
            .join("")}
        </div>
    `;
    const app = document.getElementById("app");
    const examNameEditor = document.getElementById("exam-name-editor");
    if (examNameEditor) {
        app.insertBefore(summary, examNameEditor.nextSibling);
    } else {
        const container = document.getElementById("summary-export-container");
        container.appendChild(summary);
    }
}

/**
 * Update the marked button UI.
 */
function updateMarkedButton() {
    markBtn.innerHTML = `<i class="fa-regular fa-bookmark"></i>`;
}

// Call updateMarkedButton on question change
function nextQuestion() {
    if (!testStarted) return;
    stopTimer();
    results.push({
        number: questionNumber,
        time: timer,
        status: getStatus(timer),
        marked: markedQuestions.has(questionNumber),
        note: "",
    });
    markedQuestions.delete(questionNumber);
    addResultRow(results[results.length - 1]);
    questionNumber++;
    questionSpan.textContent = questionNumber;
    timer = 0;
    updateTimerDisplay();
    document.getElementById("timer-display").classList.remove("warning");
    updateMarkedButton();
    // Fix: Only start timer if test is still running
    if (testStarted) startTimer();
    setResumeBtnState("pause");
}

function skipQuestion() {
    if (!testStarted) return;
    stopTimer();
    results.push({
        number: questionNumber,
        time: 0,
        status: getStatus(0),
        marked: markedQuestions.has(questionNumber),
        note: "",
    });
    markedQuestions.delete(questionNumber);
    addResultRow(results[results.length - 1]);
    questionNumber++;
    questionSpan.textContent = questionNumber;
    timer = 0;
    updateTimerDisplay();
    document.getElementById("timer-display").classList.remove("warning");
    updateMarkedButton();
    // Fix: Only start timer if test is still running
    if (testStarted) startTimer();
    setResumeBtnState("pause");
}

// Also call updateMarkedButton on resume/start/reset
resumeBtn.addEventListener("click", () => {
    if (!testStarted) {
        testStarted = true;
        resetAll();
        startTimer();
        setResumeBtnState("pause");
        setTestControlsVisibility(true);
    } else if (paused) {
        startTimer();
        setResumeBtnState("pause");
    } else {
        pauseTimer();
        setResumeBtnState("resume");
    }
    updateMarkedButton();
    // updateAllLiveStats();
});

/**
 * Start the timer interval.
 */
function startTimer() {
    if (interval) return;
    paused = false;
    interval = setInterval(() => {
        timer++;
        updateTimerDisplay();
    }, 1000);
    setResumeBtnState("pause");
}

/**
 * Stop the timer interval.
 */
function stopTimer() {
    clearInterval(interval);
    interval = null;
    paused = false;
}

/**
 * Pause the timer.
 */
function pauseTimer() {
    stopTimer();
    paused = true;
    setResumeBtnState("resume");
}

function resetAll() {
    stopTimer();
    timer = 0;
    questionNumber = 1;
    results = [];
    markedQuestions.clear();
    resultsBody.innerHTML = "";
    questionSpan.textContent = questionNumber;
    updateTimerDisplay();
    document.getElementById("timer-display").classList.remove("warning");
    resumeBtn.disabled = false;
    endTestBtn.disabled = false;
    setResumeBtnState("pause");
    setTestControlsVisibility(false);
    // Reset exam name
    examName = `Test ${new Date().toISOString().slice(0, 10)}`;
    // Hide Exam Summary
    let summary = document.getElementById("test-summary");
    if (summary) summary.remove();
    // Reset exam name editor
    let examNameEditor = document.getElementById("exam-name-editor");
    if (examNameEditor) {
        examNameEditor.querySelector("input").value = examName;
    }
    // Remove exam name editor
    let examNameEditorContainer = document.getElementById("exam-name-editor");
    if (examNameEditorContainer) examNameEditorContainer.remove();
    // Remove results body
    resultsBody.innerHTML = "";

    // Remove CSV download button
    let csvBtn = document.getElementById("download-csv-btn");
    if (csvBtn) csvBtn.remove();
    // Remove marked button
    updateMarkedButton();
}

function resetTimer() {
    timer = 0;
    updateTimerDisplay();
    document.getElementById("timer-display").classList.remove("warning");
    setResumeBtnState("pause");
}

/**
 * Keyboard shortcuts for timer actions.
 */
document.addEventListener("keydown", (e) => {
    const active = document.activeElement;
    if (
        active &&
        (active.tagName === "INPUT" ||
            active.tagName === "TEXTAREA" ||
            active.isContentEditable)
    ) {
        return;
    }
    if (e.key === "p" || e.key === "P") {
        e.preventDefault();
        if (!testStarted) {
            resumeBtn.click();
        } else if (paused) {
            startTimer();
        } else {
            pauseTimer();
        }
    }
    if (e.code === "Space" || e.key === " ") {
        e.preventDefault();
        if (!testStarted) {
            resumeBtn.click();
        } else {
            if (timer > 0) {
                nextQuestion();
            }
        }
    }
    if (
        (e.key === "r" || e.key === "R") &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey &&
        !e.shiftKey
    ) {
        e.preventDefault();
        resetTimer();
    }
    if (e.key === "s" || e.key === "S") {
        e.preventDefault();
        skipQuestion();
    }
    if (e.key === "e" || e.key === "E") {
        e.preventDefault();
        if (testStarted || results.length > 0) {
            showResults();
        }
    }
    if (e.key === "m" || e.key === "M") {
        e.preventDefault();
        if (testStarted) {
            markedQuestions.add(questionNumber);
            markBtn.innerHTML = `<i class="fa-solid fa-bookmark"></i>`;
        }
    }
});

settingsBtn.addEventListener("click", () => {
    settingsMenu.style.display =
        settingsMenu.style.display === "none" ? "" : "none";
});

saveSettingsBtn.addEventListener("click", () => {
    const newDefault = parseInt(defaultTimeInput.value, 10);
    const newWarning = parseInt(warningTimeInput.value, 10);
    if (!isNaN(newDefault)) {
        DEFAULT_TIME = newDefault;
        localStorage.setItem(DEFAULT_TIME_KEY, DEFAULT_TIME);
    }
    if (!isNaN(newWarning)) {
        WARNING_TIME = newWarning;
        localStorage.setItem(WARNING_TIME_KEY, WARNING_TIME);
    }
    settingsMenu.style.display = "none";
    // resetAll(); // Use correct reset function for full reset
});

// Add this to enable dark mode toggle
const darkModeToggle = document.getElementById("dark-mode-toggle");
if (darkModeToggle) {
    darkModeToggle.addEventListener("click", () => {
        document.body.classList.toggle("dark");
    });
}

window.onload = () => {
    if (defaultTimeInput) defaultTimeInput.value = DEFAULT_TIME;
    if (warningTimeInput) warningTimeInput.value = WARNING_TIME;
    resetAll();
    setResumeBtnState("start");
    setTestControlsVisibility(false);
};

/**
 * Get the status string for a given time.
 * @param {number} time
 * @returns {string}
 */
function getStatus(time) {
    if (time === 0) return "SKIPPED";
    if (time < DEFAULT_TIME - WARNING_TIME) return "FAST";
    if (time < DEFAULT_TIME) return "ONTIME";
    if (time === DEFAULT_TIME) return "ONTIME";
    if (time > DEFAULT_TIME) return "SLOW";
    return "SKIPPED";
}

/**
 * Play a beep sound.
 */
let audioContext = null;
function beep() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(523.25, audioContext.currentTime);
    gain.gain.setValueAtTime(0.2, audioContext.currentTime);
    osc.connect(gain);
    gain.connect(audioContext.destination);
    osc.start(audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(
        0.0001,
        audioContext.currentTime + 0.6
    );
    osc.stop(audioContext.currentTime + 0.6);
}

/**
 * Download the results as a CSV file.
 */
function downloadCSV() {
    let csv = "# Exam Name," + `"${(examName || "").replace(/"/g, '""')}"\n\n`;
    csv += "Question,Time (min:sec),Target (sec),Result,Marked,Note\n";
    results.forEach((r) => {
        csv += `${r.number},${String(Math.floor(r.time / 60)).padStart(
            2,
            "0"
        )}:${String(r.time % 60).padStart(2, "0")} min:sec,${DEFAULT_TIME} sec,${r.status
            },${r.marked ? "Yes" : ""},"${(r.note || "").replace(/"/g, '""')}"\n`;
    });
    // Add summary
    csv += "\n# SUMMARY\n";
    csv += `Total Questions,${results.length}\n`;
    let totalTime = results.reduce((sum, r) => sum + r.time, 0);
    csv += `Total Time,${String(Math.floor(totalTime / 60)).padStart(
        2,
        "0"
    )}:${String(totalTime % 60).padStart(2, "0")} min:sec\n`;
    let avgTime = results.length ? Math.floor(totalTime / results.length) : 0;
    csv += `Average Time,${String(Math.floor(avgTime / 60)).padStart(
        2,
        "0"
    )}:${String(avgTime % 60).padStart(2, "0")} min:sec\n`;
    let fastest = Math.min(...results.map((r) => r.time));
    let slowest = Math.max(...results.map((r) => r.time));
    csv += `Fastest Time,${String(Math.floor(fastest / 60)).padStart(
        2,
        "0"
    )}:${String(fastest % 60).padStart(2, "0")} min:sec\n`;
    csv += `Slowest Time,${String(Math.floor(slowest / 60)).padStart(
        2,
        "0"
    )}:${String(slowest % 60).padStart(2, "0")} min:sec\n`;
    let underTarget = results.filter((r) => r.time <= DEFAULT_TIME).length;
    csv += `Completed In Target Time,${underTarget}\n`;
    // Download
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `test_timer_log_${new Date().toISOString().slice(0, 10)}${examName || ""
        }.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

/**
 * Generate a Markdown table of the results.
 * @returns {string}
 */
function generateMarkdownTable() {
    let md = `# ${examName}\n\n`;
    md += `| # | Time (min:sec) | Target (sec) | Result | Marked | Note |\n`;
    md += `|---|---------------|-------------|--------|--------|------|\n`;
    results.forEach((r) => {
        md += `| ${r.number} | ${String(Math.floor(r.time / 60)).padStart(
            2,
            "0"
        )}:${String(r.time % 60).padStart(
            2,
            "0"
        )} min:sec | ${DEFAULT_TIME} sec | ${r.status} | ${r.marked ? "-[x]" : ""
            } | ${r.note ? r.note.replace(/\|/g, "\\|") : ""} |\n`;
    });
    // Add summary
    md += `\n**Total Questions:** ${results.length}\n`;
    let totalTime = results.reduce((sum, r) => sum + r.time, 0);
    md += `**Total Time:** ${String(Math.floor(totalTime / 60)).padStart(
        2,
        "0"
    )}:${String(totalTime % 60).padStart(2, "0")} min:sec\n`;
    let avgTime = results.length ? Math.floor(totalTime / results.length) : 0;
    md += `**Average Time:** ${String(Math.floor(avgTime / 60)).padStart(
        2,
        "0"
    )}:${String(avgTime % 60).padStart(2, "0")} min:sec\n`;
    let fastest = results.length ? Math.min(...results.map((r) => r.time)) : 0;
    let slowest = results.length ? Math.max(...results.map((r) => r.time)) : 0;
    md += `**Fastest Time:** ${String(Math.floor(fastest / 60)).padStart(
        2,
        "0"
    )}:${String(fastest % 60).padStart(2, "0")} min:sec\n`;
    md += `**Slowest Time:** ${String(Math.floor(slowest / 60)).padStart(
        2,
        "0"
    )}:${String(slowest % 60).padStart(2, "0")} min:sec\n`;
    let underTarget = results.filter((r) => r.time <= DEFAULT_TIME).length;
    md += `**Completed In Target Time:** ${underTarget}\n`;
    return md;
}

/**
 * Download the results as a Markdown file.
 */
function downloadMarkdown() {
    const md = generateMarkdownTable();
    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `test_timer_log_${new Date().toISOString().slice(0, 10)}${examName || ""
        }.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

/**
 * Copy the Markdown table to the clipboard.
 */
function copyMarkdownToClipboard() {
    const md = generateMarkdownTable();
    navigator.clipboard.writeText(md).then(() => {
        alert("Markdown copied to clipboard!");
    });
}

/**
 * Add CSV and Markdown download buttons to the summary export container.
 */
function addCSVButton() {
    // Remove previous buttons if any
    let oldBtn = document.getElementById("download-csv-btn");
    if (oldBtn) oldBtn.remove();
    let oldMdBtn = document.getElementById("download-md-btn");
    if (oldMdBtn) oldMdBtn.remove();
    let oldCopyMdBtn = document.getElementById("copy-md-btn");
    if (oldCopyMdBtn) oldCopyMdBtn.remove();
    let oldBtnRow = document.getElementById("export-btn-row");
    if (oldBtnRow) oldBtnRow.remove();

    // Create flex row for buttons
    const btnRow = document.createElement("div");
    btnRow.id = "export-btn-row";
    btnRow.className = "export-btn-row";

    const btn = document.createElement("button");
    btn.id = "download-csv-btn";
    btn.className = "btn btn-download";
    btn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1b7f3a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-right:8px;"><polyline points="8 17 12 21 16 17"></polyline><line x1="12" y1="12" x2="12" y2="21"></line><rect x="4" y="3" width="16" height="4" rx="2"></rect></svg>Download CSV`;
    btn.onclick = downloadCSV;

    const mdBtn = document.createElement("button");
    mdBtn.id = "download-md-btn";
    mdBtn.className = "btn btn-markdown";
    mdBtn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#34495e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-right:8px;"><rect x="2" y="4" width="20" height="16" rx="2"></rect><path d="M8 9v6M16 9v6M12 9v6"></path></svg>Export Markdown`;
    mdBtn.onclick = downloadMarkdown;

    const copyMdBtn = document.createElement("button");
    copyMdBtn.id = "copy-md-btn";
    copyMdBtn.className = "btn btn-markdown";
    copyMdBtn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#34495e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-right:8px;"><rect x="9" y="9" width="13" height="13" rx="2"></rect><rect x="2" y="2" width="13" height="13" rx="2"></rect></svg>Copy as Markdown`;
    copyMdBtn.onclick = copyMarkdownToClipboard;

    btnRow.appendChild(btn);
    btnRow.appendChild(mdBtn);
    btnRow.appendChild(copyMdBtn);

    const container = document.getElementById("summary-export-container");
    container.appendChild(btnRow);
}

/**
 * Create a summary stat element for the summary grid.
 * @param {string} label
 * @param {string|number} value
 * @returns {string}
 */
function createSummaryStat(label, value) {
    return `
        <div class="summary-stat">
            <div class="summary-label">${label}</div>
            <div class="summary-value">${value}</div>
        </div>
    `;
}

/**
 * Render live exam stats below the timer.
 */
function renderLiveStats() {
    // Remove previous live stats if any
    let old = document.getElementById("live-exam-stats");
    if (old) old.remove();

    // Calculate stats
    const stats = [
        { label: "Current Question", value: questionNumber },
        { label: "Questions Done", value: results.length },
        { label: "Total Time", value: results.reduce((sum, r) => sum + r.time, 0) },
        {
            label: "Average Time",
            value: results.length
                ? Math.floor(
                    results.reduce((sum, r) => sum + r.time, 0) / results.length
                )
                : 0,
        },
        { label: "Marked", value: Array.from(markedQuestions).length },
    ];

    // Create stats HTML
    const statsDiv = document.createElement("div");
    statsDiv.id = "live-exam-stats";
    statsDiv.className = "summary-container";
    statsDiv.style.marginTop = "0";
    statsDiv.style.marginBottom = "24px";
    statsDiv.innerHTML = `
        <div class="summary-header">
            <span class="summary-title">Exam Stats</span>
            <span class="summary-dot">·</span>
            <span class="summary-date">Date: ${new Date()
            .toISOString()
            .slice(0, 10)}</span>
        </div>
        <div class="summary-grid">
            ${stats
            .map((stat) => createSummaryStat(stat.label, stat.value))
            .join("")}
        </div>
    `;
    // Insert below timer-display
    const timerDisplay = document.getElementById("timer-display");
    if (timerDisplay) {
        timerDisplay.parentNode.insertBefore(statsDiv, timerDisplay.nextSibling);
    }
}

/**
 * Update all live stats.
 */
function updateAllLiveStats() {
    renderLiveStats();
}

/**
 * Add a result row to the results table.
 * @param {Object} result
 * @param {boolean} [prepend=true]
 * @param {boolean} [editableNote=false]
 */
function addResultRow(result, prepend = true, editableNote = false) {
    let resultClass = "";
    if (result.status === "FAST") resultClass = "result-fast";
    else if (result.status === "ONTIME") resultClass = "result-ontime";
    else if (result.status === "SLOW") resultClass = "result-slow";
    else if (result.status === "SKIPPED") resultClass = "result-skipped";

    const markedCellClass = result.marked ? "result-marked" : "";
    const markedIcon = result.marked
        ? `<svg width="20" height="20" viewBox="0 0 24 24" fill="#8e44ad" stroke="#8e44ad" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>`
        : "";

    // Note cell: editable after test ends, plain otherwise
    let noteCell = "";
    if (editableNote) {
        noteCell = `<td><input type="text" class="note-input" data-qnum="${result.number
            }" value="${result.note || ""
            }" style="width:80%;padding:4px 8px;border-radius:8px;border:1px solid #e3e6ec;background:#faf8ff;"></td>`;
    } else {
        noteCell = `<td>${result.note ? result.note : ""}</td>`;
    }

    const row = document.createElement("tr");
    row.innerHTML = `
        <td>${result.number}</td>
        <td>${String(Math.floor(result.time / 60)).padStart(2, "0")}:${String(
        result.time % 60
    ).padStart(2, "0")}</td>
        <td>${DEFAULT_TIME} (Target)</td>
        <td class="${resultClass}">${result.status.toUpperCase()}</td>
        <td class="${markedCellClass}" style="text-align:center;">${markedIcon}</td>
        ${noteCell}
    `;
    if (prepend) {
        resultsBody.insertBefore(row, resultsBody.firstChild);
    } else {
        resultsBody.appendChild(row);
    }
    beep();
}

resultsBody.addEventListener("input", function (e) {
    if (e.target.classList.contains("note-input")) {
        const qnum = parseInt(e.target.getAttribute("data-qnum"), 10);
        const result = results.find((r) => r.number === qnum);
        if (result) {
            result.note = e.target.value;
        }
    }
});

/**
 * Set the state and appearance of the resume button.
 * @param {string} state
 */
function setResumeBtnState(state) {
    // state: 'start', 'pause', 'resume', 'restart'
    if (state === "start") {
        resumeBtn.innerHTML = '<i class="fas fa-play me-2"></i> Start';
        resumeBtn.classList.remove("yellow");
        resumeBtn.classList.add("green");
        resumeBtn.disabled = false;
    } else if (state === "pause") {
        resumeBtn.innerHTML = '<i class="fas fa-pause"></i> Pause';
        resumeBtn.classList.remove("green");
        resumeBtn.classList.add("yellow");
        resumeBtn.disabled = false;
    } else if (state === "resume") {
        resumeBtn.innerHTML = '<i class="fas fa-clock"></i> Resume';
        resumeBtn.classList.remove("yellow");
        resumeBtn.classList.add("green");
        resumeBtn.disabled = false;
    } else if (state === "restart") {
        resumeBtn.innerHTML = '<i class="fas fa-star"></i> Start Another Timer';
        resumeBtn.classList.remove("yellow");
        resumeBtn.classList.add("green");
        resumeBtn.disabled = false;
    }
}

skipBtn.addEventListener("click", () => {
    skipQuestion();
});

nextBtn.addEventListener("click", () => {
    nextQuestion();
});

resetBtn.addEventListener("click", () => {
    resetTimer();
});

markBtn.addEventListener("click", () => {
    if (markedQuestions.has(questionNumber)) {
        markedQuestions.delete(questionNumber);
        markBtn.innerHTML = `<i class="fa-regular fa-bookmark"></i>`;
    } else {
        markedQuestions.add(questionNumber);
        markBtn.innerHTML = `<i class="fa-solid fa-bookmark"></i>`;
    }
});

endTestBtn.addEventListener("click", () => {
    if (testStarted || results.length > 0) {
        showResults();
    }
});

/**
 * Get the CSS class for a summary status.
 * @param {string} result
 * @returns {string}
 */
function getStatusClass(result) {
    if (result === "Success") return "summary-status status-success";
    if (result === "Fail") return "summary-status status-fail";
    if (result === "Warning") return "summary-status status-warning";
    return "summary-status";
}

/**
 * Render a summary row for the summary table.
 * @param {Object} q
 * @returns {string}
 */
function renderSummaryRow(q) {
    return `
        <tr>
            <td>${q.number}</td>
            <td>${q.time}</td>
            <td>${q.target}</td>
            <td><span class="${getStatusClass(q.result)}">${q.result
        }</span></td>
            <td>${q.marked ? "✔️" : ""}</td>
            <td>${q.note || ""}</td>
        </tr>
    `;
}

const HISTORY_KEY = "pyq_test_history";

/**
 * Save the current test to history in localStorage.
 */
function saveTestToHistory() {
    const examNameEditor = document.getElementById("exam-name-editor");
    if (examNameEditor) {
        const input = examNameEditor.querySelector("input");
        if (input) examName = input.value;
    }
    const history = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
    const testData = {
        examName,
        date: new Date().toISOString(),
        results: JSON.parse(JSON.stringify(results)),
        defaultTime: DEFAULT_TIME,
        warningTime: WARNING_TIME,
    };
    history.push(testData);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
}

/**
 * Show the history modal.
 */
function showHistoryModal() {
    const modal = document.getElementById("history-modal");
    const list = document.getElementById("history-list");
    list.innerHTML = renderHistoryList();
    modal.classList.add("show-modal");
    modal.classList.remove("hide-modal");
    if (modalBlurOverlay) {
        modalBlurOverlay.classList.add("show-modal");
        modalBlurOverlay.classList.remove("hide-modal");
    }
}

/**
 * Hide the history modal.
 */
function hideHistoryModal() {
    const modal = document.getElementById("history-modal");
    modal.classList.remove("show-modal");
    modal.classList.add("hide-modal");
    if (modalBlurOverlay) {
        modalBlurOverlay.classList.remove("show-modal");
        modalBlurOverlay.classList.add("hide-modal");
    }
}

/**
 * Render the HTML for the history list.
 * @returns {string}
 */
function renderHistoryList() {
    let history = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
    if (!history.length) {
        return '<div style="text-align:center;color:#888;">No past tests found.</div>';
    }
    function formatTimeSec(sec) {
        return `${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(
            sec % 60
        ).padStart(2, "0")} min:sec`;
    }
    let html = "";
    for (let idx = history.length - 1; idx >= 0; idx--) {
        const test = history[idx];
        const totalTime = test.results.reduce((sum, r) => sum + r.time, 0);
        const avgTime = test.results.length
            ? Math.floor(totalTime / test.results.length)
            : 0;
        const testId =
            test.testId !== undefined && test.testId !== null ? test.testId : "---";
        html += `
            <div class="history-card">
                <div style="display:flex;justify-content:space-between;align-items:center;">
                    <div>
                        <input 
                            type="text" 
                            value="${test.examName
                ? test.examName.replace(/"/g, "&quot;")
                : ""
            }" 
                            data-history-idx="${idx}" 
                            class="history-exam-name-input"
                            style="font-size:1.1rem;font-weight:600;padding:4px 10px;border-radius:8px;border:1px solid #e3e6ec;background:#f8f6ff;max-width:220px;"
                            title="Edit test name and press Enter or click outside to save"
                        />
                        <span style="color:#888;margin-left:12px;">${new Date(
                test.date
            ).toLocaleString()}</span>
                        <span style="color:#888;margin-left:12px;">ID: ${testId}</span>
                    </div>
                    <button class="btn btn-gray" style="border-radius:50%;padding:6px 8px;box-shadow:2px 2px 8px #d1d9e6, -2px -2px 8px #ffffff;" onclick="window.deleteHistoryEntry(${idx})" title="Delete">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
                <div style="margin-top:8px;">
                    <span>Total Questions: <b>${test.results.length
            }</b></span> |
                    <span>Total Time: <b>${formatTimeSec(
                totalTime
            )}</b></span> |
                    <span>Avg Time: <b>${formatTimeSec(avgTime)}</b></span>
                </div>
                <details style="margin-top:8px;">
                    <summary style="cursor:pointer;">Show Details</summary>
                    <table class="history-table">
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>Time (min:sec)</th>
                                <th>Target (sec)</th>
                                <th class="history-marked-cell">Marked</th>
                                <th>Result</th>
                                <th>Note</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${test.results
                .map(
                    (r) => `
                                <tr>
                                    <td>${r.number}</td>
                                    <td>${formatTimeSec(r.time)}</td>
                                    <td>${test.defaultTime} sec</td>
                                    <td class="history-marked-cell">
                                        ${r.marked
                            ? `
                                            <span class="history-marked-content">
                                                <svg width="20" height="20" viewBox="0 0 24 24" fill="#8e44ad" stroke="#8e44ad" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                                    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
                                                </svg>
                                                <span>Marked</span>
                                            </span>
                                        `
                            : ""
                        }
                                    </td>
                                    <td>${r.status}</td>
                                    <td>${r.note || ""}</td>
                                </tr>
                            `
                )
                .join("")}
                        </tbody>
                    </table>
                </details>
            </div>
        `;
    }
    return html;
}

/**
 * Delete a history entry by index.
 * @param {number} idx
 */
window.deleteHistoryEntry = function (idx) {
    const history = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
    if (history[idx]) {
        if (confirm("Delete this test history?")) {
            history.splice(idx, 1);
            localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
            document.getElementById("history-list").innerHTML = renderHistoryList();
        }
    }
};

// --- History button event listeners ---
document
    .getElementById("history-btn")
    .addEventListener("click", showHistoryModal);
document
    .getElementById("close-history-btn")
    .addEventListener("click", hideHistoryModal);

// --- Blur overlay logic for modal ---
const modalBlurOverlay = document.getElementById("modal-blur-overlay");
function showHistoryModal() {
    const modal = document.getElementById("history-modal");
    const list = document.getElementById("history-list");
    list.innerHTML = renderHistoryList();
    modal.classList.add("show-modal");
    modal.classList.remove("hide-modal");
    if (modalBlurOverlay) {
        modalBlurOverlay.classList.add("show-modal");
        modalBlurOverlay.classList.remove("hide-modal");
    }
}
function hideHistoryModal() {
    const modal = document.getElementById("history-modal");
    modal.classList.remove("show-modal");
    modal.classList.add("hide-modal");
    if (modalBlurOverlay) {
        modalBlurOverlay.classList.remove("show-modal");
        modalBlurOverlay.classList.add("hide-modal");
    }
}

document.addEventListener("input", function (e) {
    if (e.target.classList.contains("history-exam-name-input")) {
        const idx = parseInt(e.target.getAttribute("data-history-idx"), 10);
        let history = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
        if (history[idx]) {
            history[idx].examName = e.target.value;
            localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
        }
    }
});
document.addEventListener("change", function (e) {
    if (e.target.classList.contains("history-exam-name-input")) {
        const idx = parseInt(e.target.getAttribute("data-history-idx"), 10);
        let history = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
        if (history[idx]) {
            history[idx].examName = e.target.value;
            localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
        }
    }
});
document.addEventListener("keydown", function (e) {
    if (
        e.target.classList &&
        e.target.classList.contains("history-exam-name-input") &&
        (e.key === "Enter" || e.key === "Tab")
    ) {
        e.target.blur();
    }
});