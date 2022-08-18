export interface BuildInfoJson {
    output: {
        contracts: {
            [fileName: string]: {
                [contractName: string]: ArtifactJsonContract
            }
        }
        sources: {
            [fileName: string]: ArtifactJsonSource
        }
    }
}

interface ArtifactJsonSource {
    id: number
    ast: ArtifactJsonAstNode
}

interface ArtifactJsonAstNode {
    id: number
    nodes?: ArtifactJsonAstNode[]
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

export function createAstToFileMapping(
    info: BuildInfoJson
): Map<number, string> {
    const result: Map<number, string> = new Map()
    const sources = info.output.sources
    Object.entries(sources).forEach(([fileName, entry]) =>
        visitAstNodes(result, fileName, entry.ast)
    )
    return result
}

function visitAstNodes(
    result: Map<number, string>,
    fileName: string,
    ast: ArtifactJsonAstNode
): void {
    result.set(ast.id, fileName)
    for (const subNode of ast.nodes ?? []) {
        visitAstNodes(result, fileName, subNode)
    }
}
