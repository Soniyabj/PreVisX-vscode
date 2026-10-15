# PreVisX      

<img width="128" height="128" alt="previs" src="https://github.com/user-attachments/assets/b805806b-5969-49aa-bc7c-fdd4b19a0aad" />


## Project Readiness & Environment Verification System

PreVisX is a local-first VS Code extension that checks whether a project is ready to run on the current machine. It detects the project stack, checks relevant runtimes and project configuration, explains readiness problems, and offers a small set of explicitly approved Safe Fixes.

PreVisX does not upload project files, source code, environment values, credentials, or telemetry.

## Supported Project Types

- Node.js projects, including common JavaScript and TypeScript layouts
- Python projects, including common Django, Flask, and FastAPI layouts
- Java projects using Maven or Gradle
- C/C++ projects using common source and build configuration files

Detection is deterministic and based on project files. A project may contain more than one detected project type.

## Readiness Checks

The PreVisX sidebar reports a transparent readiness score and status for relevant checks:

- Runtime availability, including Node.js, npm, Yarn, pnpm, Python, Java, and common C/C++ compilers
- Dependency readiness, such as `node_modules` or a Python virtual environment
- Environment configuration, including `.env` and `.env.example` presence
- Common project configuration and build scripts
- Declared development ports and basic port availability
- Build configuration readiness where the project provides a recognizable build command

Checks are project-aware. Unrelated runtimes are not counted against a project.

## Diagnosis Engine

Failed, warning, and unknown checks are converted into structured diagnoses containing the problem, evidence, impact, severity, and recommended action. Diagnostics are designed to explain the observed project state without exposing environment secret values.

## Safe Fixes

The current implementation can propose these fixed Safe Fix operations:

- Install Node.js dependencies with `npm install`
- Create a Python virtual environment with `python -m venv .venv`
- Copy `.env.example` to `.env`

Every operation requires explicit modal approval. Cancelling performs no command or file operation. Plans are validated against fixed commands, arguments, operation types, and the active workspace boundary. PreVisX does not install system runtimes, kill processes, delete files, or modify package versions automatically.

## Installation

PreVisX is currently distributed as a development project. A Marketplace publisher and public release package have not been configured yet.

For local development, clone or open the project, install dependencies, and compile it:

```bash
npm install
npm run compile
```

## Usage

1. Open a supported project folder in VS Code.
2. Select the **PreVisX** icon in the Activity Bar.
3. Review the detected project, readiness checks, diagnoses, and score.
4. Use **Run Full Check** or **Refresh** in the sidebar.
5. Use **Apply Safe Fixes** only after reviewing and approving each proposed operation.

## Available Commands

- `PreVisX: Open Sidebar`
- `PreVisX: Show Status`
- `PreVisX: Apply Safe Fixes`

## Current Limitations

- No AI, cloud service, GitHub integration, authentication, analytics, or external backend
- No automatic runtime installation
- Safe Fixes are intentionally limited to the three operations listed above
- No project start command is executed by the current implementation
- Marketplace publisher metadata and public release packaging are not configured
- Manual Activity Bar and webview interaction verification remains to be performed by the developer

## Troubleshooting

If no project is detected, open the project folder rather than an individual file and ensure its manifest is at the workspace root. If a runtime is reported missing, install it separately and run PreVisX again; PreVisX does not install system runtimes. If a Safe Fix is unavailable, inspect the readiness diagnosis and confirm that the expected manifest or environment template exists.

## Security and Privacy

PreVisX runs locally in the VS Code extension host. Runtime checks use fixed executable names and argument lists. Safe Fixes use validated plans, explicit approval, `execFile`, and `shell: false`. Webview output uses HTML escaping and a nonce-based Content Security Policy. Environment files are only checked for presence; their values are not displayed or transmitted.

## Development and Testing

```bash
npm run compile
npm run lint
npm test
```

The test suite uses temporary fixture projects and covers project detection, readiness checks, runtime diagnostics, configuration diagnostics, diagnosis behavior, Safe Fix approval and validation, malformed manifests, and webview hardening helpers.
