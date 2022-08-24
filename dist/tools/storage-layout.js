"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.tabulateContractLayouts = exports.extractContractLayout = exports.isInheritedStorageLayout = void 0;
const console_table_printer_1 = require("console-table-printer");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const artifacts_types_1 = require("./internal/artifacts-types");
function isInheritedStorageLayout(parent, child) {
    const pVars = parent.stateVariables;
    const cVars = child.stateVariables;
    if (cVars.length < pVars.length) {
        return false;
    }
    return !pVars.some((p, i) => {
        const c = cVars[i];
        return (p.name !== c.name ||
            p.slot !== c.slot ||
            p.offset !== c.offset ||
            p.type !== c.type);
    });
}
exports.isInheritedStorageLayout = isInheritedStorageLayout;
async function extractContractLayout(env, contracts, sourceFiles) {
    const contractLayouts = [];
    const buildInfoPaths = await env.artifacts.getBuildInfoPaths();
    for (const buildInfoPath of buildInfoPaths) {
        const artifact = fs_1.default.readFileSync(buildInfoPath);
        const buildInfo = JSON.parse(artifact.toString());
        const astMapping = sourceFiles
            ? (0, artifacts_types_1.createAstToFileMapping)(buildInfo)
            : new Map();
        for (const { sourceName, contractName, buildInfoFile, conflictedName } of contracts) {
            if (buildInfoFile &&
                buildInfoFile !== path_1.default.basename(buildInfoPath)) {
                // eslint-disable-next-line no-continue
                continue;
            }
            const contractInfo = buildInfo.output.contracts?.[sourceName]?.[contractName];
            if (!contractInfo) {
                return null;
            }
            const uniqueName = `${contractName}:${sourceName}`;
            const contractLayout = {
                uniqueName,
                printName: conflictedName ? uniqueName : contractName,
                stateVariables: []
            };
            for (const stateVariable of contractInfo.storageLayout.storage) {
                contractLayout.stateVariables.push({
                    name: stateVariable.label,
                    slot: stateVariable.slot,
                    offset: stateVariable.offset,
                    type: stateVariable.type,
                    sourceFile: astMapping.get(stateVariable.astId)
                });
            }
            contractLayouts.push(contractLayout);
        }
    }
    return contractLayouts;
}
exports.extractContractLayout = extractContractLayout;
function tabulateContractLayouts(contracts, sourceFiles) {
    const columns = [
        { name: 'contract', alignment: 'left' },
        { name: 'variable', alignment: 'left' },
        { name: 'slot', alignment: 'right' },
        { name: 'offset', alignment: 'right' },
        { name: 'type', alignment: 'left' }
    ];
    if (sourceFiles) {
        columns.push({ name: 'source', alignment: 'left' });
    }
    const p = new console_table_printer_1.Table({ columns });
    for (const contract of contracts) {
        for (const stateVariable of contract.stateVariables) {
            const row = {
                contract: contract.printName,
                variable: stateVariable.name,
                slot: stateVariable.slot,
                offset: stateVariable.offset,
                type: stateVariable.type
            };
            if (sourceFiles) {
                row.source = stateVariable.sourceFile;
            }
            p.addRow(row);
        }
    }
    return p;
}
exports.tabulateContractLayouts = tabulateContractLayouts;
//# sourceMappingURL=storage-layout.js.map