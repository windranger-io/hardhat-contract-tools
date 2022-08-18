# Hardhat Contract Tooks

Outputs Solidity contract information:
* sizes and contributions of each source file.
* storage layout of contracts.

The hardhat-contract-tools are improved alternatives for:
* [hardhat-contract-sizer](https://github.com/ItsNickBarry/hardhat-contract-sizer/) - here you can get details of contributions into contract's code size.
* [hardhat-storage-layout](https://github.com/aurora-is-near/hardhat-storage-layout/) - here it works much faster, especially for projects with 10-100 contracts.


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

Run the included Hardhat task to output compiled contract sizes:

```bash
npx hardhat size-contracts
# or
yarn run hardhat size-contracts
```

Attention! For performace reasons these tasks do NOT run hardhat `compile` and uses the last compiled state. 
