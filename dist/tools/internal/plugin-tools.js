"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.printInconsistencyWarning = exports.addOutputSelections = exports.configureCompilers = void 0;
function configureCompilers(config, selections, ast) {
    for (const compiler of config.solidity.compilers) {
        addOutputSelections(compiler, '*', selections);
        if (ast) {
            addOutputSelections(compiler, '', ['ast']);
        }
    }
}
exports.configureCompilers = configureCompilers;
function addOutputSelections(compiler, section, selections) {
    var _a, _b;
    /* eslint-disable @typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-assignment */
    compiler.settings ?? (compiler.settings = {});
    (_a = compiler.settings).outputSelection ?? (_a.outputSelection = {});
    const outputSelection = compiler.settings.outputSelection;
    outputSelection['*'] ?? (outputSelection['*'] = {});
    (_b = outputSelection['*'])[section] ?? (_b[section] = []);
    const sectionSelection = outputSelection['*'][section];
    /* eslint-enable @typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-assignment */
    for (const s of selections) {
        if (!sectionSelection.includes(s)) {
            sectionSelection.push(s);
        }
    }
}
exports.addOutputSelections = addOutputSelections;
function printInconsistencyWarning() {
    /* eslint-disable no-console */
    console.log('***********************************************************');
    console.log('***********************************************************');
    console.log('***********************************************************');
    console.log('\nThere is a mismatch between artifact and build files.');
    console.log('\nPlease run:\n');
    console.log('\t npm hardhat clean && npm hardhat compile\n');
    console.log('***********************************************************');
    console.log('***********************************************************');
    console.log('***********************************************************');
    /* eslint-enable no-console */
}
exports.printInconsistencyWarning = printInconsistencyWarning;
//# sourceMappingURL=plugin-tools.js.map