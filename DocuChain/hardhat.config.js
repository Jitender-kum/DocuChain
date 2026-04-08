import "@nomicfoundation/hardhat-toolbox";

/** @type import('hardhat/config').HardhatUserConfig */
const config = {
  solidity: "0.8.20",
  networks: {
    hardhat: {
      chainId: 1337 // default hardhat chain id
    }
  },
  paths: {
    sources: "./docuchain-web3/contracts",
  }
};

export default config;
