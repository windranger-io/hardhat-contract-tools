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

const MAX_CONTRACT_SIZE = 24576 // applied to color contract size as green / yellow / red

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
    .addOptionalParam(
        'maxsize',
        'Contracts sizes above this limit will be show in red, above -15% of this will be shown as yellow',
        MAX_CONTRACT_SIZE,
        types.int
    )
    .addOptionalVariadicPositionalParam(
        'contracts',
        'Contracts to be printed, names or FQNs'
    )
    .setAction(
        async (
            {details: verbose, alnum, diff, changes, size, maxsize, contracts},
            hre
        ) => {
            const sizeLimit = (maxsize as number) ?? MAX_CONTRACT_SIZE
            const filter = createContractFilter(
                (contracts ?? []) as string[],
                []
            )
            const filteredContracts = await findContracts(hre, filter)

            if (filteredContracts.length === 0) {
                // eslint-disable-next-line no-console
                console.log(
                    `No contracts found.\nPlease make sure that contracts are compiled${
                        filter ? ' and matching the filter' : ''
                    }.`
                )
                return
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

            const onlyModified = Boolean(changes)
            const showDiff = Boolean(diff) || onlyModified

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
                prevSizes,
                onlyModified,
                sizeLimit
            )
            if (p.table.rows.length > 0) {
                p.printTable()
            } else {
                // eslint-disable-next-line no-console
                console.log(
                    `There are no contracts exceeding ${maxSize.toLocaleString()} bytes${
                        onlyModified ? ' and with size(s) changed' : ''
                    }.`
                )
            }
        }
    )
