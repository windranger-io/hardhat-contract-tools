"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractBytecodeMappings = void 0;
const console_table_printer_1 = require("console-table-printer");
const config_1 = require("hardhat/config");
const chalk_1 = __importDefault(require("chalk"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const MAX_CONTRACT_SIZE = 24576; // applied to color contract size as green / yellow / red
/* eslint-disable no-lone-blocks */
(0, config_1.extendConfig)((config) => {
    for (const compiler of config.solidity.compilers) {
        addOutputSelections(compiler, [
            'evm.bytecode.object',
            'evm.bytecode.sourceMap',
            'evm.deployedBytecode.object',
            'evm.deployedBytecode.sourceMap'
        ]);
    }
});
(0, config_1.task)('contract-sizes', 'Prints size of contracts, including contribution of source files into bytecode of a contract')
    .addFlag('details', 'Print contribution of each source files into bytecode of a contract')
    .addFlag('alnum', 'Print contracts sorted by names, not by code size')
    .addFlag('diff', 'Print size difference with the previous run with this flag')
    .addOptionalParam('size', 'Filter by contract size (20 000 by default)', 0, config_1.types.int)
    .addOptionalVariadicPositionalParam('contracts', 'Contracts to be printed, names or FQNs')
    .setAction(async ({ details: verbose, alnum, diff, size, contracts }, hre) => {
    const c = (contracts ?? []);
    const mappings = await extractBytecodeMappings(hre, c);
    if (!mappings) {
        printWarning();
        return;
    }
    if (mappings.length === 0) {
        // eslint-disable-next-line no-console
        console.log('No contracts found');
    }
    // eslint-disable-next-line no-undefined
    const prevSizes = diff ? await loadPrevSizes(hre) : undefined;
    if (diff) {
        await savePrevSizes(hre, mappings);
    }
    mappings.sort(alnum
        ? (a, b) => a.printName.localeCompare(b.printName)
        : (a, b) => a.codeSize === b.codeSize
            ? a.printName.localeCompare(b.printName)
            : a.codeSize - b.codeSize);
    const maxSize = (size ?? 0);
    const p = tabulateBytecodeMappings(mappings, maxSize, Boolean(verbose), prevSizes);
    if (p.table.rows.length > 0) {
        p.printTable();
    }
    else {
        // eslint-disable-next-line no-console
        console.log(`There are no contracts exceeding ${maxSize} bytes`);
    }
});
function printWarning() {
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
function addOutputSelections(compiler, selections) {
    var _a, _b, _c;
    /* eslint-disable @typescript-eslint/no-unsafe-member-access */
    compiler.settings ?? (compiler.settings = {});
    (_a = compiler.settings).outputSelection ?? (_a.outputSelection = {});
    (_b = compiler.settings.outputSelection)['*'] ?? (_b['*'] = {});
    (_c = compiler.settings.outputSelection['*'])['*'] ?? (_c['*'] = []);
    const outputSelection = compiler.settings.outputSelection['*']['*'];
    /* eslint-enable @typescript-eslint/no-unsafe-member-access */
    for (const s of selections) {
        if (!outputSelection.includes(s)) {
            outputSelection.push(s);
        }
    }
}
const noSourceId = -1;
const metadataId = -2;
const unknownCodeId = -3;
async function extractBytecodeMappings(env, names, canPrint) {
    const contracts = [];
    const filters = new Set();
    (names ?? []).forEach((name) => filters.add(name));
    const buildInfoPaths = await env.artifacts.getBuildInfoPaths();
    const conflictedNames = new Map();
    {
        const fullyQualifiedNames = await env.artifacts.getAllFullyQualifiedNames();
        for (const fullName of fullyQualifiedNames) {
            const { sourceName, contractName } = await env.artifacts.readArtifact(fullName);
            {
                const flag = conflictedNames.get(contractName);
                if (flag !== true) {
                    conflictedNames.set(contractName, flag === false);
                }
            }
            if (filters.size === 0 ||
                filters.has(contractName) ||
                filters.has(fullName)) {
                let buildInfoFile = '';
                if (buildInfoPaths.length > 1) {
                    const dbgFileName = _getDebugFilePath(env.artifacts.formArtifactPathFromFullyQualifiedName(fullName));
                    const dbgFile = JSON.parse(fs_1.default.readFileSync(dbgFileName).toString());
                    buildInfoFile = path_1.default.basename(dbgFile.buildInfo);
                }
                contracts.push({ sourceName, contractName, buildInfoFile });
            }
        }
        if (!contracts) {
            return [];
        }
    }
    const contractLayouts = [];
    let buildInfoIsMissing = false;
    for (const buildInfoPath of buildInfoPaths) {
        const artifact = fs_1.default.readFileSync(buildInfoPath);
        const artifactJsonABI = JSON.parse(artifact.toString());
        const sourceFiles = new Map();
        Object.entries(artifactJsonABI.output.sources).forEach(([key, { id }]) => {
            sourceFiles.set(id, key);
        });
        sourceFiles.set(noSourceId, '## non-mapped bytecode');
        sourceFiles.set(metadataId, '## contract metadata');
        sourceFiles.set(unknownCodeId, '## non-code bytes');
        for (const { sourceName, contractName, buildInfoFile } of contracts) {
            if (buildInfoFile &&
                buildInfoFile !== path_1.default.basename(buildInfoPath)) {
                // eslint-disable-next-line no-continue
                continue;
            }
            const contractInfo = artifactJsonABI.output.contracts?.[sourceName]?.[contractName];
            if (!contractInfo) {
                buildInfoIsMissing = true;
                if (canPrint) {
                    // eslint-disable-next-line no-console
                    console.error(`Build info was not found in ${path_1.default.basename(buildInfoPath)} for ${sourceName}:${contractName}`);
                }
                // eslint-disable-next-line no-continue
                continue;
            }
            const evm = contractInfo.evm;
            const generatedSources = new Map();
            evm.bytecode.generatedSources.forEach((entry) => generatedSources.set(entry.id, `## compiler ${entry.name}`));
            evm.deployedBytecode.generatedSources.forEach((entry) => generatedSources.set(entry.id, `## compiler ${entry.name}`));
            const sourceEntries = new Map();
            const getSourceEntry = (id) => {
                {
                    const entry = sourceEntries.get(id);
                    if (entry) {
                        return entry;
                    }
                }
                const fileName = sourceFiles.get(id) ??
                    generatedSources.get(id) ??
                    `<unknown:${id}>`;
                const entry = {
                    fileName,
                    codeSize: 0,
                    initSize: 0
                };
                sourceEntries.set(id, entry);
                return entry;
            };
            const addParsedSize = (id, initSize, codeSize) => {
                const entry = getSourceEntry(id);
                entry.initSize += initSize;
                entry.codeSize += codeSize;
            };
            const uniqueName = `${contractName}:${sourceName}`;
            const contractLayout = {
                uniqueName,
                printName: conflictedNames.get(contractName)
                    ? uniqueName
                    : contractName,
                initSize: countBytes(evm.bytecode.sourceMap, evm.bytecode.object, (id, size) => addParsedSize(id, size, 0), evm.deployedBytecode.object.length),
                codeSize: countBytes(evm.deployedBytecode.sourceMap, evm.deployedBytecode.object, (id, size) => addParsedSize(id, 0, size), 0, true),
                sources: []
            };
            contractLayout.sources = [...sourceEntries.values()];
            contractLayout.sources.sort((a, b) => a.codeSize - b.codeSize);
            contractLayouts.push(contractLayout);
        }
    }
    return buildInfoIsMissing ? null : contractLayouts;
}
exports.extractBytecodeMappings = extractBytecodeMappings;
function countBytes(sourceMap, bytecode, addSizeFn, tailLen, allowMeta) {
    let decodePos = 0;
    let sourceId = noSourceId;
    const addSize = (id, size) => {
        if (size > 0) {
            addSizeFn(id, size);
        }
    };
    if (sourceMap) {
        for (const mapping of sourceMap.split(';')) {
            const components = mapping.split(':');
            if (components.length >= 3 && components[2]) {
                sourceId = parseInt(components[2], 10);
            }
            let n = 1;
            // eslint-disable-next-line default-case
            switch (bytecode[decodePos]) {
                case '7': // PUSH17 - PUSH32
                    n += 16;
                // eslint-disable-next-line no-fallthrough
                case '6': // PUSH01 - PUSH16
                    n += parseInt(bytecode[decodePos + 1], 16);
                    n += 1;
            }
            addSize(sourceId, n);
            decodePos += n * 2;
        }
    }
    let unknown = bytecode.length - decodePos;
    if (unknown > tailLen &&
        unknown >= 2 &&
        bytecode.substring(decodePos, decodePos + 2).toUpperCase() === 'FE') {
        // terminating *ASSERT op
        addSize(sourceId, 1);
        unknown -= 2;
    }
    if (unknown > tailLen) {
        unknown -= tailLen;
        if (allowMeta && unknown >= 4) {
            const metadataLen = parseInt(bytecode.substring(bytecode.length - 4), 16) + 2;
            if (metadataLen * 2 > unknown) {
                throw Error(`Inconsistent metadata size: ${unknown} < ${metadataLen * 2}`);
            }
            unknown -= metadataLen * 2;
            addSize(metadataId, metadataLen);
        }
        if (unknown > 0) {
            addSize(unknownCodeId, unknown / 2);
        }
    }
    else if (unknown < tailLen) {
        throw Error(`Inconsistent bytecode size: ${unknown} < ${tailLen}`);
    }
    return (bytecode.length - tailLen) / 2;
}
function _getDebugFilePath(artifactPath) {
    return artifactPath.replace(/\.json$/, '.dbg.json');
}
const colorSize = (code) => {
    const v = code.toLocaleString();
    if (code > MAX_CONTRACT_SIZE) {
        return chalk_1.default.red(v);
    }
    else if (code > MAX_CONTRACT_SIZE * 0.85) {
        return chalk_1.default.yellow(v);
    }
    return v;
};
function tabulateBytecodeMappings(contracts, maxSize, verbose, prev) {
    const codeColumnDelta = '±code';
    const codeColumnPct = 'code%';
    const columns = [{ name: 'contract', alignment: 'left' }];
    if (verbose) {
        columns.push({ name: 'source', alignment: 'left' }, { name: codeColumnPct, alignment: 'right' });
    }
    columns.push({ name: 'code', alignment: 'right' });
    const showDiff = Boolean(prev);
    if (showDiff) {
        columns.push({ name: codeColumnDelta, alignment: 'right' });
    }
    columns.push({ name: 'init', alignment: 'right' });
    const p = new console_table_printer_1.Table({ columns });
    for (const c of contracts) {
        if (maxSize > c.codeSize + c.initSize) {
            // eslint-disable-next-line no-continue
            continue;
        }
        if (verbose && p.table.rows.length > 0) {
            p.addRow({});
        }
        const addDelta = (v, code, codePrev) => {
            // eslint-disable-next-line no-undefined
            if (!showDiff) {
                return v;
            }
            const d = code - (codePrev ?? 0);
            if (d === 0) {
                return v;
            }
            v[codeColumnDelta] =
                d > 0
                    ? chalk_1.default.red(`+${d.toLocaleString()}`)
                    : chalk_1.default.green(`-${(-d).toLocaleString()}`);
            return v;
        };
        if (verbose) {
            for (const source of c.sources) {
                const srcName = source.fileName[0] === '#'
                    ? chalk_1.default.gray(chalk_1.default.italic(source.fileName))
                    : source.fileName;
                const pct = `${Math.round((source.codeSize * 100) / c.codeSize)}%`;
                const row = {
                    contract: c.printName,
                    source: srcName,
                    code: source.codeSize.toLocaleString(),
                    [codeColumnPct]: pct,
                    init: source.initSize.toLocaleString()
                };
                const prevSize = prev?.[c.uniqueName]?.sources[source.fileName]?.codeSize;
                p.addRow(addDelta(row, source.codeSize, prevSize));
            }
        }
        const row = {
            contract: c.printName,
            code: colorSize(c.codeSize),
            init: c.initSize.toLocaleString()
        };
        if (verbose) {
            row.source = c.sources.length > 0 ? chalk_1.default.bold('=== Total ===') : '';
            row.code = chalk_1.default.bold(row.code);
            row.init = chalk_1.default.bold(row.init);
        }
        const prevSize = prev?.[c.uniqueName]?.codeSize;
        p.addRow(addDelta(row, c.codeSize, prevSize));
    }
    return p;
}
function _outputPath(hre) {
    return path_1.default.resolve(hre.config.paths.cache, '.wr_contract_sizer_output.json');
}
async function loadPrevSizes(hre) {
    const outputPath = _outputPath(hre);
    if (fs_1.default.existsSync(outputPath)) {
        const prev = await fs_1.default.promises.readFile(outputPath);
        return JSON.parse(prev.toString());
    }
    return {};
}
async function savePrevSizes(hre, mappings) {
    const outputPath = _outputPath(hre);
    const result = {};
    mappings.forEach((m) => {
        if (m.sources.length === 0) {
            return;
        }
        const sources = {};
        m.sources.forEach((s) => (sources[s.fileName] = {
            codeSize: s.codeSize,
            initSize: s.initSize
        }));
        result[m.uniqueName] = {
            codeSize: m.codeSize,
            initSize: m.initSize,
            sources
        };
    });
    await fs_1.default.promises.writeFile(outputPath, JSON.stringify(result), { flag: 'w' });
}
//# sourceMappingURL=contract-sizes.js.map