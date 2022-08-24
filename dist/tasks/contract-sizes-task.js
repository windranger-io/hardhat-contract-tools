"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const config_1 = require("hardhat/config");
const plugin_tools_1 = require("../tools/internal/plugin-tools");
const path_1 = __importDefault(require("path"));
const contract_sizes_1 = require("../tools/contract-sizes");
const artifacts_scanner_1 = require("../tools/artifacts-scanner");
(0, config_1.extendConfig)((config) => {
    (0, plugin_tools_1.configureCompilers)(config, [
        'evm.bytecode.object',
        'evm.bytecode.sourceMap',
        'evm.deployedBytecode.object',
        'evm.deployedBytecode.sourceMap'
    ]);
});
(0, config_1.task)('contract-sizes', 'Prints size of contracts, including contribution of source files into bytecode of a contract')
    .addFlag('details', 'Print contribution of each source files into bytecode of a contract')
    .addFlag('alnum', 'Print contracts sorted by names, not by code size')
    .addFlag('diff', 'Print size difference with the previous run with this flag')
    .addFlag('changes', 'Print only contracts with size changes, includes `--diff` flag')
    .addOptionalParam('size', 'Filter by contract size (20 000 by default)', 0, config_1.types.int)
    .addOptionalVariadicPositionalParam('contracts', 'Contracts to be printed, names or FQNs')
    .setAction(async ({ details: verbose, alnum, diff, changes, size, contracts }, hre) => {
    const filter = (0, artifacts_scanner_1.createContractFilter)((contracts ?? []), []);
    const filteredContracts = await (0, artifacts_scanner_1.findContracts)(hre, filter);
    if (filteredContracts.length === 0) {
        // eslint-disable-next-line no-console
        console.log(`No contracts found.\nPlease make sure that contracts are compiled${filter ? ' and matching the filter' : ''}.`);
        return;
    }
    const mappings = await (0, contract_sizes_1.extractBytecodeMappings)(hre, filteredContracts);
    if (!mappings) {
        (0, plugin_tools_1.printInconsistencyWarning)();
        return;
    }
    const savePath = path_1.default.resolve(hre.config.paths.cache, '.wr_contract_sizer_output.json');
    const onlyModified = Boolean(changes);
    const showDiff = Boolean(diff) || onlyModified;
    // eslint-disable-next-line no-undefined
    const prevSizes = showDiff ? (0, contract_sizes_1.loadPrevSizes)(savePath) : undefined;
    if (showDiff) {
        (0, contract_sizes_1.savePrevSizes)(savePath, mappings);
    }
    mappings.sort(alnum
        ? (a, b) => a.printName.localeCompare(b.printName)
        : (a, b) => a.codeSize === b.codeSize
            ? a.printName.localeCompare(b.printName)
            : a.codeSize - b.codeSize);
    const maxSize = (size ?? 0);
    const p = (0, contract_sizes_1.tabulateBytecodeMappings)(mappings, maxSize, Boolean(verbose), prevSizes, onlyModified);
    if (p.table.rows.length > 0) {
        p.printTable();
    }
    else {
        // eslint-disable-next-line no-console
        console.log(`There are no contracts exceeding ${maxSize.toLocaleString()} bytes${onlyModified ? ' and with size(s) changed' : ''}.`);
    }
});
//# sourceMappingURL=contract-sizes-task.js.map