"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createContractFilter = exports.findContracts = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const artifacts_types_1 = require("./internal/artifacts-types");
async function findContracts(env, filterFn) {
    const contracts = [];
    const buildInfoPaths = await env.artifacts.getBuildInfoPaths();
    const conflictedNames = new Map();
    const fullyQualifiedNames = await env.artifacts.getAllFullyQualifiedNames();
    for (const fullName of fullyQualifiedNames) {
        const { sourceName, contractName } = await env.artifacts.readArtifact(fullName);
        const conflictedFlag = conflictedNames.get(contractName);
        if (conflictedFlag !== true) {
            conflictedNames.set(contractName, conflictedFlag === false);
        }
        if (!filterFn || filterFn(contractName, fullName)) {
            let buildInfoFile = '';
            if (buildInfoPaths.length > 1) {
                const dbgFileName = (0, artifacts_types_1.getArtifactDbgFilePath)(env.artifacts.formArtifactPathFromFullyQualifiedName(fullName));
                const b = await fs_1.default.promises.readFile(dbgFileName);
                const dbgFile = JSON.parse(b.toString());
                buildInfoFile = path_1.default.basename(dbgFile.buildInfo);
            }
            contracts.push({
                sourceName,
                contractName,
                buildInfoFile,
                conflictedName: false
            });
        }
    }
    contracts.forEach((c) => (c.conflictedName = Boolean(conflictedNames.get(c.contractName))));
    return contracts;
}
exports.findContracts = findContracts;
function createContractFilter(includes, excludes) {
    if (includes?.length) {
        const incl = new Set(includes);
        if (excludes?.length) {
            const excl = new Set(excludes);
            return (n0, n1) => incl.has(n0) || incl.has(n1) || !(excl.has(n0) || excl.has(n1));
        }
        return (n0, n1) => incl.has(n0) || incl.has(n1);
    }
    else if (excludes?.length) {
        const excl = new Set(excludes);
        return (n0, n1) => !(excl.has(n0) || excl.has(n1));
    }
    return null;
}
exports.createContractFilter = createContractFilter;
//# sourceMappingURL=artifacts-scanner.js.map