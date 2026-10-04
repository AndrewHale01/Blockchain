// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract Voting {

    address public owner;
    uint public constant ADD_CANDIDATE_FEE = 0.01 ether;

    struct Candidate {
        string name;
        uint256 votes;
    }

    Candidate[] public candidates;

    mapping(address => bool) public hasVoted;
    mapping(string => bool) public candidateExists;

    constructor() {
        owner = msg.sender;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can perform this action");
        _;
    }


    function addCandidate(string memory name) public payable {
        require(msg.value >= ADD_CANDIDATE_FEE, "Insufficient payment");
        require(bytes(name).length > 0, "Name cannot be empty");
        require(!candidateExists[name], "Candidate already exists");

        candidates.push(Candidate(name, 0));
        candidateExists[name] = true;
    }


    function vote(string memory candidate) public {
        require(!hasVoted[msg.sender], "You have already voted");

        bool found = false;

        for (uint i = 0; i < candidates.length; i++) {
            if (
                keccak256(abi.encodePacked(candidates[i].name)) ==
                keccak256(abi.encodePacked(candidate))
            ) {
                candidates[i].votes++;
                found = true;
                break;
            }
        }

        require(found, "Candidate not found");

        hasVoted[msg.sender] = true;
    }

    function getWinner()
        public
        view
        onlyOwner
        returns (string memory, uint256)
    {
        require(candidates.length > 0, "No candidates available");

        uint winnerIndex = 0;

        for (uint i = 1; i < candidates.length; i++) {
            if (candidates[i].votes > candidates[winnerIndex].votes) {
                winnerIndex = i;
            }
        }

        return (
            candidates[winnerIndex].name,
            candidates[winnerIndex].votes
        );
    }


    function getCandidatesCount() public view returns (uint) {
        return candidates.length;
    }

    function withdraw() public onlyOwner {
        payable(owner).transfer(address(this).balance);
    }
}