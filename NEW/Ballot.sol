pragma solidity >=0.4.21 <0.7.0;

/// @author Basilius Bias Astho Christyono
contract Ballot {

  struct Voter {
    address voterAddress;
    uint voterWeight;
    bool voterVoted;
    address voterSelectedCandidate;
  }

  struct Candidate {
    address candidateAddress;
    uint candidateVoteCount;
  }

  struct Election {
    string electionId;
    bool electionIsActive;
    address electionCreator;
    mapping(address => Candidate) electionCandidates;
    mapping(address => Voter) electionParticipants;
  }

  address public contractOwner;
  mapping(string => Election) elections;

  constructor() public {
    contractOwner = msg.sender;
  }

  /* Getter */

  /// View Contract Owner
  function viewContractOwner() public view returns (address) {
    return contractOwner;
  }

  /// Registered User Show Their Voted Candidate Secretly
  function showMyVote(string memory _electionId, address _voterAddress) public view returns (
    address voterAddress, uint voterWeight, bool voterVoted, address voterSelectedCandidate
  ) {
    require(_voterAddress == msg.sender, "This Is Not Your Ballot!");
    return (
      elections[_electionId].electionParticipants[_voterAddress].voterAddress,
      elections[_electionId].electionParticipants[_voterAddress].voterWeight,
      elections[_electionId].electionParticipants[_voterAddress].voterVoted,
      elections[_electionId].electionParticipants[_voterAddress].voterSelectedCandidate
    );
  }

  /// View Current Candidate Voted Count
  function showResultCount(string memory _electionId, address _candidateAddress) public view returns (
    address candidateAddress, uint candidateVoteCount
  ) {
    return (
      elections[_electionId].electionCandidates[_candidateAddress].candidateAddress,
      elections[_electionId].electionCandidates[_candidateAddress].candidateVoteCount
    );
  }

  /* Setter */

  /// Admin Create New Election
  function createElection(string memory _electionId) public {
    // require(contractOwner == msg.sender, "Only Contract Owner Can Create Election!");
    elections[_electionId].electionId = _electionId;
    elections[_electionId].electionCreator = msg.sender;
    elections[_electionId].electionIsActive = true;
  }

  /// Admin Add New Some Candidate In Specific Election
  function addCandidate(string memory _electionId, address[] memory _candidateAddress) public {
    require(elections[_electionId].electionCreator == msg.sender, "Only Election Creator Can Add New Candidate!");
    require(elections[_electionId].electionIsActive, "Election Periode Has Ended!");
    for (uint i = 0; i < _candidateAddress.length; i++) {
      elections[_electionId].electionCandidates[_candidateAddress[i]].candidateAddress = _candidateAddress[i];
    }
  }

  /// Admin Create New Election With Add Candidates
  function createElectionWithCandidates(string memory _electionId, address[] memory _candidateAddress) public {
    // require(contractOwner == msg.sender, "Only Contract Owner Can Create Election!");
    elections[_electionId].electionId = _electionId;
    elections[_electionId].electionCreator = msg.sender;
    elections[_electionId].electionIsActive = true;
    for (uint i = 0; i < _candidateAddress.length; i++) {
      elections[_electionId].electionCandidates[_candidateAddress[i]].candidateAddress = _candidateAddress[i];
    }
  }

  // Admin Add New Voter Participant In Specific Election And Give 1 Ballot
  function addParticipant(string memory _electionId, address[] memory _voterAddress) public {
    require(elections[_electionId].electionCreator == msg.sender, "Only Election Creator Can Add Participants!");
    require(elections[_electionId].electionIsActive, "Election Periode Has Ended!");
    for (uint i = 0; i < _voterAddress.length; i++) {
      if (
        elections[_electionId].electionParticipants[_voterAddress[i]].voterWeight <= 0 &&
        elections[_electionId].electionParticipants[_voterAddress[i]].voterVoted == false
      ) {
        elections[_electionId].electionParticipants[_voterAddress[i]].voterAddress = _voterAddress[i];
        elections[_electionId].electionParticipants[_voterAddress[i]].voterWeight = 1;
      }
    }
  }

  /// Admin Stop Election Periode
  function endElection(string memory _electionId) public {
    require(elections[_electionId].electionCreator == msg.sender, "Only Election Creator Can Do This!");
    elections[_electionId].electionIsActive = false;
  }

  /// Registered User Participant Voting Some Candidate
  function vote(string memory _electionId, address _candidateAddress, address _voterAddress) public {
    require(elections[_electionId].electionIsActive, "Election Periode Has Ended!");
    require(_voterAddress == msg.sender, "This Is Not Your Ballot!");
    require(elections[_electionId].electionParticipants[_voterAddress].voterWeight > 0, "You Are Not Registered!");
    require(elections[_electionId].electionParticipants[_voterAddress].voterVoted == false, "You Already Voted!");
    elections[_electionId].electionParticipants[_voterAddress].voterVoted = true;
    elections[_electionId].electionParticipants[_voterAddress].voterSelectedCandidate = _candidateAddress;
    elections[_electionId].electionCandidates[_candidateAddress].candidateVoteCount += elections[_electionId].electionParticipants[_voterAddress].voterWeight;
  }

}
