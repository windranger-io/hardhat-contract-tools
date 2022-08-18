import {Table} from 'console-table-printer'
import {HardhatRuntimeEnvironment} from 'hardhat/types'

import fs from 'fs'
import path from 'path'
import {HardhatArtifactJson} from './artifacts-types'
import {ContractDescription} from './artifacts-scanner'

export interface StorageLayoutVariable {
    name: string
    slot: string
    offset: number
    type: string
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
    contracts: ContractDescription[]
): Promise<ContractStorageLayout[] | null> {
    const contractLayouts: ContractStorageLayout[] = []

    const buildInfoPaths = await env.artifacts.getBuildInfoPaths()
    for (const buildInfoPath of buildInfoPaths) {
        const artifact = fs.readFileSync(buildInfoPath)
        const artifactJsonABI = JSON.parse(
            artifact.toString()
        ) as HardhatArtifactJson

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
                    type: stateVariable.type
                })
            }
            contractLayouts.push(contractLayout)
        }
    }

    return contractLayouts
}

export function tabulateContractLayouts(
    contracts: ContractStorageLayout[]
): Table {
    const p = new Table({
        columns: [
            {name: 'contract', alignment: 'left'},
            {name: 'variable', alignment: 'left'},
            {name: 'slot', alignment: 'center'},
            {name: 'offset', alignment: 'center'},
            {name: 'type', alignment: 'left'}
        ]
    })

    for (const contract of contracts) {
        for (const stateVariable of contract.stateVariables) {
            p.addRow({
                contract: contract.printName,
                variable: stateVariable.name,
                slot: stateVariable.slot,
                offset: stateVariable.offset,
                type: stateVariable.type
            })
        }
    }

    return p
}
