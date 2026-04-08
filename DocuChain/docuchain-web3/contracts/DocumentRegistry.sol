// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract DocumentRegistry {
    struct Document {
        string ipfsHash;
        string fileName;
        uint256 uploadTime;
        address owner;
    }

    // Mapping from owner address to an array of Document structs
    mapping(address => Document[]) private ownerToDocuments;

    // Event emitted when a document is uploaded
    event DocumentUploaded(
        string ipfsHash,
        string fileName,
        uint256 uploadTime,
        address indexed owner
    );

    /**
     * @dev Upload a new document by storing its hash and metadata.
     * @param _ipfsHash The IPFS hash of the document.
     * @param _fileName The name of the file.
     */
    function uploadDocument(string memory _ipfsHash, string memory _fileName) public {
        require(bytes(_ipfsHash).length > 0, "IPFS hash cannot be empty");
        require(bytes(_fileName).length > 0, "File name cannot be empty");

        Document memory newDoc = Document({
            ipfsHash: _ipfsHash,
            fileName: _fileName,
            uploadTime: block.timestamp,
            owner: msg.sender
        });

        ownerToDocuments[msg.sender].push(newDoc);

        emit DocumentUploaded(_ipfsHash, _fileName, block.timestamp, msg.sender);
    }

    /**
     * @dev Retrieve all documents for a specific user (owner).
     * @param _owner The address of the user.
     * @return Array of Document structs belonging to the user.
     */
    function getDocumentsByOwner(address _owner) public view returns (Document[] memory) {
        return ownerToDocuments[_owner];
    }
}
