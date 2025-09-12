# Dependencies

## Windows Scripts (powershell execution policies)
- https:/go.microsoft.com/fwlink/?LinkID=135170
- To change policy, run in administrator powershell:
    Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy Unrestricted -Force;
- Check it worked with:
    Get-ExecutionPolicy
- Revert with:
    Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy Restricted -Force;

## Node.js

This project requires Node.js (which includes npm).

- [Download Node.js](https://nodejs.org/)
- Install:
    ```sh
    # For Ubuntu/Debian
    sudo apt-get install nodejs npm

    # For Windows
    # Download and run the installer from the Node.js website
    ```

## Project Dependencies

### npm

    ```sh
    npm install
    ```

    Update to latest stable version of npm:

    ```sh
    npm install -g npm@latest
    ```

    Reload node_modules dependencies, based on package.json (includes svg packages, obsidian, and obsidian-typings):

    ```sh
    npm install -g npm@latest
    ```

## Additional Info

- Check `package.json` for specific packages.

- [obsidian API](https://github.com/obsidianmd/obsidian-api)

- To compile plugin changes, its:

```sh
npm run dev
```

## Development Tools

- [Git](https://git-scm.com/downloads)
- [VS Code](https://code.visualstudio.com/)

---