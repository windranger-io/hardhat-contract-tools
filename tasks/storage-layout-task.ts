import {extendConfig, task} from 'hardhat/config'
import {HardhatConfig} from 'hardhat/types'
import {createContractFilter, findContracts} from '../tools/artifacts-scanner'

import {
    extractContractLayout,
    tabulateContractLayouts
} from '../tools/storage-layout'
import {
    configureCompilers,
    printInconsistencyWarning
} from '../tools/internal/plugin-tools'

// A much faster version of hardhat-storage-layout. Supports filtering.

extendConfig((config: HardhatConfig) =>
    configureCompilers(config, ['storageLayout'], true)
)

task('storage-layout', 'Print storage layout of contracts')
    .addFlag('details', 'Prints source file for each variable')
    .addOptionalVariadicPositionalParam(
        'contracts',
        'Contracts to be printed, names or FQNs'
    )
    .setAction(async ({details, contracts}, hre) => {
        const verbose = Boolean(details)
        const filter = createContractFilter((contracts ?? []) as string[], [])
        const filteredContracts = await findContracts(hre, filter)

        if (filteredContracts.length === 0) {
            // eslint-disable-next-line no-console
            console.log('No contracts found')
        }

        const layouts = await extractContractLayout(
            hre,
            filteredContracts,
            verbose
        )

        if (!layouts) {
            printInconsistencyWarning()
            return
        }

        layouts.sort((a, b) => a.printName.localeCompare(b.printName))

        const table = tabulateContractLayouts(layouts, verbose)
        table.printTable()
    })
