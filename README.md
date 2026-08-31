# Budget Ledger

A lightweight web application for tracking monthly income, expenses, and remaining balance in a simple and intuitive way.
The app helps users manage their personal budget by month, review spending categories, and keep notes alongside financial entries.

## Features

- Add main income and extra income sources
- Track expenses by category and subcategory
- Enter notes manually or paste values from a phone
- View monthly totals and remaining balance automatically
- Switch easily between Hebrew and English interfaces
- Save budget data locally in the browser for quick access

## Tech Stack

- **Frontend:** HTML, CSS, JavaScript
- **UI Library:** React (via CDN)
- **Storage:** Browser localStorage
- **Localization:** Hebrew and English translation files
- **Formatting:** Intl API for currency and date localization



## Run Locally

```bash
cd budget-ledger
python3 -m http.server 4200
```

Then open:

http://localhost:4200

## Project Structure

- `index.html` — main app shell
- `styles.css` — styling and layout
- `app.js` — app logic and state management
- `translations/en.json` — English text resources
- `translations/he.json` — Hebrew text resources

## Live Demo

https://6a94351f17fd484ca9beda67--budget-ledger-app.netlify.app/

## Overview

This project is designed for users who want a clean, personal budget tracker without needing a complex backend or database.
It is especially useful for month-by-month financial planning, everyday expense monitoring, and quick access to a clear overview of available funds.