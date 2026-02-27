# Elder Dragon Actuary (Commando)

A web app for tracking and analyzing Commander (EDH) game statistics. Record games, track win rates by commander/player position, and export your data locally. All data is stored in your browser—nothing is sent to a server.

## Features

- **Game Logging**: Record 2–6 player games with commander names, seat positions, win conditions, and optional bracket info
- **Commander Search**: Auto-fetch legal commanders from [Scryfall](https://scryfall.com) with mana cost and type line data
- **Partner Support**: Log games with partner commanders (e.g., Tymna + Thrasios)
- **KO Tracking**: Optionally record when each player is knocked out (useful for analyzing game flow)
- **Fast Mana Notes**: Track which cards opponents played for meta analysis
- **Win Rate Stats**: View overall win rate, by commander, by seat position, with/against fast mana
- **Edit & Delete**: Modify or remove past games from your history
- **Mobile Optimized**: Responsive design for logging games on your phone at the table
- **Export & Backup**: Download your games as JSON or CSV for external analysis or backup
- **Local-Only Storage**: All data stays in your browser—no sign-up, no cloud sync

## Tech Stack

- **Frontend**: React 19 + TypeScript
- **Build**: Vite
- **UI Components**: Shadcn/ui (Radix primitives + Tailwind CSS)
- **Testing**: Vitest
- **Linting**: ESLint 9 + TypeScript ESLint

## Getting Started

### Prerequisites
- Node.js 18+
- npm

### Installation

```bash
npm install
```

### Development

Start the dev server with HMR:
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

### Testing

Run all tests:
```bash
npm run test
```

Run tests in CI mode (exits after):
```bash
npm run test:ci
```

### Linting

Check code quality:
```bash
npm run lint
```

### Build

Build for production:
```bash
npm run build
```

Preview the production build locally:
```bash
npm run preview
```

## Project Structure

```
src/
  components/       UI components (player rows, cards, search)
  pages/           Page-level components (LogGame, EditGame, History, Stats)
  hooks/           Custom React hooks (useGames, useStats, useScryffall)
  lib/             Utilities (stats, storage, Scryfall API, validation)
  lib/__tests__/   Unit tests for data layer
  components/__tests__/  Component tests
  types/           TypeScript type definitions
  assets/          Static assets
public/            Static files (logo, release notes)
```

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/your-feature`
3. Make your changes and run tests: `npm run test`
4. Run lint: `npm run lint`
5. Commit with a clear message: `git commit -m "feat: description"`
6. Push and open a pull request

## Browser Storage

All game data is stored in your browser's `localStorage` under the key `commando_games`. You can:
- Export as JSON for backup
- Export as CSV for analysis in Excel
- Import previously exported JSON files

**Note**: Clearing your browser data will delete your game history.

## Data Privacy

This app collects **no personal information** by default. When analytics are enabled, the app will send limited telemetry to the configured analytics provider.

**Analytics (optional)**

- The project supports PostHog for opt-in analytics. Analytics are disabled unless you provide a PostHog key.
- Set the following environment variables in your local `.env` (Vite):

```env
VITE_POSTHOG_API_KEY=your_posthog_project_api_key
VITE_POSTHOG_API_HOST=https://app.posthog.com # optional, defaults to PostHog cloud
```

Analytics are initialized only when `VITE_POSTHOG_API_KEY` is present. If you prefer to keep the app entirely local and offline, do not set these variables.

## Credits & Attribution

- Card data & images: [Scryfall](https://scryfall.com)
- UI Framework: [Shadcn/ui](https://ui.shadcn.com)
- Theming: [Tailwind CSS](https://tailwindcss.com)
- Statistics inspiration: [EDHRec](https://edhrec.com)

## License

This project is provided as-is. Feel free to fork, modify, and use for personal projects.
