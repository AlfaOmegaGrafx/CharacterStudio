# Map — where things live.

.agent/ — RepoResident harness
.brain/ — MindLink memory (optional)
src/App.jsx · Main.jsx — app shell entry
src/components/ — UI (TaskManager, export, XR, avatar panels)
src/library/ — core logic: taskManager, sceneManager, characterManager, exporters, AI catalog
src/context/ — React contexts (Scene, Task, …)
src/pages/ — route-level pages (Tools, XR, …)
src/hooks/ · stores/ · services/ · utils/ · constants/ — shared helpers
src/__tests__/ — Vitest tests
docs/ — product + topology + API contracts
scripts/ — Surface↔DGX sync, ADB, smoke scripts
public/ · native/ · OpenXR/ — static / native / XR assets
Pitch Deck/ — audience pitch markdown (often DGX-authored)
package.json — Vite/Electron scripts
DEV_MACHINE_TOPOLOGY.md — Surface vs DGX roles and sync ownership
