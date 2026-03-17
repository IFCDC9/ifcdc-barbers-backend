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

5. Open the Expo Go app on your mobile device and scan the QR code to view the application.

## Contributing

Contributions are welcome! Please open an issue or submit a pull request for any improvements or bug fixes.

## License

This project is licensed under the MIT License. See the LICENSE file for details.