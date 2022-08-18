# Hardhat Contract Tools

Outputs Solidity contract information:
* contract sizes and contributions of each source file into it.
* storage layout of contracts with a source file for each variable.

The hardhat-contract-tools are improved alternatives for:
* [hardhat-contract-sizer](https://github.com/ItsNickBarry/hardhat-contract-sizer/) - here you can get details of contributions into contract's code size.
* [hardhat-storage-layout](https://github.com/aurora-is-near/hardhat-storage-layout/) - here it works much faster, especially for projects with >20 contracts.


## Installation

```bash
npm install --save-dev hardhat-contract-tools
# or
yarn add --dev hardhat-contract-tools
```

## Usage

Load plugin in Hardhat config:

```javascript
require('hardhat-contract-tools');
```

```typescript
import 'hardhat-contract-tools';
```

Attention! For performace reasons these tasks do NOT run hardhat `compile` and uses the last compiled state. 

### Contract sizes:

Syntax:

```bash
npx hardhat size-contracts [--details] [--diff] [--alnum] [--size <minSizeBytes>] [...<contracts>]
```
Where:
* `--details` prints contribution of difference source files into the total size of each contract
* `--diff` prints comparison of current contract sizes with a previous run with this flag
* `--size` skips contracts of size smaller than `<minSizeBytes>` (NB init code size is excluded)
* `--alnum` prints contracts in alphanumberic order (by default, order is ascending by code size, init code size is excluded)
* `<contracts>` prints only for the given contracts, can be contract names or FQNs

Output:
The details output may contain 4 types sources unrelated to Solidity code:
* `## compiler <name>` - this is a code from compiler's internal library, usually it is methods to load strings and to encode/decode abi data
* `## contract metadata` - this is [metadata](https://docs.soliditylang.org/en/v0.8.15/using-the-compiler.html) appended by `solc`, e.g. swarm hash etc
* `## non-mapped bytecode` - this is executable code, but without a mapping to source from compiler 
* `## non-code bytes` - these are bytes usually located after the executable code and before the metadata ... no idea 

### Contract storage layout:

Syntax:

```bash
npx hardhat storage-layout [--details] [...<contracts>]
```
Where:
* `--details` prints a source file for each variable, useful for complex inheritance


### Tests:
Functionality of these tasks is also available as functions for direct use in tests, e.g. to check size limits or compatibility of storage layouts.

