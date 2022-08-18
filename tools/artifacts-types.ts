export interface HardhatArtifactJson {
    output: {
        contracts: {
            [key: string]: {
                [key: string]: ArtifactJsonContract
            }
        }
        sources: {
            id: number
        }[]
    }
}

interface ArtifactJsonContract {
    evm: ArtifactJsonContractEVM
    storageLayout: ArtifactJsonStorageLayout
}

interface ArtifactJsonStorageLayout {
    storage: ArtifactJsonStorageEntry[]
}

interface ArtifactJsonStorageEntry {
    astId: number
    contract: string
    label: string
    offset: number
    slot: string
    type: string
}

interface ArtifactJsonContractEVM {
    bytecode: ArtifactJsonContractEVMBytecode
    deployedBytecode: ArtifactJsonContractEVMBytecode
}

interface ArtifactJsonContractEVMBytecode {
    generatedSources: {
        id: number
        name: string
    }[]
    object: string
    sourceMap: string
}

export interface HardhatArtifactDbgJson {
    buildInfo: string
}

export function getArtifactDbgFilePath(artifactPath: string): string {
    return artifactPath.replace(/\.json$/, '.dbg.json')
}
