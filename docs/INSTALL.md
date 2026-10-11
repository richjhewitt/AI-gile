# Installing AI-gile

A step-by-step guide for a first install on Windows. About 15 minutes.

## Already using Claude Code? (5 minutes)

You have Node and Claude Code, and your projects already have folders, git and Claude sessions. Then:

1. **Get AI-gile** (step 1 below) next to your projects, and double-click **start-aigile.bat**.
2. **Setup**: your name, then **Agent program**. Use the `claude.exe` you already run; for the VS Code extension
   that's the path in step 3 below. Leave the other fields as they are.
3. **🔎 Find my projects**: tick your project folders and add them. For each one AI-gile:
   - adds a short board section to `CLAUDE.local.md` (your own `CLAUDE.md` is left alone)
   - adds its hooks and team permissions to `.claude/settings.local.json`, keeping your own settings and hooks
   - reads your git history and past sessions, so the team starts where you left off
4. **Carry on as you do now.** Open a project in VS Code or a terminal as usual: the hooks show you the board's news.
   When you close it, the board wakes the team in the background for your next comment, carrying on your last
   conversation.

Things to know:
- `git push` always asks you first, also for a team working in the background
- background runs use your own Claude plan, the same as your sessions
- to undo it for a project, remove the AI-gile section from `CLAUDE.local.md` and the `aigile.js` hooks from
  `.claude/settings.local.json`

New to Claude Code? Start at **What you need** below.

## What you need

- **Windows 10 or 11**
- **Node.js** (version 18 or later). Download the LTS version from <https://nodejs.org> and install it with the defaults.
  To check, open PowerShell and type `node -v`: it should print something like `v22.x`.
- **Claude Code**, the AI agent that does the work for each project. Install it from <https://claude.com/claude-code> and sign in once.
  AI-gile starts it for a team when there is work to do.

## 1. Get AI-gile

The repo is private for now, so you need an invite to it (ask Rich), or a zip of it.

- **With git:** `git clone https://github.com/richjhewitt/AI-gile.git` in the folder where you keep your projects
- **With a zip:** unzip it next to your projects, e.g. `C:\Users\you\Projects\AI-gile`

## 2. Start it

Double-click **start-aigile.bat** in the AI-gile folder. The board starts and opens in your browser at <http://localhost:4321>.

It only listens on your own computer: nobody else on your network can reach it.

## 3. First-run Setup

The first time, the board opens **⚙️ Setup**:

- **Language**: English, Nederlands or Vlaams
- **Your name**: the teams call you by it
- **Agent program**: the full path to Claude Code's `claude.exe`. With the VS Code extension it is usually
  `C:/Users/you/.vscode/extensions/anthropic.claude-code-*-win32-x64/resources/native-binary/claude.exe`
  (the `*` is fine: the board picks the newest version)
- **Agent notes file** and **Agent settings file**: leave the suggested names (`CLAUDE.local.md`, `.claude/settings.local.json`)
- **Session logs folder**: `C:/Users/you/.claude/projects` (for the ⚡ Usage page)

Click **Save**. Your settings stay on your computer in `aigile.local.json`; they are never shared.

## 4. Add your projects

On the home page:

- **🔎 Find my projects** lists the project folders it finds; tick the ones you want and add them
- or **+ New project**, then **🔌 Connect folder** on its board

Connecting a folder sets the project up for its AI team: their notes, the board's hooks and sensible permissions
(`git push` always asks you first).

## 5. Let a team work

Open a project, raise a card (**+ New**, or **💬** to message its lead with an idea), and comment on it.
Your comment wakes the team. They hand work back to you in **For you** with steps to test.

## Optional: the desktop app

The board in its own window, with a taskbar icon that shows a purple diamond when something waits on you.

In PowerShell, in the AI-gile folder:

```
cd desktop
npm install
npm run shortcut
```

This adds an **AI-gile** shortcut to your Desktop and Start menu. (Run it from PowerShell, not from a VS Code terminal.)

## Updating

When there is a new version, the board shows an **⬆ Update** pill. One click updates and restarts it.
It never updates while a team is working, and never over changes you haven't saved.

## If something goes wrong

- **The page doesn't open:** run `start-aigile.bat` again. If something else uses port 4321, close it or
  set `AIGILE_PORT` to another port before starting.
- **A team never wakes:** check **Agent program** in ⚙️ Setup points at a `claude.exe` that exists.
- **Usage page is empty:** it fills in once a terminal Claude session has run, or click **🔄 Check usage now**.
