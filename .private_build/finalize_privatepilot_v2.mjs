import path from 'node:path';
import { pathToFileURL } from 'node:url';

const workspaceDir = 'C:/Users/mak22/Desktop/swiftRoute';
const SKILL_DIR = 'C:/Users/mak22/.codex/plugins/cache/openai-primary-runtime/presentations/26.905.11957/skills/presentations';
const RUNTIME_PYTHON = 'C:/Users/mak22/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe';
const { finalizePresentation } = await import(pathToFileURL(path.join(SKILL_DIR, 'container_tools/artifact_tool_utils.mjs')).href);

const result = await finalizePresentation({
  explicitTotalSlideCount: 7,
  requiredNativeTableOwnerSlides: [2, 6],
  requiredNativeChartOwnerSlides: [],
  workspaceDir,
  candidatePath: path.join(workspaceDir, '.codex-finalizer', 'privatepilot-candidate.pptx'),
  finalPath: path.join(workspaceDir, 'output', 'PrivatePilot_SIH2026_Deck_v3.pptx'),
  pythonExecutable: RUNTIME_PYTHON,
  integrityValidatorPath: path.join(SKILL_DIR, 'container_tools', 'inspect_presentation_package_integrity.py'),
  layoutValidatorPath: path.join(SKILL_DIR, 'container_tools', 'inspect_presentation_layout_geometry.py'),
  layoutArgs: ['--expected-slide-size-emu', '12192000,6858000', '--validate-bullet-geometry', '--validate-heading-fit', '--require-native-table-slide', '2', '--require-native-table-slide', '6'],
  fontPolicy: { basis: 'design', families: ['Georgia', 'Aptos'] },
  verifyArtifactToolImport: true,
  receiptPath: path.join(workspaceDir, '.codex-finalizer', 'PrivatePilot_SIH2026_Deck_v3.validation.json'),
});
console.log(JSON.stringify(result, null, 2));
