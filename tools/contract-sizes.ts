import {Table} from 'console-table-printer'
import {HardhatRuntimeEnvironment} from 'hardhat/types'
import chalk from 'chalk'

import fs from 'fs'
import path from 'path'
import {HardhatArtifactJson} from './artifacts-types'
import {ContractDescription} from './artifacts-scanner'

const MAX_CONTRACT_SIZE = 24576 // applied to color contract size as green / yellow / red

/* eslint-disable no-lone-blocks */

export interface ContractCodeSource {
    fileName: string
    codeSize: number
    initSize: number
}

export interface ContractCodeMapping {
    uniqueName: string
    printName: string
    codeSize: number
    initSize: number
    sources: ContractCodeSource[]
}

const noSourceId = -1
const metadataId = -2
const unknownCodeId = -3

export async function extractBytecodeMappings(
    env: HardhatRuntimeEnvironment,
    contracts: ContractDescription[]
): Promise<ContractCodeMapping[] | null> {
    const buildInfoPaths = await env.artifacts.getBuildInfoPaths()
    const contractLayouts: ContractCodeMapping[] = []

    for (const buildInfoPath of buildInfoPaths) {
        const artifact = fs.readFileSync(buildInfoPath)
        const artifactJsonABI = JSON.parse(
            artifact.toString()
        ) as HardhatArtifactJson

        const sourceFiles: Map<number, string> = new Map()
        Object.entries(artifactJsonABI.output.sources).forEach(
            ([key, {id}]) => {
                sourceFiles.set(id, key)
            }
        )
        sourceFiles.set(noSourceId, '## non-mapped bytecode')
        sourceFiles.set(metadataId, '## contract metadata')
        sourceFiles.set(unknownCodeId, '## non-code bytes')

        for (const {
            sourceName,
            contractName,
            buildInfoFile,
            conflictedName
        } of contracts) {
            if (
                buildInfoFile &&
                buildInfoFile !== path.basename(buildInfoPath)
            ) {
                // eslint-disable-next-line no-continue
                continue
            }

            const contractInfo =
                artifactJsonABI.output.contracts?.[sourceName]?.[contractName]
            if (!contractInfo) {
                return null
            }
            const evm = contractInfo.evm

            const generatedSources: Map<number, string> = new Map()
            evm.bytecode.generatedSources.forEach((entry) =>
                generatedSources.set(entry.id, `## compiler ${entry.name}`)
            )
            evm.deployedBytecode.generatedSources.forEach((entry) =>
                generatedSources.set(entry.id, `## compiler ${entry.name}`)
            )

            const sourceEntries: Map<number, ContractCodeSource> = new Map()
            const getSourceEntry = (id: number): ContractCodeSource => {
                {
                    const entry = sourceEntries.get(id)
                    if (entry) {
                        return entry
                    }
                }
                const fileName =
                    sourceFiles.get(id) ??
                    generatedSources.get(id) ??
                    `<unknown:${id}>`
                const entry: ContractCodeSource = {
                    fileName,
                    codeSize: 0,
                    initSize: 0
                }
                sourceEntries.set(id, entry)
                return entry
            }

            const addParsedSize = (
                id: number,
                initSize: number,
                codeSize: number
            ) => {
                const entry = getSourceEntry(id)
                entry.initSize += initSize
                entry.codeSize += codeSize
            }

            const uniqueName = `${contractName}:${sourceName}`
            const contractLayout: ContractCodeMapping = {
                uniqueName,
                printName: conflictedName ? uniqueName : contractName,
                initSize: countBytes(
                    evm.bytecode.sourceMap,
                    evm.bytecode.object,
                    (id, size) => addParsedSize(id, size, 0),
                    evm.deployedBytecode.object.length
                ),
                codeSize: countBytes(
                    evm.deployedBytecode.sourceMap,
                    evm.deployedBytecode.object,
                    (id, size) => addParsedSize(id, 0, size),
                    0,
                    true
                ),
                sources: []
            }

            contractLayout.sources = [...sourceEntries.values()]
            contractLayout.sources.sort((a, b) => a.codeSize - b.codeSize)

            contractLayouts.push(contractLayout)
        }
    }

    return contractLayouts
}

function countBytes(
    sourceMap: string,
    bytecode: string,
    addSizeFn: (id: number, size: number) => void,
    tailLen: number,
    allowMeta?: boolean
): number {
    let decodePos = 0
    let sourceId = noSourceId

    const addSize = (id: number, size: number) => {
        if (size > 0) {
            addSizeFn(id, size)
        }
    }

    if (sourceMap) {
        for (const mapping of sourceMap.split(';')) {
            const components = mapping.split(':')
            if (components.length >= 3 && components[2]) {
                sourceId = parseInt(components[2], 10)
            }
            let n = 1
            // eslint-disable-next-line default-case
            switch (bytecode[decodePos]) {
                case '7': // PUSH17 - PUSH32
                    n += 16
                // eslint-disable-next-line no-fallthrough
                case '6': // PUSH01 - PUSH16
                    n += parseInt(bytecode[decodePos + 1], 16)
                    n += 1
            }
            addSize(sourceId, n)
            decodePos += n * 2
        }
    }

    let unknown = bytecode.length - decodePos
    if (
        unknown > tailLen &&
        unknown >= 2 &&
        bytecode.substring(decodePos, decodePos + 2).toUpperCase() === 'FE'
    ) {
        // terminating *ASSERT op
        addSize(sourceId, 1)
        unknown -= 2
    }
    if (unknown > tailLen) {
        unknown -= tailLen

        if (allowMeta && unknown >= 4) {
            const metadataLen =
                parseInt(bytecode.substring(bytecode.length - 4), 16) + 2
            if (metadataLen * 2 > unknown) {
                throw Error(
                    `Inconsistent metadata size: ${unknown} < ${
                        metadataLen * 2
                    }`
                )
            }
            unknown -= metadataLen * 2
            addSize(metadataId, metadataLen)
        }
        if (unknown > 0) {
            addSize(unknownCodeId, unknown / 2)
        }
    } else if (unknown < tailLen) {
        throw Error(`Inconsistent bytecode size: ${unknown} < ${tailLen}`)
    }

    return (bytecode.length - tailLen) / 2
}

const colorSize = (code: number): string => {
    const v = code.toLocaleString()
    if (code > MAX_CONTRACT_SIZE) {
        return chalk.red(v)
    } else if (code > MAX_CONTRACT_SIZE * 0.85) {
        return chalk.yellow(v)
    }
    return v
}

export function tabulateBytecodeMappings(
    contracts: ContractCodeMapping[],
    maxSize: number,
    verbose: boolean,
    prev?: StoredCodeMappings
): Table {
    const codeColumnDelta = '±code'
    const codeColumnPct = 'code%'

    const columns = [{name: 'contract', alignment: 'left'}]
    if (verbose) {
        columns.push(
            {name: 'source', alignment: 'left'},
            {name: codeColumnPct, alignment: 'right'}
        )
    }
    columns.push({name: 'code', alignment: 'right'})
    const showDiff = Boolean(prev)
    if (showDiff) {
        columns.push({name: codeColumnDelta, alignment: 'right'})
    }
    columns.push({name: 'init', alignment: 'right'})

    interface Row {
        contract: string
        source?: string
        code: string
        [codeColumnPct]?: string
        [codeColumnDelta]?: string
        init: string
    }

    const p = new Table({columns})

    for (const c of contracts) {
        if (maxSize > c.codeSize + c.initSize) {
            // eslint-disable-next-line no-continue
            continue
        }

        if (verbose && p.table.rows.length > 0) {
            p.addRow({})
        }

        const addDelta = (v: Row, code: number, codePrev?: number): Row => {
            // eslint-disable-next-line no-undefined
            if (!showDiff) {
                return v
            }
            const d = code - (codePrev ?? 0)
            if (d === 0) {
                return v
            }

            v[codeColumnDelta] =
                d > 0
                    ? chalk.red(`+${d.toLocaleString()}`)
                    : chalk.green(`-${(-d).toLocaleString()}`)

            return v
        }

        if (verbose) {
            for (const source of c.sources) {
                const srcName =
                    source.fileName[0] === '#'
                        ? chalk.gray(chalk.italic(source.fileName))
                        : source.fileName

                const pct = `${Math.round(
                    (source.codeSize * 100) / c.codeSize
                )}%`

                const row = {
                    contract: c.printName,
                    source: srcName,
                    code: source.codeSize.toLocaleString(),
                    [codeColumnPct]: pct,
                    init: source.initSize.toLocaleString()
                }

                const prevSize =
                    prev?.[c.uniqueName]?.sources[source.fileName]?.codeSize

                p.addRow(addDelta(row, source.codeSize, prevSize))
            }
        }

        const row: Row = {
            contract: c.printName,
            code: colorSize(c.codeSize),
            init: c.initSize.toLocaleString()
        }
        if (verbose) {
            row.source = c.sources.length > 0 ? chalk.bold('=== Total ===') : ''
            row.code = chalk.bold(row.code)
            row.init = chalk.bold(row.init)
        }

        const prevSize = prev?.[c.uniqueName]?.codeSize
        p.addRow(addDelta(row, c.codeSize, prevSize))
    }

    return p
}

interface StoredCodeMappings {
    [name: string]: {
        codeSize: number
        initSize: number
        sources: {
            [name: string]: {
                codeSize: number
                initSize: number
            }
        }
    }
}

export function loadPrevSizes(outputPath: string): StoredCodeMappings {
    if (fs.existsSync(outputPath)) {
        const prev = fs.readFileSync(outputPath)

        return JSON.parse(prev.toString()) as StoredCodeMappings
    }

    return {}
}

export function savePrevSizes(
    outputPath: string,
    mappings: ContractCodeMapping[]
) {
    const result: StoredCodeMappings = {}
    mappings.forEach((m) => {
        if (m.sources.length === 0) {
            return
        }

        const sources: Record<
            string,
            {
                codeSize: number
                initSize: number
            }
        > = {}

        m.sources.forEach(
            (s) =>
                (sources[s.fileName] = {
                    codeSize: s.codeSize,
                    initSize: s.initSize
                })
        )

        result[m.uniqueName] = {
            codeSize: m.codeSize,
            initSize: m.initSize,
            sources
        }
    })

    fs.writeFileSync(outputPath, JSON.stringify(result), {flag: 'w'})
}
