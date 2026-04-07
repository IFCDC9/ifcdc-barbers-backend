# Mobile Application

This is the mobile application project named "mobile". It is built using Expo and TypeScript, featuring a tab-based navigation structure.

## Project Structure

- **app/**: Contains the main application files.
  - **(tabs)**: Contains the tab navigation screens.
    - **index.tsx**: Main entry point for tab navigation.
    - **explore.tsx**: Explore screen component.
    - **profile.tsx**: Profile screen component.
  - **_layout.tsx**: Application layout component.
  - **+not-found.tsx**: Component for handling not found routes.

- **components/**: Contains reusable components.
  - **ThemedText.tsx**: Themed text component.
  - **ThemedView.tsx**: Themed view container.
  - **Navigation.tsx**: Navigation logic component.

- **constants/**: Contains constant values used throughout the app.
  - **Colors.ts**: Color constants.

- **hooks/**: Contains custom hooks.
  - **useColorScheme.ts**: Hook for accessing the current color scheme.

- **app.json**: Configuration file for the Expo app.

- **package.json**: npm configuration file.

- **tsconfig.json**: TypeScript configuration file.

- **babel.config.js**: Babel configuration file.

## Getting Started

To get started with the project, follow these steps:

1. Clone the repository:
   ```
   git clone <repository-url>
   ```

2. Navigate to the project directory:
   ```
   cd mobile
   ```

3. Install the dependencies:
   ```
   npm install
   ```

4. Start the development server:
   ```
   npm start
   ```
   Same Wi‑Fi as your computer (no public tunnel):
   ```
   npm run lan
   ```
   Remote device / different network (requires ngrok; set `NGROK_AUTH_TOKEN` in `.env` if tunnel times out — see `.env.example`):
   ```
   npm run tunnel
   ```
   **iOS Simulator + “Could not connect to development server”:** Metro must be on **8081** and match **127.0.0.1** from the simulator’s point of view.
   1. `cd` into `mobile/`, then only reset Expo: `pkill -f expo` (do not stop the backend on 5050).
   2. If you see **`EADDRINUSE :::8081`**, free Metro first: `npm run metro:kill` (or use any `npm run` / `npm run expo:*` script — they kill **8081** before starting).
   3. Start LAN + clear cache: `npm run lan:clear` or `npx expo start --lan --clear` and wait until Metro is waiting / a URL appears.
   4. `open -a Simulator` if needed; in the Expo terminal press **`i`** to attach iOS.
   5. In the simulator: **Cmd+D** → **Reload**.
   If the URL still mismatches, try `npm run lan:clear:sim` (sets `REACT_NATIVE_PACKAGER_HOSTNAME=127.0.0.1`) or add that line to `mobile/.env`.
   One-shot open iOS: `npm run ios:lan`. Failsafe: `npx expo run:ios`.
   After changing `babel.config.js` or `metro.config.js`, stop Expo, run `npm run lan:clear` (or `start:clear`) once. If bundling still sticks at **0%**, install Watchman (`brew install watchman`) then `watchman watch-del-all`, or remove stray **`node_modules__corrupt_*`** backup folders under `mobile/` (they duplicate `node_modules` and overwhelm the file watcher).

5. Open the Expo Go app on your mobile device and scan the QR code to view the application.

## Contributing

Contributions are welcome! Please open an issue or submit a pull request for any improvements or bug fixes.

## License

This project is licensed under the MIT License. See the LICENSE file for details.