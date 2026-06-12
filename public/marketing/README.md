# Marketing screenshots

Drop product screenshots here with these exact filenames and they replace the
placeholders on the logged-out homepage automatically (no code change needed):

| File                  | Used in                          | Suggested ratio |
| --------------------- | -------------------------------- | --------------- |
| `hero-dashboard.png`  | Hero — left browser pane         | 4:3             |
| `hero-live.png`       | Hero — right browser pane        | 4:3             |
| `game-logging.png`    | "At the table" — Game logging    | 5:4             |
| `global-stats.png`    | Autopsy — Global statistics      | 4:3             |
| `pod-stats.png`       | Autopsy — Pod statistics         | 4:3             |
| `wincon.png`          | Autopsy — Win-con evaluation     | 4:3             |

Slots are `object-cover`, so off-ratio images crop cleanly. Until a file
exists, its slot shows a labelled placeholder. Filenames are wired up in
`src/pages/LoggedOutHomePage.tsx` (the `SHOT` map).
