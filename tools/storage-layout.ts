import {Table} from 'console-table-printer'
import {HardhatRuntimeEnvironment} from 'hardhat/types'

import fs from 'fs'
import path from 'path'
import {BuildInfoJson, createAstToFileMapping} from './internal/artifacts-types'
import {ContractDescription} from './artifacts-scanner'
import {ColumnOptionsRaw} from 'console-table-printer/dist/src/models/external-table'

export interface StorageLayoutVariable {
    name: string
    slot: string
    offset: number
    type: string
    sourceFile?: string
}

export interface ContractStorageLayout {
    uniqueName: string
    printName: string
    stateVariables: StorageLayoutVariable[]
}

export function isInheritedStorageLayout(
    parent: ContractStorageLayout,
    child: ContractStorageLayout
): boolean {
    const pVars = parent.stateVariables
    const cVars = child.stateVariables
    if (cVars.length < pVars.length) {
        return false
    }

    return !pVars.some((p, i) => {
        const c = cVars[i]
        return (
            p.name !== c.name ||
            p.slot !== c.slot ||
            p.offset !== c.offset ||
            p.type !== c.type
        )
    })
}

export async function extractContractLayout(
    env: HardhatRuntimeEnvironment,
    contracts: ContractDescription[],
    sourceFiles?: boolean
): Promise<ContractStorageLayout[] | null> {
    const contractLayouts: ContractStorageLayout[] = []

    const buildInfoPaths = await env.artifacts.getBuildInfoPaths()
    for (const buildInfoPath of buildInfoPaths) {
        const artifact = fs.readFileSync(buildInfoPath)
        const buildInfo = JSON.parse(artifact.toString()) as BuildInfoJson

        const astMapping = sourceFiles
            ? createAstToFileMapping(buildInfo)
            : new Map<number, string>()

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
                buildInfo.output.contracts?.[sourceName]?.[contractName]
            if (!contractInfo) {
                return null
            }

            const uniqueName = `${contractName}:${sourceName}`
            const contractLayout: ContractStorageLayout = {
                uniqueName,
                printName: conflictedName ? uniqueName : contractName,
                stateVariables: []
            }

            for (const stateVariable of contractInfo.storageLayout.storage) {
                contractLayout.stateVariables.push({
                    name: stateVariable.label,
                    slot: stateVariable.slot,
                    offset: stateVariable.offset,
                    type: stateVariable.type,
                    sourceFile: astMapping.get(stateVariable.astId)
                })
            }
            contractLayouts.push(contractLayout)
        }
    }

    return contractLayouts
}

export function tabulateContractLayouts(
    contracts: ContractStorageLayout[],
    sourceFiles?: boolean
): Table {
    const columns: ColumnOptionsRaw[] = [
        {name: 'contract', alignment: 'left'},
        {name: 'variable', alignment: 'left'},
        {name: 'slot', alignment: 'right'},
        {name: 'offset', alignment: 'right'},
        {name: 'type', alignment: 'left'}
    ]
    if (sourceFiles) {
        columns.push({name: 'source', alignment: 'left'})
    }
    const p = new Table({columns})

    for (const contract of contracts) {
        for (const stateVariable of contract.stateVariables) {
            const row: Record<string, unknown> = {
                contract: contract.printName,
                variable: stateVariable.name,
                slot: stateVariable.slot,
                offset: stateVariable.offset,
                type: stateVariable.type
            }
            if (sourceFiles) {
                row.source = stateVariable.sourceFile
            }
            p.addRow(row)
        }
    }

    return p
}
