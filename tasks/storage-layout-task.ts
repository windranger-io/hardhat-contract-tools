import {extendConfig, task} from 'hardhat/config'
import {HardhatConfig} from 'hardhat/types'
import {createContractFilter, findContracts} from '../tools/artifacts-scanner'

import {
    extractContractLayout,
    tabulateContractLayouts
} from '../tools/storage-layout'
import {configureCompilers, printInconsistencyWarning} from './plugin-tools'

// A much faster version of hardhat-storage-layout. Supports filtering.

extendConfig((config: HardhatConfig) =>
    configureCompilers(config, ['storageLayout'])
)

task('storage-layout', 'Print storage layout of contracts')
    .addOptionalVariadicPositionalParam(
        'contracts',
        'Contracts to be printed, names or FQNs'
    )
    .setAction(async ({contracts}, hre) => {
        const filter = createContractFilter((contracts ?? []) as string[], [])
        const filteredContracts = await findContracts(hre, filter)

        if (filteredContracts.length === 0) {
            // eslint-disable-next-line no-console
            console.log('No contracts found')
        }

        const layouts = await extractContractLayout(hre, filteredContracts)

        if (!layouts) {
            printInconsistencyWarning()
            return
        }

        layouts.sort((a, b) => a.printName.localeCompare(b.printName))

        const table = tabulateContractLayouts(layouts)
        table.printTable()
    })
