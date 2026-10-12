# TaskForge Dashboard

TaskForge is a task management dashboard built with HTML, CSS, and JavaScript. It allows users to create, organize, update, and delete tasks while tracking their progress through a dynamic dashboard.

## Features

- **Task Management:** Add, edit, delete, and manage tasks.
- **Task Status:** Mark tasks as completed or pending.
- **Task Priorities:** Organize tasks based on importance.
- **Deadline Tracking:** Monitor deadlines and identify overdue tasks.
- **Search and Filtering:** Find tasks and filter them based on relevant criteria.
- **Dynamic Statistics:** Update dashboard counts as tasks are added, completed, or deleted.
- **Data Persistence:** Save tasks in `localStorage` so they remain available after refreshing the page.
- **Responsive Design:** Adapt the interface to different screen sizes.

## JavaScript Implementation

### DOM Manipulation

JavaScript DOM methods are used to create and update the dashboard dynamically without manually adding each task to the HTML.

Key methods include i used:

- `document.querySelector()` and `document.querySelectorAll()` — Select HTML elements.
- `document.createElement()` — Create task elements dynamically.
- `element.append()` or `element.appendChild()` — Add elements to the page.
- `element.remove()` — Remove task elements from the DOM.
- `element.addEventListener()` — Handle user interactions.
- `element.classList.add()`, `remove()`, and `toggle()` — Manage CSS classes and task states.
- `element.textContent` — Update task information and dashboard statistics.

### Event Delegation

Event delegation is used to handle interactions with dynamically created task elements. Instead of attaching separate event listeners to every task or action button, a listener can be attached to a common parent element.

Using `event.target` and methods such as `closest()`, JavaScript identifies the specific button clicked and performs the appropriate action, such as editing, deleting, or completing a task.

This approach reduces unnecessary event listeners and makes it easier to manage dynamically added tasks.

### Task Management Logic

The application manages tasks through JavaScript logic that supports:

- Creating new tasks from user input.
- Updating existing task details.
- Changing task completion status.
- Deleting individual tasks.
- Searching and filtering tasks.
- Calculating task statistics, including total, completed, pending, and overdue tasks.

The dashboard updates its interface and statistics when task data changes, keeping the displayed information consistent with the current task list.

### Local Storage

TaskForge uses the browser's `localStorage` API to persist task data between page reloads.

- `localStorage.setItem()` — Save task data as a JSON string.
- `localStorage.getItem()` — Retrieve saved task data.
- `JSON.stringify()` — Convert task data into a string for storage.
- `JSON.parse()` — Convert stored JSON back into JavaScript data.

When the application loads, it retrieves previously saved tasks and renders them on the dashboard. Changes to the task list are saved to `localStorage`, allowing tasks to remain available when the page is refreshed or reopened in the same browser.

## Tech Stack

- HTML5
- Tailwind css V4.3
- JavaScript

## What I Learned

Building TaskForge strengthened my understanding of DOM manipulation, event delegation, event handling, array operations, dynamic rendering, and browser storage. It also provided practical experience in managing application state and keeping the user interface synchronized with task data.

**TaskForge — Organize tasks. Track progress. Stay productive.**
