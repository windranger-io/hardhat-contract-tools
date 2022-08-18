import {HardhatRuntimeEnvironment} from 'hardhat/types'

import fs from 'fs'
import path from 'path'
import {
    getArtifactDbgFilePath,
    HardhatArtifactDbgJson
} from './internal/artifacts-types'

export interface ContractDescription {
    sourceName: string
    contractName: string
    buildInfoFile: string
    conflictedName: boolean
}

type ContractFilterFunc = (contractName: string, contractFQN: string) => boolean

export async function findContracts(
    env: HardhatRuntimeEnvironment,
    filterFn?: ContractFilterFunc | null
): Promise<ContractDescription[]> {
    const contracts: ContractDescription[] = []

    const buildInfoPaths = await env.artifacts.getBuildInfoPaths()
    const conflictedNames: Map<string, boolean> = new Map()

    const fullyQualifiedNames = await env.artifacts.getAllFullyQualifiedNames()
    for (const fullName of fullyQualifiedNames) {
        const {sourceName, contractName} = await env.artifacts.readArtifact(
            fullName
        )
        const conflictedFlag = conflictedNames.get(contractName)
        if (conflictedFlag !== true) {
            conflictedNames.set(contractName, conflictedFlag === false)
        }

        if (filterFn?.(contractName, fullName)) {
            let buildInfoFile = ''

            if (buildInfoPaths.length > 1) {
                const dbgFileName = getArtifactDbgFilePath(
                    env.artifacts.formArtifactPathFromFullyQualifiedName(
                        fullName
                    )
                )
                const b = await fs.promises.readFile(dbgFileName)
                const dbgFile = JSON.parse(
                    b.toString()
                ) as HardhatArtifactDbgJson
                buildInfoFile = path.basename(dbgFile.buildInfo)
            }
            contracts.push({
                sourceName,
                contractName,
                buildInfoFile,
                conflictedName: false
            })
        }
    }

    contracts.forEach(
        (c) => (c.conflictedName = Boolean(conflictedNames.get(c.contractName)))
    )

    return contracts
}

export function createContractFilter(
    includes: string[],
    excludes: string[]
): ContractFilterFunc | null {
    if (includes?.length) {
        const incl = new Set(includes)
        if (excludes?.length) {
            const excl = new Set(excludes)
            return (n0: string, n1: string) =>
                incl.has(n0) || incl.has(n1) || !(excl.has(n0) || excl.has(n1))
        }
        return (n0: string, n1: string) => incl.has(n0) || incl.has(n1)
    } else if (excludes?.length) {
        const excl = new Set(excludes)
        return (n0: string, n1: string) => !(excl.has(n0) || excl.has(n1))
    }
    return null
}
