"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.savePrevSizes = exports.loadPrevSizes = exports.tabulateBytecodeMappings = exports.extractBytecodeMappings = void 0;
const console_table_printer_1 = require("console-table-printer");
const chalk_1 = __importDefault(require("chalk"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const MAX_CONTRACT_SIZE = 24576; // applied to color contract size as green / yellow / red
const noSourceId = -1;
const metadataId = -2;
const unknownCodeId = -3;
async function extractBytecodeMappings(env, contracts) {
    const buildInfoPaths = await env.artifacts.getBuildInfoPaths();
    const contractLayouts = [];
    for (const buildInfoPath of buildInfoPaths) {
        const artifact = fs_1.default.readFileSync(buildInfoPath);
        const buildInfo = JSON.parse(artifact.toString());
        const sourceFiles = new Map();
        Object.entries(buildInfo.output.sources).forEach(([key, { id }]) => {
            sourceFiles.set(id, key);
        });
        sourceFiles.set(noSourceId, '## non-mapped bytecode');
        sourceFiles.set(metadataId, '## contract metadata');
        sourceFiles.set(unknownCodeId, '## non-code bytes');
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
                printName: conflictedName ? uniqueName : contractName,
                initSize: countBytes(evm.bytecode.sourceMap, evm.bytecode.object, (id, size) => addParsedSize(id, size, 0), evm.deployedBytecode.object.length),
                codeSize: countBytes(evm.deployedBytecode.sourceMap, evm.deployedBytecode.object, (id, size) => addParsedSize(id, 0, size), 0, true),
                sources: []
            };
            contractLayout.sources = [...sourceEntries.values()];
            contractLayout.sources.sort((a, b) => a.codeSize - b.codeSize);
            contractLayouts.push(contractLayout);
        }
    }
    return contractLayouts;
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
function tabulateBytecodeMappings(contracts, maxSize, verbose, prev, onlyModified) {
    const codeColumnDelta = '±code';
    const codeColumnPct = 'code%';
    const columns = [{ name: 'contract', alignment: 'left' }];
    if (verbose) {
        columns.push({ name: 'source', alignment: 'left' }, { name: codeColumnPct, alignment: 'right' });
    }
    columns.push({ name: 'code', alignment: 'right' });
    const showDiff = Boolean(prev);
    const onlyDiff = showDiff && Boolean(onlyModified);
    if (showDiff) {
        columns.push({ name: codeColumnDelta, alignment: 'right' });
    }
    columns.push({ name: 'init', alignment: 'right' });
    let hasDelta = false;
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
        hasDelta = true;
        return v;
    };
    const p = new console_table_printer_1.Table({ columns });
    for (const c of contracts) {
        if (maxSize > c.codeSize + c.initSize) {
            // eslint-disable-next-line no-continue
            continue;
        }
        hasDelta = false;
        const rows = [];
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
                rows.push(addDelta(row, source.codeSize, prevSize));
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
        rows.push(addDelta(row, c.codeSize, prevSize));
        if (!onlyDiff || hasDelta) {
            if (verbose && p.table.rows.length > 0) {
                p.addRow({});
            }
            p.addRows(rows);
        }
    }
    return p;
}
exports.tabulateBytecodeMappings = tabulateBytecodeMappings;
function loadPrevSizes(outputPath) {
    if (fs_1.default.existsSync(outputPath)) {
        const prev = fs_1.default.readFileSync(outputPath);
        return JSON.parse(prev.toString());
    }
    return {};
}
exports.loadPrevSizes = loadPrevSizes;
function savePrevSizes(outputPath, mappings) {
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
    fs_1.default.writeFileSync(outputPath, JSON.stringify(result), { flag: 'w' });
}
exports.savePrevSizes = savePrevSizes;
//# sourceMappingURL=contract-sizes.js.map