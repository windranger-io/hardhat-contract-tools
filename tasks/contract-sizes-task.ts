import {extendConfig, task, types} from 'hardhat/config'
import {HardhatConfig} from 'hardhat/types'
import {
    configureCompilers,
    printInconsistencyWarning
} from '../tools/internal/plugin-tools'

import path from 'path'
import {
    extractBytecodeMappings,
    loadPrevSizes,
    savePrevSizes,
    tabulateBytecodeMappings
} from '../tools/contract-sizes'
import {createContractFilter, findContracts} from '../tools/artifacts-scanner'

extendConfig((config: HardhatConfig) => {
    configureCompilers(config, [
        'evm.bytecode.object',
        'evm.bytecode.sourceMap',
        'evm.deployedBytecode.object',
        'evm.deployedBytecode.sourceMap'
    ])
})

task(
    'contract-sizes',
    'Prints size of contracts, including contribution of source files into bytecode of a contract'
)
    .addFlag(
        'details',
        'Print contribution of each source files into bytecode of a contract'
    )
    .addFlag('alnum', 'Print contracts sorted by names, not by code size')
    .addFlag(
        'diff',
        'Print size difference with the previous run with this flag'
    )
    .addFlag(
        'changes',
        'Print only contracts with size changes, includes `--diff` flag'
    )
    .addOptionalParam(
        'size',
        'Filter by contract size (20 000 by default)',
        0,
        types.int
    )
    .addOptionalVariadicPositionalParam(
        'contracts',
        'Contracts to be printed, names or FQNs'
    )
    .setAction(
        async (
            {details: verbose, alnum, diff, changes, size, contracts},
            hre
        ) => {
            const filter = createContractFilter(
                (contracts ?? []) as string[],
                []
            )
            const filteredContracts = await findContracts(hre, filter)

            if (filteredContracts.length === 0) {
                // eslint-disable-next-line no-console
                console.log('No contracts found')
            }

            const mappings = await extractBytecodeMappings(
                hre,
                filteredContracts
            )

            if (!mappings) {
                printInconsistencyWarning()
                return
            }

            const savePath = path.resolve(
                hre.config.paths.cache,
                '.wr_contract_sizer_output.json'
            )

            const showDiff = Boolean(diff) || Boolean(changes)

            // eslint-disable-next-line no-undefined
            const prevSizes = showDiff ? loadPrevSizes(savePath) : undefined
            if (showDiff) {
                savePrevSizes(savePath, mappings)
            }

            mappings.sort(
                alnum
                    ? (a, b) => a.printName.localeCompare(b.printName)
                    : (a, b) =>
                          a.codeSize === b.codeSize
                              ? a.printName.localeCompare(b.printName)
                              : a.codeSize - b.codeSize
            )

            const maxSize = (size ?? 0) as number
            const p = tabulateBytecodeMappings(
                mappings,
                maxSize,
                Boolean(verbose),
                prevSizes
            )
            if (p.table.rows.length > 0) {
                p.printTable()
            } else {
                // eslint-disable-next-line no-console
                console.log(`There are no contracts exceeding ${maxSize.toLocaleString()} bytes`)
            }
        }
    )
