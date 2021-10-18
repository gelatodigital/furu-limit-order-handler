// PLUGINS
import "@nomiclabs/hardhat-waffle";
import "@typechain/hardhat";
// Process Env Variables
import * as dotenv from "dotenv";
import { utils } from "ethers";
import "hardhat-deploy";
// Config
import { HardhatUserConfig } from "hardhat/config";


dotenv.config({ path: __dirname + "/.env" });

const ALCHEMY_ID = process.env.ALCHEMY_ID;

const PK_MAINNET = process.env.PK_MAINNET;
const PK = process.env.PK;

// CONFIG
const config: HardhatUserConfig = {
  defaultNetwork: "hardhat",

  // hardhat-deploy
  namedAccounts: {
    deployer: {
      default: 0,
    },
  },

  networks: {
    hardhat: {
      forking: {
        url: `https://eth-mainnet.alchemyapi.io/v2/${ALCHEMY_ID}`,
        blockNumber: 12818753,
      },
    },

    mainnet: {
      accounts: PK_MAINNET ? [PK_MAINNET] : [],
      chainId: 1,
      url: `https://eth-mainnet.alchemyapi.io/v2/${ALCHEMY_ID}`,
      gasPrice: parseInt(utils.parseUnits("121", "gwei").toString()),
    },
    ropsten: {
      accounts: PK ? [PK] : [],
      chainId: 3,
      url: `https://eth-ropsten.alchemyapi.io/v2/${ALCHEMY_ID}`,
    },
    matic: {
      url: "https://rpc-mainnet.maticvigil.com",
      chainId: 137,
      accounts: PK_MAINNET ? [PK_MAINNET] : [],
    },
    mumbai: {
      url: "https://rpc-mumbai.maticvigil.com",
      chainId: 80001,
      accounts: PK ? [PK] : [],
    },
  },

  solidity: {
    compilers: [
      {
        version: "0.6.12",
        settings: {
          optimizer: { enabled: true },
        },
      }
    ],
  },

  typechain: {
    outDir: "typechain",
    target: "ethers-v5",
  },
};

export default config;
