import {HardhatConfig, SolcConfig} from 'hardhat/types'

export function configureCompilers(
    config: HardhatConfig,
    selections: string[]
): void {
    for (const compiler of config.solidity.compilers) {
        addOutputSelections(compiler, selections)
    }
}

export function addOutputSelections(
    compiler: SolcConfig,
    selections: string[]
): void {
    /* eslint-disable @typescript-eslint/no-unsafe-member-access */
    compiler.settings ??= {}
    compiler.settings.outputSelection ??= {}
    compiler.settings.outputSelection['*'] ??= {}
    compiler.settings.outputSelection['*']['*'] ??= []
    const outputSelection = compiler.settings.outputSelection['*'][
        '*'
    ] as string[]
    /* eslint-enable @typescript-eslint/no-unsafe-member-access */

    for (const s of selections) {
        if (!outputSelection.includes(s)) {
            outputSelection.push(s)
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
