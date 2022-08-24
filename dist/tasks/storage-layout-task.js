"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const config_1 = require("hardhat/config");
const artifacts_scanner_1 = require("../tools/artifacts-scanner");
const storage_layout_1 = require("../tools/storage-layout");
const plugin_tools_1 = require("../tools/internal/plugin-tools");
// A much faster version of hardhat-storage-layout. Supports filtering.
(0, config_1.extendConfig)((config) => (0, plugin_tools_1.configureCompilers)(config, ['storageLayout'], true));
(0, config_1.task)('storage-layout', 'Print storage layout of contracts')
    .addFlag('details', 'Prints source file for each variable')
    .addOptionalVariadicPositionalParam('contracts', 'Contracts to be printed, names or FQNs')
    .setAction(async ({ details, contracts }, hre) => {
    const verbose = Boolean(details);
    const filter = (0, artifacts_scanner_1.createContractFilter)((contracts ?? []), []);
    const filteredContracts = await (0, artifacts_scanner_1.findContracts)(hre, filter);
    if (filteredContracts.length === 0) {
        // eslint-disable-next-line no-console
        console.log('No contracts found');
    }
    const layouts = await (0, storage_layout_1.extractContractLayout)(hre, filteredContracts, verbose);
    if (!layouts) {
        (0, plugin_tools_1.printInconsistencyWarning)();
        return;
    }
    layouts.sort((a, b) => a.printName.localeCompare(b.printName));
    const table = (0, storage_layout_1.tabulateContractLayouts)(layouts, verbose);
    table.printTable();
});
//# sourceMappingURL=storage-layout-task.js.map