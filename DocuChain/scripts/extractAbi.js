import { promises as fs } from "fs";
import path from "path";

async function main() {
    const artifactPath = path.join(
        process.cwd(),
        "artifacts",
        "docuchain-web3",
        "contracts",
        "DocumentRegistry.sol",
        "DocumentRegistry.json"
    );

    const bridgeDir = path.join(process.cwd(), "frontend-bridge");
    const abiPath = path.join(bridgeDir, "abi.json");

    try {
        const data = await fs.readFile(artifactPath, "utf-8");
        const artifact = JSON.parse(data);

        await fs.mkdir(bridgeDir, { recursive: true });

        await fs.writeFile(abiPath, JSON.stringify(artifact.abi, null, 2));
        console.log(`Successfully extracted ABI to ${abiPath}`);
    } catch (error) {
        console.error("Error extracting ABI:", error);
        process.exitCode = 1;
    }
}

main();
