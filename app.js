"use strict";

// INITIALIZING HTML ELEMENTS
const $ = (selector, parent = document) =>
    parent.querySelector(selector);

const $$ = (selector, parent = document) =>
    [...parent.querySelectorAll(selector)];

const form = $("#task-form");
const modal = $("#task-modal");
const taskList = $("#task-list");

const STORAGE_KEY = "taskforge-tasks";
const DARK_KEY = "taskforge-dark-mode";
const PAGE_SIZE = 10;

let tasks = loadTasks();
let editingId = null;
let pendingDeleteId = null;
let lastDeleted = null;
let undoTimer;
let searchTimer;
let currentPage = 1;
let selectedTaskIds = new Set();
let formSnapshot = "";
let isDirty = false;
let draggedId = null;

// CREATE SAMPLE TASKS AND STORAGE

function createId() {
    return globalThis.crypto?.randomUUID?.() ||
        `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function loadTasks() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);

        if (saved !== null) {
            const parsed = JSON.parse(saved);

            if (Array.isArray(parsed)) {
                return parsed;
            }
        }
    } catch (error) {
        console.error("Error loading tasks:", error);
    }

    const titles = ["Complete JavaScript assignment", "Review HTML and CSS", "Practice DOM manipulation", "Study JavaScript functions", "Build a responsive layout", "Review array methods", "Practice event listeners", "Update project documentation", "Complete coding exercises", "Prepare for assessment"];

    return titles.map((title, index) => ({
        id: createId(),
        title,
        description: "Complete this task and review your progress.",
        priority: ["high", "medium", "low"][index % 3],
        category: ["study", "work", "personal"][index % 3],
        dueDate: new Date(
            Date.now() + (index + 1) * 86400000
        ).toISOString().slice(0, 10),
        createdAt: new Date().toISOString(),
        completed: false,
        order: index
    }));
}

function saveTasks() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}

function todayString() {
    const date = new Date();
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function formatDate(value) {
    if (!value) return "Not set";

    const date = new Date(`${value}T00:00:00`);

    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString();
}

function isOverdue(task) {
    return ( !task.completed && Boolean(task.dueDate) && task.dueDate < todayString());
}

// CREATE EXTRA INTERFACE ELEMENTS

function ensureExtraUI() {
    if (!$("#taskforge-pagination")) {
        const pagination = document.createElement("div");
        pagination.id = "taskforge-pagination";
        pagination.className =
            "mt-6 flex flex-wrap items-center justify-between gap-3";
        taskList.insertAdjacentElement("afterend", pagination);
    }

    if (!$("#taskforge-undo")) {
        const undo = document.createElement("div");
        undo.id = "taskforge-undo";
        undo.className ="fixed bottom-4 left-4 z-50 hidden items-center gap-3 rounded-lg bg-slate-900 px-4 py-3 text-white shadow-lg";

        const message = document.createElement("span");
        message.id = "taskforge-undo-message";

        const button = document.createElement("button");
        button.type = "button";
        button.textContent = "Undo";
        button.className = "font-semibold underline";
        button.addEventListener("click", undoDelete);
        undo.append(message, button);
        document.body.append(undo);
    }

    if (form && !$("#taskforge-unsaved")) {
        const warning = document.createElement("p");
        warning.id = "taskforge-unsaved";
        warning.textContent = "You have unsaved changes.";
        warning.className =
            "hidden text-sm font-medium text-amber-700";
        form.prepend(warning);
    }
}

// FILTER AND SORT TASKS

function getFilteredTasks() {
    const search = ($("#task-search")?.value || "")
        .trim()
        .toLowerCase();

    const status = $("#status-filter")?.value || "all";
    const priority = $("#priority-filter")?.value || "all";
    const category = $("#category-filter")?.value || "all";
    const sort = $("#sort-tasks")?.value || "newest";

    const filtered = tasks.filter(task => {
        const matchesSearch = [ task.title, task.description, task.category].some(value =>
            String(value || "").toLowerCase().includes(search)
        );

        let matchesStatus;

        switch (status) {
            case "completed":
                matchesStatus = task.completed;
                break;

            case "pending":
                matchesStatus = !task.completed;
                break;

            case "overdue":
                matchesStatus = isOverdue(task);
                break;

            default:
                matchesStatus = true;
        }

        return (
            matchesSearch &&
            matchesStatus &&
            (priority === "all" || task.priority === priority) &&
            (category === "all" || task.category === category)
        );
    });

    const priorityRank = { high: 3, medium: 2, low: 1};

    filtered.sort((a, b) => {
        switch (sort) {
            case "oldest":
                return new Date(a.createdAt) -
                    new Date(b.createdAt);

            case "az":
                return a.title.localeCompare(b.title);

            case "za":
                return b.title.localeCompare(a.title);

            case "highest-priority":
                return priorityRank[b.priority] -
                    priorityRank[a.priority];

            case "lowest-priority":
                return priorityRank[a.priority] -
                    priorityRank[b.priority];

            case "closest-due":
                return (a.dueDate || "9999-12-31").localeCompare(
                    b.dueDate || "9999-12-31"
                );

            case "furthest-due":
                return (b.dueDate || "").localeCompare(
                    a.dueDate || ""
                );

            case "newest":
            default:
                return new Date(b.createdAt) -
                    new Date(a.createdAt);
        }
    });

    return filtered;
}

// CREATE TASK ACTION BUTTONS

function makeButton(label, action, id, className) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.dataset.action = action;
    button.dataset.id = id;
    button.className = className;

    return button;
}

//DISPLAY TASKS AND UPDATE STATISTICS

function renderTasks() {
    ensureExtraUI();

    const filtered = getFilteredTasks();

    const totalPages = Math.max(
        1,
        Math.ceil(filtered.length / PAGE_SIZE)
    );

    currentPage = Math.min(currentPage, totalPages);

    const start = (currentPage - 1) * PAGE_SIZE;
    const visibleTasks = filtered.slice(
        start,
        start + PAGE_SIZE
    );

    const fragment = document.createDocumentFragment();

    visibleTasks.forEach(task => {
        const card = document.createElement("article");

        card.className =
            "task-card rounded-xl border border-slate-200 bg-white p-5 shadow-sm";
        card.dataset.id = task.id;
        card.draggable = true;

        const top = document.createElement("div");
        top.className = "flex items-start gap-3";

        const complete = document.createElement("input");
        complete.type = "checkbox";
        complete.checked = Boolean(task.completed);
        complete.dataset.action = "complete";
        complete.dataset.id = task.id;
        complete.className = "mt-1 h-4 w-4 shrink-0";
        complete.setAttribute(
            "aria-label",
            `Mark ${task.title} completed`
        );

        const content = document.createElement("div");
        content.className = "min-w-0 flex-1";

        const title = document.createElement("h3");
        title.className = "text-lg font-semibold text-slate-900";
        title.textContent = task.title;

        if (task.completed) {
            title.classList.add("line-through", "text-slate-400");
        }

        const description = document.createElement("p");
        description.className = "mt-2 text-sm text-slate-500";
        description.textContent = task.description;

        const info = document.createElement("p");
        info.className = "mt-3 text-sm text-slate-600";
        info.textContent =
            `${task.category} · ${task.priority} priority · Due ${formatDate(task.dueDate)}`;

        const created = document.createElement("p");
        created.className = "mt-1 text-xs text-slate-400";
        created.textContent =
            `Created ${new Date(task.createdAt).toLocaleDateString()}`;

        const status = document.createElement("p");
        status.className = "mt-2 text-xs font-semibold";

        switch (true) {
            case task.completed:
                status.textContent = "Completed";
                status.classList.add("text-green-700");
                break;

            case isOverdue(task):
                status.textContent = "Overdue";
                status.classList.add("text-red-600");
                break;

            default:
                status.textContent = "Pending";
                status.classList.add("text-amber-700");
        }

        content.append(title, description, info, created, status);

        const selectLabel = document.createElement("label");
        selectLabel.className =
            "ml-auto flex items-center gap-2 text-xs text-slate-500";

        const select = document.createElement("input");
        select.type = "checkbox";
        select.dataset.action = "select";
        select.dataset.id = task.id;
        select.checked = selectedTaskIds.has(task.id);
        select.setAttribute("aria-label", `Select ${task.title}`);

        selectLabel.append(
            select,
            document.createTextNode("Select")
        );

        top.append(complete, content, selectLabel);

        const actions = document.createElement("div");
        actions.className = "mt-4 flex flex-wrap gap-2";

        actions.append(
            makeButton( "Details", "details", task.id, "rounded-md border px-3 py-2 text-sm"),
            makeButton( "Edit", "edit", task.id, "rounded-md border px-3 py-2 text-sm"),
            makeButton( "Delete", "delete", task.id, "rounded-md border border-red-200 px-3 py-2 text-sm text-red-600")
        );

        card.append(top, actions);
        fragment.append(card);
    });

    taskList.replaceChildren(fragment);

    if ($("#task-count")) {
        $("#task-count").textContent =
            `${filtered.length} task${filtered.length === 1 ? "" : "s"}`;
    }

    $("#empty-state")?.classList.toggle(
        "hidden",
        filtered.length > 0
    );

    const statistics = [
        tasks.length,
        tasks.filter(task => task.completed).length,
        tasks.filter(task => !task.completed).length,
        tasks.filter(isOverdue).length
    ];

    $$('[aria-label="Task statistics"] article p:last-child')
        .forEach((element, index) => {
            if (statistics[index] !== undefined) {
                element.textContent = statistics[index];
            }
        });

    updateBulkUI();
    renderPagination(filtered.length, totalPages);
    saveTasks();
}

// BULK SELECTION AND PAGINATION

function updateBulkUI() {
    const bulk = $("#bulk-actions");

    if (!bulk) return;

    bulk.classList.toggle("hidden", selectedTaskIds.size === 0);

    if ($("#selected-count")) {
        $("#selected-count").textContent = selectedTaskIds.size;
    }

    const visibleTasks = getFilteredTasks().slice(
        (currentPage - 1) * PAGE_SIZE,
        currentPage * PAGE_SIZE
    );

    const selectAll = $("#select-all-tasks");

    if (selectAll) {
        selectAll.checked =
            visibleTasks.length > 0 &&
            visibleTasks.every(task =>
                selectedTaskIds.has(task.id)
            );

        selectAll.indeterminate =
            visibleTasks.some(task =>
                selectedTaskIds.has(task.id)
            ) && !selectAll.checked;
    }
}

function renderPagination(total, totalPages) {
    const pagination = $("#taskforge-pagination");

    if (!pagination) return;

    pagination.replaceChildren();

    const summary = document.createElement("p");
    summary.className = "text-sm text-slate-500";
    summary.textContent = total
        ? `Page ${currentPage} of ${totalPages} · ${total} tasks`
        : "No tasks to display";

    const controls = document.createElement("div");
    controls.className = "flex gap-2";

    const previous = document.createElement("button");
    previous.type = "button";
    previous.textContent = "Previous";
    previous.disabled = currentPage <= 1;
    previous.className ="rounded-md border px-3 py-2 text-sm disabled:opacity-40";
    previous.addEventListener("click", () => {
        currentPage--;
        renderTasks();
    });

    const next = document.createElement("button");
    next.type = "button";
    next.textContent = "Next";
    next.disabled = currentPage >= totalPages;
    next.className ="rounded-md border px-3 py-2 text-sm disabled:opacity-40";

    next.addEventListener("click", () => {
        currentPage++;
        renderTasks();
    });

    controls.append(previous, next);
    pagination.append(summary, controls);
}

// ADD AND EDIT TASK MODAL

function openTaskModal(task = null) {
    editingId = task ? task.id : null;

    form.reset();
    $("#form-errors")?.classList.add("hidden");
    $("#form-error-list")?.replaceChildren();

    $("#modal-title").textContent = task
        ? "Edit Task"
        : "Add New Task";

    const submitButton = form.querySelector('[type="submit"]');

    if (submitButton) {
        submitButton.textContent = task
            ? "Save Changes"
            : "Create Task";
    }

    if (task) {
        $("#task-title").value = task.title;
        $("#task-description").value = task.description;
        $("#task-priority").value = task.priority;
        $("#task-category").value = task.category;
        $("#task-due-date").value = task.dueDate;
    }

    modal.classList.remove("hidden");
    modal.classList.add("flex");

    formSnapshot = new URLSearchParams(
        new FormData(form)
    ).toString();

    isDirty = false;
    $("#taskforge-unsaved")?.classList.add("hidden");

    $("#task-title").focus();
}

function closeTaskModal(force = false) {
    if (
        isDirty &&
        !force &&
        !confirm("Discard your unsaved changes?")
    ) {
        return;
    }

    modal.classList.add("hidden");
    modal.classList.remove("flex");

    isDirty = false;
    $("#taskforge-unsaved")?.classList.add("hidden");
}

$("#add-task-btn")?.addEventListener("click", () => {
    openTaskModal();
});

$("#close-task-modal")?.addEventListener("click", () => {
    closeTaskModal();
});

$("#cancel-task-modal")?.addEventListener("click", () => {
    closeTaskModal();
});

function updateDirtyState() {
    isDirty =
        new URLSearchParams(new FormData(form)).toString() !==
        formSnapshot;

    $("#taskforge-unsaved")?.classList.toggle(
        "hidden",
        !isDirty
    );
}

form?.addEventListener("input", updateDirtyState);
form?.addEventListener("change", updateDirtyState);

// 9. VALIDATE AND SAVE TASKS

form?.addEventListener("submit", event => {
    event.preventDefault();

    const title = $("#task-title").value.trim();
    const description = $("#task-description").value.trim();
    const priority = $("#task-priority").value;
    const category = $("#task-category").value;
    const dueDate = $("#task-due-date").value;

    const errors = [];

    if (title.length < 3) {
        errors.push("Title must be at least 3 characters.");
    }
    if (description.length < 10) {
        errors.push("Description must be at least 10 characters.");
    }
    if (!priority) {
        errors.push("Please select a priority.");
    }
    if (!category) {
        errors.push("Please select a category.");
    }
    if (!dueDate) {
        errors.push("Please choose a due date.");
    }
    $("#form-error-list").replaceChildren();
    if (errors.length > 0) {
        errors.forEach(message => {
            const item = document.createElement("li");
            item.textContent = message;
            $("#form-error-list").append(item);
        });

        $("#form-errors").classList.remove("hidden");
        return;
    }

    if (editingId) {
        const task = tasks.find(item => item.id === editingId);

        if (!task) return;

        Object.assign(task, {
            title,
            description,
            priority,
            category,
            dueDate
        });
    } else {
        tasks.push({
            id: createId(),
            title,
            description,
            priority,
            category,
            dueDate,
            createdAt: new Date().toISOString(),
            completed: false,
            order: tasks.length
        });
    }

    isDirty = false;
    closeTaskModal(true);
    form.reset();

    currentPage = 1;
    renderTasks();
});

// DELETE TASK AND UNDO

function openDeleteModal(id) {
    pendingDeleteId = id;

    if ($("#delete-modal")) {
        $("#delete-modal").classList.remove("hidden");
        $("#delete-modal").classList.add("flex");
    } else if (confirm("Delete this task?")) {
        deleteTask(id);
    }
}

function closeDeleteModal() {
    $("#delete-modal")?.classList.add("hidden");
    $("#delete-modal")?.classList.remove("flex");

    pendingDeleteId = null;
}

function deleteTask(id) {
    const index = tasks.findIndex(task => task.id === id);

    if (index === -1) return;

    lastDeleted = {
        task: tasks[index],
        index
    };

    tasks.splice(index, 1);
    selectedTaskIds.delete(id);

    showUndo("Task deleted.");
    renderTasks();
}

function showUndo(message) {
    $("#taskforge-undo-message").textContent = message;

    $("#taskforge-undo").classList.remove("hidden");
    $("#taskforge-undo").classList.add("flex");

    clearTimeout(undoTimer);

    undoTimer = setTimeout(() => {
        $("#taskforge-undo")?.classList.add("hidden");
        lastDeleted = null;
    }, 7000);
}

function undoDelete() {
    if (!lastDeleted) return;

    if (lastDeleted.bulk) {
        tasks.push(...lastDeleted.tasks);
    } else {
        tasks.splice(lastDeleted.index, 0, lastDeleted.task);
    }
    lastDeleted = null;

    clearTimeout(undoTimer);

    $("#taskforge-undo")?.classList.add("hidden");
    $("#taskforge-undo")?.classList.remove("flex");

    renderTasks();
}

$("#cancel-delete")?.addEventListener("click", closeDeleteModal);

$("#confirm-delete")?.addEventListener("click", () => {
    if (pendingDeleteId) {
        deleteTask(pendingDeleteId);
    }
    closeDeleteModal();
});

// TASK DETAILS

function showTaskDetails(task) {
    const details = {
        "#details-title": task.title,
        "#details-description": task.description,
        "#details-status": task.completed
            ? "Completed"
            : isOverdue(task)
                ? "Overdue"
                : "Pending",
        "#details-priority": task.priority,
        "#details-category": task.category,
        "#details-due-date": formatDate(task.dueDate),
        "#details-created-date":
            new Date(task.createdAt).toLocaleString()
    };

    Object.entries(details).forEach(([selector, value]) => {
        if ($(selector)) {
            $(selector).textContent = value;
        }
    });

    $("#details-modal")?.classList.remove("hidden");
    $("#details-modal")?.classList.add("flex");
}

function closeDetailsModal() {
    $("#details-modal")?.classList.add("hidden");
    $("#details-modal")?.classList.remove("flex");
}

$("#close-details-modal")?.addEventListener(
    "click",
    closeDetailsModal
);

$("#close-details-btn")?.addEventListener(
    "click",
    closeDetailsModal
);


// EVENT DELEGATION FOR TASK CARDS

taskList.addEventListener("click", event => {
    const button = event.target.closest("button[data-action]");

    if (!button) return;

    const task = tasks.find(
        item => item.id === button.dataset.id
    );

    if (!task) return;

    switch (button.dataset.action) {
        case "details":
            showTaskDetails(task);
            break;

        case "edit":
            openTaskModal(task);
            break;

        case "delete":
            openDeleteModal(task.id);
            break;

        default:
            break;
    }
});

taskList.addEventListener("change", event => {
    const control = event.target.closest("[data-action]");

    if (!control) return;

    const task = tasks.find(
        item => item.id === control.dataset.id
    );

    if (!task) return;

    switch (control.dataset.action) {
        case "complete":
            task.completed = control.checked;
            renderTasks();
            break;

        case "select":
            if (control.checked) {
                selectedTaskIds.add(task.id);
            } else {
                selectedTaskIds.delete(task.id);
            }

            updateBulkUI();
            break;

        default:
            break;
    }
});

//BULK TASK ACTIONS

$("#select-all-tasks")?.addEventListener("change", event => {
    const visibleTasks = getFilteredTasks().slice(
        (currentPage - 1) * PAGE_SIZE,
        currentPage * PAGE_SIZE
    );

    visibleTasks.forEach(task => {
        if (event.target.checked) {
            selectedTaskIds.add(task.id);
        } else {
            selectedTaskIds.delete(task.id);
        }
    });

    renderTasks();
});

$("#bulk-complete")?.addEventListener("click", () => {
    tasks.forEach(task => {
        if (selectedTaskIds.has(task.id)) {
            task.completed = true;
        }
    });

    selectedTaskIds.clear();
    renderTasks();
});

$("#bulk-pending")?.addEventListener("click", () => {
    tasks.forEach(task => {
        if (selectedTaskIds.has(task.id)) {
            task.completed = false;
        }
    });

    selectedTaskIds.clear();
    renderTasks();
});

$("#bulk-delete")?.addEventListener("click", () => {
    if (
        selectedTaskIds.size === 0 ||
        !confirm(`Delete ${selectedTaskIds.size} selected task(s)?`)
    ) {
        return;
    }

    const removed = tasks.filter(task =>
        selectedTaskIds.has(task.id)
    );

    lastDeleted = {
        bulk: true,
        tasks: removed
    };

    tasks = tasks.filter(task =>
        !selectedTaskIds.has(task.id)
    );

    selectedTaskIds.clear();

    showUndo(`${removed.length} tasks deleted.`);
    renderTasks();
});

//SEARCH, FILTER AND SORT CONTROLS

$("#task-search")?.addEventListener("input", () => {
    clearTimeout(searchTimer);

    searchTimer = setTimeout(() => {
        currentPage = 1;
        renderTasks();
    }, 250);
});

[
    "#status-filter",
    "#priority-filter",
    "#category-filter",
    "#sort-tasks"
].forEach(selector => {
    $(selector)?.addEventListener("change", () => {
        currentPage = 1;
        renderTasks();
    });
});

//DARK MODE

function setDarkMode(enabled) {
    document.documentElement.classList.toggle("dark", enabled);
    document.body.classList.toggle("dark", enabled);

    localStorage.setItem(DARK_KEY, String(enabled));

    $("#dark-mode-toggle")?.setAttribute(
        "aria-pressed",
        String(enabled)
    );
}

setDarkMode(localStorage.getItem(DARK_KEY) === "true");
$("#dark-mode-toggle")?.addEventListener("click", () => {
    const enabled =!document.documentElement.classList.contains("dark");
    setDarkMode(enabled);
});

// EXPORT TASKS AS JSON

$("#export-tasks")?.addEventListener("click", () => {
    const blob = new Blob(
        [JSON.stringify(tasks, null, 2)],
        { type: "application/json" }
    );

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "taskforge-tasks.json";
    closeDetailsModal();


    document.body.append(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);
});

// IMPORT TASKS FROM JSON

$("#import-tasks")?.addEventListener("click", () => {
    let input = $("#taskforge-import-file");

    if (!input) {
        input = document.createElement("input");

        input.id = "taskforge-import-file";
        input.type = "file";
        input.accept = ".json,application/json";
        input.className = "hidden";

        document.body.append(input);

        input.addEventListener("change", async () => {
            const file = input.files[0];

            if (!file) return;

            try {
                const data = JSON.parse(await file.text());
                if (!Array.isArray(data)) {
                    throw new Error(
                        "The file must contain an array of tasks."
                    );
                }
                const imported = data
                    .filter(task =>
                        task &&
                        typeof task.title === "string" &&
                        typeof task.description === "string"
                    )
                    .map(task => ({
                        id: createId(),
                        title: task.title,
                        description: task.description,
                        priority: ["high", "medium", "low"].includes(
                            task.priority
                        ) ? task.priority : "medium",
                        category: task.category || "personal",
                        dueDate: task.dueDate || todayString(),
                        createdAt: task.createdAt ||
                            new Date().toISOString(),
                        completed: Boolean(task.completed),
                        order: tasks.length
                    }));

                if (imported.length === 0) {
                    throw new Error("No valid tasks were found.");
                }

                if (confirm(`Import ${imported.length} tasks?`)) {
                    tasks.push(...imported);

                    currentPage = 1;
                    renderTasks();

                    alert(`${imported.length} tasks imported.`);
                }
            } catch (error) {
                alert(`Import failed: ${error.message}`);
            }

            input.value = "";
        });
    }
    input.click();
});

//DRAG AND DROP TASK REORDERING

taskList.addEventListener("dragstart", event => {
    const card = event.target.closest("article[data-id]");
    if (!card) return;
    draggedId = card.dataset.id;

    event.dataTransfer.setData("text/plain", draggedId);
    event.dataTransfer.effectAllowed = "move";
});

taskList.addEventListener("dragover", event => {
    if (event.target.closest("article[data-id]") && draggedId) {
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
    }
});

taskList.addEventListener("drop", event => {
    const target = event.target.closest("article[data-id]");

    if (
        !target ||
        !draggedId ||
        target.dataset.id === draggedId
    ) {
        return;
    }

    event.preventDefault();

    const from = tasks.findIndex(task => task.id === draggedId);
    const to = tasks.findIndex(task => task.id === target.dataset.id);

    if (from !== -1 && to !== -1) {
        const [movedTask] = tasks.splice(from, 1);

        tasks.splice(to, 0, movedTask);

        tasks.forEach((task, index) => {
            task.order = index;
        });
    }

    draggedId = null;
    renderTasks();
});

taskList.addEventListener("dragend", () => {
    draggedId = null;
});

// KEYBOARD SHORTCUTS

document.addEventListener("keydown", event => {
    const activeTag = document.activeElement?.tagName;

    const typing = [
        "INPUT",
        "TEXTAREA",
        "SELECT"
    ].includes(activeTag);

    switch (true) {
        case (
            event.key.toLowerCase() === "n" &&
            !typing &&
            !event.ctrlKey &&
            !event.metaKey
        ):
            event.preventDefault();
            openTaskModal();
            break;

        case event.key === "/" && !typing:
            event.preventDefault();
            $("#task-search")?.focus();
            break;

        case event.key === "Escape":
            if ( $("#details-modal") && !$("#details-modal").classList.contains("hidden")) {
                closeDetailsModal();
            } else if ( $("#delete-modal") && !$("#delete-modal").classList.contains("hidden")) {
                closeDeleteModal();
            } else if (modal &&!modal.classList.contains("hidden")) {
                closeTaskModal();
            }
            break;

        case (
            event.key === "Enter" &&
            (event.ctrlKey || event.metaKey) && modal && !modal.classList.contains("hidden")
        ):
            event.preventDefault();
            form.requestSubmit();
            break;

        default:
            break;
    }
});

ensureExtraUI();
renderTasks();