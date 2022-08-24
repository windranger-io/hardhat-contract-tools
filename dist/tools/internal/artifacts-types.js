"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAstToFileMapping = exports.getArtifactDbgFilePath = void 0;
function getArtifactDbgFilePath(artifactPath) {
    return artifactPath.replace(/\.json$/, '.dbg.json');
}
exports.getArtifactDbgFilePath = getArtifactDbgFilePath;
function createAstToFileMapping(info) {
    const result = new Map();
    const sources = info.output.sources;
    Object.entries(sources).forEach(([fileName, entry]) => visitAstNodes(result, fileName, entry.ast));
    return result;
}
exports.createAstToFileMapping = createAstToFileMapping;
function visitAstNodes(result, fileName, ast) {
    result.set(ast.id, fileName);
    for (const subNode of ast.nodes ?? []) {
        visitAstNodes(result, fileName, subNode);
    }
}
//# sourceMappingURL=artifacts-types.js.map