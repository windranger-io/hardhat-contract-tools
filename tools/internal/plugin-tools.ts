import {HardhatConfig, SolcConfig} from 'hardhat/types'

export function configureCompilers(
    config: HardhatConfig,
    selections: string[],
    ast?: boolean
): void {
    for (const compiler of config.solidity.compilers) {
        addOutputSelections(compiler, '*', selections)
        if (ast) {
            addOutputSelections(compiler, '', ['ast'])
        }
    }
}

export function addOutputSelections(
    compiler: SolcConfig,
    section: string,
    selections: string[]
): void {
    /* eslint-disable @typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-assignment */
    compiler.settings ??= {}
    compiler.settings.outputSelection ??= {}
    const outputSelection = compiler.settings.outputSelection
    outputSelection['*'] ??= {}
    outputSelection['*'][section] ??= []
    const sectionSelection = outputSelection['*'][section] as string[]
    /* eslint-enable @typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-assignment */

    for (const s of selections) {
        if (!sectionSelection.includes(s)) {
            sectionSelection.push(s)
        }
    }
}

export function printInconsistencyWarning() {
    /* eslint-disable no-console */
    console.log('***********************************************************')
    console.log('***********************************************************')
    console.log('***********************************************************')
    console.log('\nThere is a mismatch between artifact and build files.')
    console.log('\nPlease run:\n')
    console.log('\t npm hardhat clean && npm hardhat compile\n')
    console.log('***********************************************************')
    console.log('***********************************************************')
    console.log('***********************************************************')
    /* eslint-enable no-console */
}
