pragma solidity ^0.4.24;
import "./IERC20.sol";



contract BatPay {
    uint constant public maxAccount = 2**32;
    uint constant public maxBulk = 2**16;

    struct Account {
        address addr;
        uint64  balance;
    }

    address public owner;
    IERC20 public token;
    Account[] public accounts;
    bytes32[] public bulkRegistrations;

    
    constructor(address _token) public {
        owner = msg.sender;
        token = IERC20(_token);
    }

    // Reserve n accounts but delay assigning addresses
    // Accounts will be claimed later using merkleTree's rootHash
    // Note: This should probably have some limitation to prevent
    //   DOS (maybe only owner?)

    function bulkRegister(uint256 n, bytes32 rootHash) public {
        require(n < maxBulk);

        uint256 temp = n + maxBulk * bulkRegistrations.length;
        bytes32 hashValue = keccak256(abi.encodePacked(temp, rootHash));

        bulkRegistrations.push(hashValue);
        accounts.length += n;
    }


    // Register a new account

    function register() public returns (uint32 ret) {
        require(accounts.length < 0xffffffff, "no more accounts left");
        ret = (uint32)(accounts.length);
        accounts.length += 1;
        accounts[ret] = Account(msg.sender, 0);
    } 

    function withdraw(uint64 amount, uint256 id) public {
        require(id < accounts.length);
        
        address addr = accounts[id].addr;
        uint64 balance = accounts[id].balance;

        require(addr != 0);
        require(balance >= amount);
        require(amount > 0);

        require(msg.sender == addr);

        token.transfer(addr, amount);
        balance -= amount;
        
        accounts[id].balance = balance;
    }

    function deposit(uint64 amount, uint256 id) public {
        require(id < accounts.length || id >= maxAccount, "invalid id");
        require(amount > 0, "amount should be positive");

        require(token.transferFrom(msg.sender, address(this), amount), "transfer failed");
        
        if (id < accounts.length)   
        {   // existing account
            uint64 balance = accounts[id].balance;
            uint64 newBalance = balance + amount;

            // checking for overflow
            require(balance <= newBalance); 

            accounts[id].balance = newBalance;
        } else
        if (id >= maxAccount)      
        {   // new account
            uint newId = register();
            accounts[newId] = Account(msg.sender, amount);
        } 
    }

    function balanceOf(uint id) public view returns (uint64) {
        require(id < accounts.length);
        return accounts[id].balance;
    }

    function accountsLength() public view returns (uint) {
        return accounts.length;
    }

    function bulkLength() public view returns (uint) {
        return bulkRegistrations.length;
    }

}